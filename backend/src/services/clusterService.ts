import { Types } from 'mongoose';
import clustersDbscan from '@turf/clusters-dbscan';
import convex from '@turf/convex';
import { featureCollection, point } from '@turf/helpers';
import type { Feature, FeatureCollection, Point } from 'geojson';
import {
  Cluster,
  type ClusterCategory,
  type ClusterLegacyRiskLevel,
  type ClusterRiskColor,
  type ClusterRiskStatus,
  type ICluster,
} from '../models/Cluster.js';
import { Report, type CitizenReportCategory } from '../models/Report.js';
import { GridCell } from '../models/GridCell.js';
import { AqiReading } from '../models/AqiReading.js';
import { Kelurahan } from '../models/Kelurahan.js';
import type { IGeoPoint, IGeoPolygon } from '../models/GeoJSON.js';
import { calculateDistanceMeters, readGridAqiFromRedis } from './aqiService.js';
import { delCache } from '../utils/cache.js';

export const CLUSTER_TIME_WINDOW_HOURS = 72;
export const DBSCAN_MAX_DISTANCE_KM = 0.5;
export const DBSCAN_MAX_DISTANCE_METERS = DBSCAN_MAX_DISTANCE_KM * 1000;
export const DBSCAN_MIN_POINTS = 5;
export const CLUSTER_CATEGORIES: readonly ClusterCategory[] = ['ispa', 'diare'] as const;
export const MAP_CACHE_PATTERNS: readonly string[] = ['map_cache:*', 'map:public:*'] as const;

export interface LeanClusterReportDoc {
  _id: Types.ObjectId;
  category: CitizenReportCategory;
  symptoms?: string[];
  sickCount?: number;
  severity?: string;
  geom?: IGeoPoint;
  location?: IGeoPoint;
  kelurahanId?: Types.ObjectId;
  gridCellId?: Types.ObjectId;
  reportedAt: Date;
}

export interface DbscanReportPointProps {
  reportId: string;
  category: ClusterCategory;
  sickCount: number;
  symptoms: string[];
  kelurahanId?: string;
  gridCellId?: string;
  reportedAtMs: number;
  dbscan?: 'edge' | 'core' | 'noise';
  cluster?: number;
}

interface PreloadedGridAqiSnapshot {
  gridId: string;
  kelurahanId?: Types.ObjectId;
  lng: number;
  lat: number;
  aqi: number;
}

export interface EvaluateClusterRiskInput {
  category: ClusterCategory;
  reportCount: number;
  totalSickCount: number;
  averageAqi: number;
}

export interface ClusterRiskEvaluationResult {
  riskStatus: ClusterRiskStatus;
  riskColor: ClusterRiskColor;
  colorHex: string;
  riskLevel: ClusterLegacyRiskLevel;
}

export interface DetectClustersResult {
  windowStartIso: string;
  windowEndIso: string;
  totalReportsFetched: number;
  reportsByCategory: {
    ispa: number;
    diare: number;
  };
  clustersDetected: number;
  clustersByCategory: {
    ispa: number;
    diare: number;
  };
  upsertedClusterIds: string[];
  resolvedStaleCount: number;
  cacheInvalidated: boolean;
  clusters: ICluster[];
}

export const evaluateClusterRisk = (
  input: EvaluateClusterRiskInput
): ClusterRiskEvaluationResult => {
  const { category, reportCount, totalSickCount, averageAqi } = input;
  const safeAqi = Number.isFinite(averageAqi) && averageAqi >= 0 ? averageAqi : 50;

  const isPrioritas =
    reportCount >= 15 ||
    (reportCount >= 10 && safeAqi > 150) ||
    (category === 'ispa' && reportCount >= 8 && safeAqi > 200) ||
    totalSickCount >= 25;

  if (isPrioritas) {
    return {
      riskStatus: 'Prioritas',
      riskColor: 'Merah',
      colorHex: '#EF4444',
      riskLevel: 'outbreak',
    };
  }

  const isSiaga =
    reportCount >= 8 ||
    (reportCount >= DBSCAN_MIN_POINTS && safeAqi > 100) ||
    totalSickCount >= 12;

  if (isSiaga) {
    return {
      riskStatus: 'Siaga',
      riskColor: 'Oranye',
      colorHex: '#F97316',
      riskLevel: 'high',
    };
  }

  return {
    riskStatus: 'Waspada',
    riskColor: 'Kuning',
    colorHex: '#EAB308',
    riskLevel: 'moderate',
  };
};

export const buildFallbackPolygonAroundCenter = (
  centerCoords: [number, number],
  radiusMeters = 100
): IGeoPolygon => {
  const [centerLng, centerLat] = centerCoords;
  const effectiveRadius = Math.max(80, Math.min(radiusMeters, DBSCAN_MAX_DISTANCE_METERS));
  const metersPerDegreeLat = 111_320;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const safeCosLat = Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat;
  const metersPerDegreeLng = metersPerDegreeLat * safeCosLat;

  const segments = 8;
  const ring: number[][] = [];

  for (let i = 0; i < segments; i += 1) {
    const angle = (2 * Math.PI * i) / segments;
    const dLng = (effectiveRadius * Math.cos(angle)) / metersPerDegreeLng;
    const dLat = (effectiveRadius * Math.sin(angle)) / metersPerDegreeLat;
    ring.push([
      Number((centerLng + dLng).toFixed(6)),
      Number((centerLat + dLat).toFixed(6)),
    ]);
  }

  if (ring.length > 0 && ring[0]) {
    ring.push([ring[0][0]!, ring[0][1]!]);
  }

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
};

export const buildClusterBoundaryPolygon = (
  clusterPoints: Array<Feature<Point, DbscanReportPointProps>>,
  centerCoords: [number, number],
  radiusMeters: number
): IGeoPolygon => {
  try {
    const fc = featureCollection(clusterPoints);
    const hullFeature = convex(fc);

    if (
      hullFeature &&
      hullFeature.geometry &&
      hullFeature.geometry.type === 'Polygon' &&
      Array.isArray(hullFeature.geometry.coordinates) &&
      hullFeature.geometry.coordinates.length > 0 &&
      Array.isArray(hullFeature.geometry.coordinates[0]) &&
      hullFeature.geometry.coordinates[0].length >= 4
    ) {
      const outerRing = hullFeature.geometry.coordinates[0].map((coord) => [
        Number(Number(coord[0]).toFixed(6)),
        Number(Number(coord[1]).toFixed(6)),
      ]);

      const uniqueCoordKeys = new Set(outerRing.map(([lng, lat]) => `${lng},${lat}`));
      if (uniqueCoordKeys.size >= 3) {
        const firstCoord = outerRing[0];
        const lastCoord = outerRing[outerRing.length - 1];
        if (
          firstCoord &&
          lastCoord &&
          (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1])
        ) {
          outerRing.push([firstCoord[0]!, firstCoord[1]!]);
        }

        return {
          type: 'Polygon',
          coordinates: [outerRing],
        };
      }
    }
  } catch (error) {
    console.warn(
      '[ClusterService] @turf/convex gagal membentuk hull, menggunakan fallback poligon:',
      error
    );
  }

  return buildFallbackPolygonAroundCenter(centerCoords, Math.max(100, radiusMeters));
};

export const calculateCentroidAndRadius = (
  clusterPoints: Array<Feature<Point, DbscanReportPointProps>>
): { centerCoords: [number, number]; radiusMeters: number } => {
  let sumLng = 0;
  let sumLat = 0;
  const count = clusterPoints.length;

  for (const pt of clusterPoints) {
    const [lng, lat] = pt.geometry.coordinates as [number, number];
    sumLng += lng;
    sumLat += lat;
  }

  const centerLng = Number((sumLng / count).toFixed(6));
  const centerLat = Number((sumLat / count).toFixed(6));

  let maxDistanceMeters = 0;
  for (const pt of clusterPoints) {
    const [lng, lat] = pt.geometry.coordinates as [number, number];
    const dist = calculateDistanceMeters(centerLat, centerLng, lat, lng);
    if (dist > maxDistanceMeters) {
      maxDistanceMeters = dist;
    }
  }

  const radiusMeters = Math.max(50, Math.min(maxDistanceMeters || 150, DBSCAN_MAX_DISTANCE_METERS));

  return {
    centerCoords: [centerLng, centerLat],
    radiusMeters,
  };
};

export const extractDominantSymptoms = (
  clusterPoints: Array<Feature<Point, DbscanReportPointProps>>
): string[] => {
  const freqMap = new Map<string, number>();

  for (const pt of clusterPoints) {
    const symptoms = pt.properties?.symptoms ?? [];
    for (const rawSymptom of symptoms) {
      const normalized = rawSymptom.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      freqMap.set(normalized, (freqMap.get(normalized) ?? 0) + 1);
    }
  }

  const sorted = Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symptom]) => symptom);

  freqMap.clear();
  return sorted;
};

const preloadGridAqiSnapshots = async (): Promise<PreloadedGridAqiSnapshot[]> => {
  const gridCells = await GridCell.find()
    .select('_id kelurahanId centroid currentAqi')
    .lean();

  if (gridCells.length === 0) {
    return [];
  }

  const snapshots: PreloadedGridAqiSnapshot[] = await Promise.all(
    gridCells.map(async (cell) => {
      const gridId = cell._id.toString();
      const [lng, lat] = cell.centroid?.coordinates ?? [106.827153, -6.175392];
      const cachedRedis = await readGridAqiFromRedis(gridId);
      const effectiveAqi =
        cachedRedis && Number.isFinite(cachedRedis.aqi)
          ? cachedRedis.aqi
          : typeof cell.currentAqi === 'number' && cell.currentAqi > 0
            ? cell.currentAqi
            : 50;

      return {
        gridId,
        ...(cell.kelurahanId ? { kelurahanId: cell.kelurahanId } : {}),
        lng: Number(lng),
        lat: Number(lat),
        aqi: effectiveAqi,
      };
    })
  );

  return snapshots;
};

const resolveClusterAqiAndKelurahan = async (
  centerCoords: [number, number],
  gridSnapshots: PreloadedGridAqiSnapshot[],
  majorityKelurahanId?: Types.ObjectId
): Promise<{ averageAqi: number; kelurahanId?: Types.ObjectId }> => {
  const [centerLng, centerLat] = centerCoords;
  let resolvedKelurahanId = majorityKelurahanId;
  let nearestAqi: number | undefined;

  if (gridSnapshots.length > 0) {
    let bestGrid: PreloadedGridAqiSnapshot | undefined;
    let minDistance = Number.POSITIVE_INFINITY;

    for (const snap of gridSnapshots) {
      const dist = calculateDistanceMeters(centerLat, centerLng, snap.lat, snap.lng);
      if (dist < minDistance) {
        minDistance = dist;
        bestGrid = snap;
      }
    }

    if (bestGrid) {
      nearestAqi = bestGrid.aqi;
      if (!resolvedKelurahanId && bestGrid.kelurahanId) {
        resolvedKelurahanId = bestGrid.kelurahanId;
      }
    }
  }

  if (nearestAqi === undefined) {
    const latestReading = await AqiReading.findOne({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [centerLng, centerLat],
          },
        },
      },
    })
      .sort({ recordedAt: -1 })
      .select('aqi kelurahanId')
      .lean();

    if (latestReading) {
      nearestAqi = latestReading.aqi;
      if (!resolvedKelurahanId && latestReading.kelurahanId) {
        resolvedKelurahanId = latestReading.kelurahanId;
      }
    }
  }

  if (!resolvedKelurahanId) {
    const matchedKelurahan = await Kelurahan.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [centerLng, centerLat],
          },
        },
      },
    })
      .select('_id')
      .lean();

    if (matchedKelurahan?._id) {
      resolvedKelurahanId = matchedKelurahan._id;
    }
  }

  return {
    averageAqi: Math.round(nearestAqi ?? 50),
    ...(resolvedKelurahanId ? { kelurahanId: resolvedKelurahanId } : {}),
  };
};

export const buildDeterministicClusterCode = (
  category: ClusterCategory,
  centerCoords: [number, number]
): string => {
  const [lng, lat] = centerCoords;
  const quantizedLat = Math.round(lat * 200) / 200;
  const quantizedLng = Math.round(lng * 200) / 200;

  const latPrefix = quantizedLat < 0 ? 'S' : 'N';
  const lngPrefix = quantizedLng < 0 ? 'W' : 'E';
  const latToken = Math.abs(Math.round(quantizedLat * 1000))
    .toString()
    .padStart(5, '0');
  const lngToken = Math.abs(Math.round(quantizedLng * 1000))
    .toString()
    .padStart(6, '0');

  return `CLU-${category.toUpperCase()}-${latPrefix}${latToken}-${lngPrefix}${lngToken}`;
};

export const invalidateMapCacheAfterClusterUpsert = async (): Promise<void> => {
  await Promise.all(MAP_CACHE_PATTERNS.map((pattern) => delCache(pattern)));
};

export const detectClusters = async (): Promise<DetectClustersResult> => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - CLUSTER_TIME_WINDOW_HOURS * 60 * 60 * 1000);

  const reportsByCategory: Record<ClusterCategory, LeanClusterReportDoc[]> = {
    ispa: [],
    diare: [],
  };
  let gridSnapshots: PreloadedGridAqiSnapshot[] = [];
  const activeClusterObjectIds: Types.ObjectId[] = [];
  const upsertedClusters: ICluster[] = [];

  try {
    const recentReports = (await Report.find({
      reportedAt: { $gte: windowStart },
      status: { $ne: 'rejected' },
      category: { $in: CLUSTER_CATEGORIES },
    })
      .select(
        '_id category symptoms sickCount severity geom location kelurahanId gridCellId reportedAt'
      )
      .lean()) as unknown as LeanClusterReportDoc[];

    for (const report of recentReports) {
      if (report.category === 'ispa') {
        reportsByCategory.ispa.push(report);
      } else if (report.category === 'diare') {
        reportsByCategory.diare.push(report);
      }
    }

    const totalReportsFetched =
      reportsByCategory.ispa.length + reportsByCategory.diare.length;
    const ispaReportCount = reportsByCategory.ispa.length;
    const diareReportCount = reportsByCategory.diare.length;

    if (ispaReportCount >= DBSCAN_MIN_POINTS || diareReportCount >= DBSCAN_MIN_POINTS) {
      gridSnapshots = await preloadGridAqiSnapshots();
    }

    const clustersByCategory = {
      ispa: 0,
      diare: 0,
    };

    for (const category of CLUSTER_CATEGORIES) {
      const categoryReports = reportsByCategory[category];
      if (categoryReports.length < DBSCAN_MIN_POINTS) {
        continue;
      }

      const pointFeatures: Array<Feature<Point, DbscanReportPointProps>> = [];

      for (const doc of categoryReports) {
        const rawGeo =
          doc.geom?.coordinates?.length === 2 ? doc.geom : doc.location;
        if (
          !rawGeo ||
          !Array.isArray(rawGeo.coordinates) ||
          rawGeo.coordinates.length !== 2
        ) {
          continue;
        }

        const lng = Number(rawGeo.coordinates[0]);
        const lat = Number(rawGeo.coordinates[1]);
        if (
          !Number.isFinite(lng) ||
          !Number.isFinite(lat) ||
          lng < -180 ||
          lng > 180 ||
          lat < -90 ||
          lat > 90
        ) {
          continue;
        }

        pointFeatures.push(
          point([lng, lat], {
            reportId: doc._id.toString(),
            category,
            sickCount:
              typeof doc.sickCount === 'number' && doc.sickCount > 0
                ? doc.sickCount
                : 1,
            symptoms: Array.isArray(doc.symptoms) ? doc.symptoms : [],
            ...(doc.kelurahanId ? { kelurahanId: doc.kelurahanId.toString() } : {}),
            ...(doc.gridCellId ? { gridCellId: doc.gridCellId.toString() } : {}),
            reportedAtMs:
              doc.reportedAt instanceof Date
                ? doc.reportedAt.getTime()
                : new Date(doc.reportedAt ?? now).getTime(),
          })
        );
      }

      if (pointFeatures.length < DBSCAN_MIN_POINTS) {
        pointFeatures.length = 0;
        continue;
      }

      const fc: FeatureCollection<Point, DbscanReportPointProps> =
        featureCollection(pointFeatures);

      const clusteredFc = clustersDbscan(fc, DBSCAN_MAX_DISTANCE_KM, {
        units: 'kilometers',
        minPoints: DBSCAN_MIN_POINTS,
        mutate: true,
      });

      const groupedClusters = new Map<
        number,
        Array<Feature<Point, DbscanReportPointProps>>
      >();

      for (const feature of clusteredFc.features) {
        const clusterIdx = feature.properties?.cluster;
        const dbscanType = feature.properties?.dbscan;
        if (
          clusterIdx === undefined ||
          clusterIdx === null ||
          dbscanType === 'noise'
        ) {
          continue;
        }

        let bucket = groupedClusters.get(clusterIdx);
        if (!bucket) {
          bucket = [];
          groupedClusters.set(clusterIdx, bucket);
        }
        bucket.push(feature as Feature<Point, DbscanReportPointProps>);
      }

      for (const [, memberFeatures] of groupedClusters.entries()) {
        if (memberFeatures.length < DBSCAN_MIN_POINTS) {
          continue;
        }

        const { centerCoords, radiusMeters } =
          calculateCentroidAndRadius(memberFeatures);
        const boundaryPolygon = buildClusterBoundaryPolygon(
          memberFeatures,
          centerCoords,
          radiusMeters
        );

        const reportCount = memberFeatures.length;
        let totalSickCount = 0;
        let earliestReportMs = now.getTime();
        const reportObjectIds: Types.ObjectId[] = [];
        const kelurahanFreq = new Map<string, number>();

        for (const feat of memberFeatures) {
          const props = feat.properties;
          totalSickCount += props.sickCount || 1;
          if (props.reportedAtMs < earliestReportMs) {
            earliestReportMs = props.reportedAtMs;
          }
          if (Types.ObjectId.isValid(props.reportId)) {
            reportObjectIds.push(new Types.ObjectId(props.reportId));
          }
          if (props.kelurahanId && Types.ObjectId.isValid(props.kelurahanId)) {
            kelurahanFreq.set(
              props.kelurahanId,
              (kelurahanFreq.get(props.kelurahanId) ?? 0) + 1
            );
          }
        }

        let majorityKelurahanId: Types.ObjectId | undefined;
        let maxKelCount = 0;
        for (const [kelIdStr, freq] of kelurahanFreq.entries()) {
          if (freq > maxKelCount) {
            maxKelCount = freq;
            majorityKelurahanId = new Types.ObjectId(kelIdStr);
          }
        }
        kelurahanFreq.clear();

        const { averageAqi, kelurahanId } = await resolveClusterAqiAndKelurahan(
          centerCoords,
          gridSnapshots,
          majorityKelurahanId
        );

        const dominantSymptoms = extractDominantSymptoms(memberFeatures);
        const riskEvaluation = evaluateClusterRisk({
          category,
          reportCount,
          totalSickCount,
          averageAqi,
        });

        const deterministicCode = buildDeterministicClusterCode(
          category,
          centerCoords
        );

        const existingNearbyCluster = await Cluster.findOne({
          $or: [
            { clusterCode: deterministicCode },
            {
              category,
              status: { $in: ['active', 'monitoring'] },
              center: {
                $near: {
                  $geometry: {
                    type: 'Point',
                    coordinates: centerCoords,
                  },
                  $maxDistance: DBSCAN_MAX_DISTANCE_METERS,
                },
              },
            },
          ],
        }).select('_id clusterCode firstDetectedAt status');

        const targetClusterCode =
          existingNearbyCluster?.clusterCode ?? deterministicCode;
        const firstDetectedAt =
          existingNearbyCluster?.firstDetectedAt ?? new Date(earliestReportMs);
        const nextStatus =
          existingNearbyCluster?.status === 'monitoring'
            ? 'monitoring'
            : 'active';

        const upsertedCluster = await Cluster.findOneAndUpdate(
          { clusterCode: targetClusterCode },
          {
            $set: {
              category,
              ...(kelurahanId ? { kelurahanId } : {}),
              center: {
                type: 'Point',
                coordinates: centerCoords,
              },
              boundary: boundaryPolygon,
              radiusMeters,
              reportCount,
              totalSickCount,
              reportIds: reportObjectIds,
              averageAqi,
              dominantSymptoms,
              riskStatus: riskEvaluation.riskStatus,
              riskColor: riskEvaluation.riskColor,
              colorHex: riskEvaluation.colorHex,
              riskLevel: riskEvaluation.riskLevel,
              status: nextStatus,
              lastUpdatedAt: now,
            },
            $setOnInsert: {
              firstDetectedAt,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        if (upsertedCluster) {
          activeClusterObjectIds.push(upsertedCluster._id);
          upsertedClusters.push(upsertedCluster);
          clustersByCategory[category] += 1;

          if (reportObjectIds.length > 0) {
            await Report.updateMany(
              { _id: { $in: reportObjectIds } },
              { $set: { clusterId: upsertedCluster._id } }
            );
          }
        }
      }

      groupedClusters.clear();
      pointFeatures.length = 0;
    }

    const staleResolveResult = await Cluster.updateMany(
      {
        status: 'active',
        ...(activeClusterObjectIds.length > 0
          ? { _id: { $nin: activeClusterObjectIds } }
          : {}),
        lastUpdatedAt: { $lt: now },
      },
      {
        $set: {
          status: 'resolved',
          lastUpdatedAt: now,
        },
      }
    );

    const resolvedStaleCount = staleResolveResult.modifiedCount ?? 0;
    const hasDatabaseChanges =
      upsertedClusters.length > 0 || resolvedStaleCount > 0;

    if (hasDatabaseChanges) {
      await invalidateMapCacheAfterClusterUpsert();
    }

    return {
      windowStartIso: windowStart.toISOString(),
      windowEndIso: now.toISOString(),
      totalReportsFetched,
      reportsByCategory: {
        ispa: ispaReportCount,
        diare: diareReportCount,
      },
      clustersDetected: upsertedClusters.length,
      clustersByCategory,
      upsertedClusterIds: upsertedClusters.map((c) => c._id.toString()),
      resolvedStaleCount,
      cacheInvalidated: hasDatabaseChanges,
      clusters: upsertedClusters,
    };
  } finally {
    reportsByCategory.ispa.length = 0;
    reportsByCategory.diare.length = 0;
    gridSnapshots.length = 0;
    activeClusterObjectIds.length = 0;
  }
};

export interface ClusterQueryFilter {
  category?: string;
  kategori?: string;
  riskStatus?: string;
  status?: string;
  kelurahanId?: string;
}

export const listClusters = async (filter: ClusterQueryFilter = {}) => {
  const query: Record<string, unknown> = {};

  const category = (filter.category ?? filter.kategori ?? '').trim().toLowerCase();
  if (category === 'ispa' || category === 'diare') {
    query.category = category;
  }

  const riskStatus = (filter.riskStatus ?? '').trim();
  if (['Waspada', 'Siaga', 'Prioritas'].includes(riskStatus)) {
    query.riskStatus = riskStatus;
  }

  const status = (filter.status ?? '').trim().toLowerCase();
  if (['active', 'monitoring', 'resolved'].includes(status)) {
    query.status = status;
  } else if (!filter.status) {
    query.status = { $in: ['active', 'monitoring'] };
  }

  if (filter.kelurahanId && Types.ObjectId.isValid(filter.kelurahanId.trim())) {
    query.kelurahanId = new Types.ObjectId(filter.kelurahanId.trim());
  }

  return Cluster.find(query)
    .populate('kelurahanId', 'code name kecamatan kota provinsi')
    .populate('assignedOfficerId', 'name email role phone')
    .sort({ lastUpdatedAt: -1 })
    .lean();
};

export const getClusterByIdOrCode = async (idOrCode: string) => {
  const trimmed = idOrCode.trim();
  const query = Types.ObjectId.isValid(trimmed)
    ? { _id: new Types.ObjectId(trimmed) }
    : { clusterCode: trimmed.toUpperCase() };

  return Cluster.findOne(query)
    .populate('kelurahanId', 'code name kecamatan kota provinsi')
    .populate('assignedOfficerId', 'name email role phone')
    .lean();
};
