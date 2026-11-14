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
  type ClusterStatus,
  type ICluster,
} from '../models/Cluster.js';
import { Report, type CitizenReportCategory } from '../models/Report.js';
import { GridCell } from '../models/GridCell.js';
import { AqiReading } from '../models/AqiReading.js';
import { Kelurahan } from '../models/Kelurahan.js';
import { Officer } from '../models/Officer.js';
import type { IGeoPoint, IGeoPolygon } from '../models/GeoJSON.js';
import { calculateDistanceMeters, readGridAqiFromRedis } from './aqiService.js';
import { invalidateClusterSummaryCache } from './aiService.js';
import {
  buildFilterCacheKey,
  getCache,
  setCache,
  deleteCache,
  delCache,
} from '../utils/cache.js';
import { AppError } from '../utils/AppError.js';
import type { JwtOfficerPayload } from '../utils/jwt.js';
import {
  emitClusterDetected,
  emitClusterUpdated,
  SOCKET_EVENTS,
  type SocketClusterItem,
} from '../config/socket.js';
export const CLUSTER_TIME_WINDOW_HOURS = 72;
export const CLUSTER_CRON_SCHEDULE = '* * * * *';
export const DBSCAN_MAX_DISTANCE_KM = 0.5;
export const DBSCAN_MAX_DISTANCE_METERS = DBSCAN_MAX_DISTANCE_KM * 1000;
export const DBSCAN_MIN_POINTS = 5;
export const CLUSTER_CATEGORIES: readonly ClusterCategory[] = ['ispa', 'diare'] as const;
export const MAP_CACHE_PATTERNS: readonly string[] = ['map_cache:*', 'map:public:*'] as const;
export const CLUSTER_LIST_CACHE_PREFIX = 'clusters:list';
export const CLUSTER_LIST_CACHE_PATTERN = `${CLUSTER_LIST_CACHE_PREFIX}:*`;
export const CLUSTER_DETAIL_CACHE_PREFIX = 'clusters:detail';
export const CLUSTER_DETAIL_CACHE_PATTERN = `${CLUSTER_DETAIL_CACHE_PREFIX}:*`;
export const CLUSTER_CACHE_TTL_SECONDS = 300;
export interface LeanClusterReportDoc {
  _id: Types.ObjectId;
  category: CitizenReportCategory;
  symptoms?: string[];
  sickCount?: number;
  severity?: string;
  ageGroups?: string[];
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
  severity: string;
  ageGroups: string[];
  kelurahanId?: string;
  startDate?: string;
  endDate?: string;
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
  hasSevereSymptoms?: boolean;
  vulnerableGroupDominant?: boolean;
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
  const isSiaga =
    reportCount >= 10 ||
    (reportCount >= DBSCAN_MIN_POINTS && safeAqi > 100);
  if (isSiaga) {
    if (input.hasSevereSymptoms || input.vulnerableGroupDominant) {
      return {
        riskStatus: 'Prioritas',
        riskColor: 'Merah',
        colorHex: '#EF4444',
        riskLevel: 'outbreak',
      };
    }
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
export const buildClusterDetailCacheKey = (idOrCode: string): string =>
  `${CLUSTER_DETAIL_CACHE_PREFIX}:${idOrCode.trim().toLowerCase()}`;
export const toSocketClusterItem = (
  cluster: ICluster | Record<string, unknown> | unknown
): SocketClusterItem => {
  const raw = (cluster ?? {}) as Record<string, unknown>;
  const rawId = raw._id ? String(raw._id) : String(raw.id ?? '');
  const rawKelurahan = raw.kelurahanId as
    | { _id?: Types.ObjectId }
    | Types.ObjectId
    | string
    | undefined;
  const kelurahanIdStr =
    rawKelurahan && typeof rawKelurahan === 'object' && '_id' in rawKelurahan && rawKelurahan._id
      ? rawKelurahan._id.toString()
      : rawKelurahan
        ? String(rawKelurahan)
        : undefined;
  const rawOfficer = raw.assignedOfficerId as
    | { _id?: Types.ObjectId }
    | Types.ObjectId
    | string
    | undefined;
  const assignedOfficerIdStr =
    rawOfficer && typeof rawOfficer === 'object' && '_id' in rawOfficer && rawOfficer._id
      ? rawOfficer._id.toString()
      : rawOfficer
        ? String(rawOfficer)
        : undefined;
  const firstDetectedAt =
    raw.firstDetectedAt instanceof Date
      ? raw.firstDetectedAt.toISOString()
      : new Date(String(raw.firstDetectedAt ?? Date.now())).toISOString();
  const lastUpdatedAt =
    raw.lastUpdatedAt instanceof Date
      ? raw.lastUpdatedAt.toISOString()
      : new Date(String(raw.lastUpdatedAt ?? Date.now())).toISOString();
  return {
    id: rawId,
    clusterCode: String(raw.clusterCode ?? ''),
    category: (raw.category as ClusterCategory) ?? 'ispa',
    ...(kelurahanIdStr ? { kelurahanId: kelurahanIdStr } : {}),
    center: raw.center as IGeoPoint,
    ...(raw.boundary ? { boundary: raw.boundary as IGeoPolygon } : {}),
    radiusMeters: Number(raw.radiusMeters ?? 100),
    reportCount: Number(raw.reportCount ?? 1),
    totalSickCount: Number(raw.totalSickCount ?? 1),
    ...(typeof raw.averageAqi === 'number' ? { averageAqi: raw.averageAqi } : {}),
    dominantSymptoms: Array.isArray(raw.dominantSymptoms)
      ? (raw.dominantSymptoms as string[])
      : [],
    riskStatus: (raw.riskStatus as ClusterRiskStatus) ?? 'Waspada',
    riskColor: (raw.riskColor as ClusterRiskColor) ?? 'Kuning',
    colorHex: String(raw.colorHex ?? '#EAB308'),
    riskLevel: (raw.riskLevel as ClusterLegacyRiskLevel) ?? 'moderate',
    status: (raw.status as ClusterStatus) ?? 'active',
    ...(assignedOfficerIdStr ? { assignedOfficerId: assignedOfficerIdStr } : {}),
    firstDetectedAt,
    lastUpdatedAt,
  };
};
export const invalidateClusterCaches = async (
  clusterId?: string,
  clusterCode?: string
): Promise<void> => {
  const detailKeysToDelete: string[] = [];
  if (clusterId) {
    detailKeysToDelete.push(buildClusterDetailCacheKey(clusterId));
  }
  if (clusterCode) {
    detailKeysToDelete.push(buildClusterDetailCacheKey(clusterCode));
  }
  await Promise.all([
    detailKeysToDelete.length > 0
      ? deleteCache(...detailKeysToDelete)
      : delCache(CLUSTER_DETAIL_CACHE_PATTERN),
    invalidateClusterSummaryCache(clusterId, clusterCode),
    delCache(CLUSTER_LIST_CACHE_PATTERN),
    ...MAP_CACHE_PATTERNS.map((pattern) => delCache(pattern)),
  ]);
};
export const invalidateMapCacheAfterClusterUpsert = async (): Promise<void> => {
  await invalidateClusterCaches();
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
        '_id category symptoms sickCount severity ageGroups geom location kelurahanId gridCellId reportedAt'
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
            severity: String(doc.severity ?? 'sedang').toLowerCase(),
            ageGroups: Array.isArray(doc.ageGroups) ? doc.ageGroups : [],
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
        const vulnerableReportCount = memberFeatures.filter((feature) =>
          feature.properties.ageGroups.some((group) =>
            ['balita', 'lansia'].includes(group.toLowerCase())
          )
        ).length;
        const hasSevereSymptoms = memberFeatures.some((feature) => {
          const props = feature.properties;
          return (
            ['berat', 'kritis', 'severe', 'critical'].includes(props.severity) ||
            props.symptoms.some((symptom) => /sesak|dehidras/i.test(symptom))
          );
        });
        const riskEvaluation = evaluateClusterRisk({
          category,
          reportCount,
          totalSickCount,
          averageAqi,
          hasSevereSymptoms,
          vulnerableGroupDominant:
            vulnerableReportCount >= Math.ceil(reportCount / 2),
        });
        const deterministicCode = buildDeterministicClusterCode(
          category,
          centerCoords
        );
        let existingNearbyCluster = await Cluster.findOne({
          clusterCode: deterministicCode,
        }).select('_id clusterCode firstDetectedAt status');
        if (!existingNearbyCluster) {
          existingNearbyCluster = await Cluster.findOne({
            category,
            status: { $in: ['active', 'monitoring', 'verified'] },
            center: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: centerCoords,
                },
                $maxDistance: DBSCAN_MAX_DISTANCE_METERS,
              },
            },
          }).select('_id clusterCode firstDetectedAt status');
        }
        const targetClusterCode =
          existingNearbyCluster?.clusterCode ?? deterministicCode;
        const firstDetectedAt =
          existingNearbyCluster?.firstDetectedAt ?? new Date(earliestReportMs);
        const nextStatus =
          existingNearbyCluster?.status === 'resolved'
            ? 'active'
            : existingNearbyCluster?.status ?? 'active';
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
            returnDocument: 'after',
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
      if (upsertedClusters.length > 0) {
        emitClusterDetected({
          event: SOCKET_EVENTS.CLUSTER_DETECTED,
          clustersDetected: upsertedClusters.length,
          clustersByCategory,
          upsertedClusterIds: upsertedClusters.map((c) => c._id.toString()),
          resolvedStaleCount,
          clusters: upsertedClusters.map((c) => toSocketClusterItem(c)),
          detectedAt: now.toISOString(),
        });
      }
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
  level?: string;
  riskLevel?: string;
  riskStatus?: string;
  status?: string;
  kelurahanId?: string;
  startDate?: string;
  endDate?: string;
}
export interface UpdateClusterStatusInput {
  status?: string;
  assignedOfficerId?: string | null;
}
const RISK_STATUS_CANONICAL_MAP: Record<string, ClusterRiskStatus> = {
  waspada: 'Waspada',
  siaga: 'Siaga',
  prioritas: 'Prioritas',
};
const VALID_LEGACY_RISK_LEVELS: readonly ClusterLegacyRiskLevel[] = [
  'low',
  'moderate',
  'high',
  'outbreak',
] as const;
const VALID_CLUSTER_STATUSES: readonly ClusterStatus[] = [
  'active',
  'monitoring',
  'verified',
  'resolved',
] as const;
export const listClusters = async (filter: ClusterQueryFilter = {}) => {
  const query: Record<string, unknown> = {};
  const category = (filter.category ?? filter.kategori ?? '').trim().toLowerCase();
  if (category) {
    if (category !== 'ispa' && category !== 'diare') {
      throw new AppError(
        "Filter kategori klaster tidak valid. Gunakan 'ispa' atau 'diare'.",
        400
      );
    }
    query.category = category;
  }
  const rawLevel = (
    filter.level ??
    filter.riskLevel ??
    filter.riskStatus ??
    ''
  )
    .trim()
    .toLowerCase();
  let normalizedLevelCacheToken: string | undefined;
  if (rawLevel) {
    if (RISK_STATUS_CANONICAL_MAP[rawLevel]) {
      query.riskStatus = RISK_STATUS_CANONICAL_MAP[rawLevel];
      normalizedLevelCacheToken = rawLevel;
    } else if (
      VALID_LEGACY_RISK_LEVELS.includes(rawLevel as ClusterLegacyRiskLevel)
    ) {
      query.riskLevel = rawLevel as ClusterLegacyRiskLevel;
      normalizedLevelCacheToken = rawLevel;
    } else {
      throw new AppError(
        "Filter level/risiko klaster tidak valid. Gunakan 'Waspada', 'Siaga', 'Prioritas' atau 'low', 'moderate', 'high', 'outbreak'.",
        400
      );
    }
  }
  const rawStatus = (filter.status ?? '').trim().toLowerCase();
  let normalizedStatusCacheToken = 'default_active_monitoring';
  if (rawStatus) {
    if (rawStatus === 'all') {
      normalizedStatusCacheToken = 'all';
    } else if (VALID_CLUSTER_STATUSES.includes(rawStatus as ClusterStatus)) {
      query.status = rawStatus as ClusterStatus;
      normalizedStatusCacheToken = rawStatus;
    } else {
      throw new AppError(
        "Filter status klaster tidak valid. Gunakan 'active', 'monitoring', 'verified', 'resolved', atau 'all'.",
        400
      );
    }
  } else {
    query.status = { $in: ['active', 'monitoring', 'verified'] };
  }
  let normalizedKelurahanId: string | undefined;
  if (filter.kelurahanId && filter.kelurahanId.trim() !== '') {
    const trimmedKel = filter.kelurahanId.trim();
    if (!Types.ObjectId.isValid(trimmedKel)) {
      throw new AppError('Format parameter kelurahanId tidak valid.', 400);
    }
    query.kelurahanId = new Types.ObjectId(trimmedKel);
    normalizedKelurahanId = trimmedKel;
  }
  const dateRange: Record<string, Date> = {};
  if (filter.startDate) {
    const startDate = new Date(filter.startDate);
    if (!Number.isFinite(startDate.getTime())) {
      throw new AppError('Format parameter startDate tidak valid.', 400);
    }
    dateRange.$gte = startDate;
  }
  if (filter.endDate) {
    const endDate = new Date(filter.endDate);
    if (!Number.isFinite(endDate.getTime())) {
      throw new AppError('Format parameter endDate tidak valid.', 400);
    }
    dateRange.$lte = endDate;
  }
  if (Object.keys(dateRange).length > 0) {
    query.lastUpdatedAt = dateRange;
  }
  const cacheKey = buildFilterCacheKey(CLUSTER_LIST_CACHE_PREFIX, {
    category: category || undefined,
    level: normalizedLevelCacheToken,
    status: normalizedStatusCacheToken,
    kelurahanId: normalizedKelurahanId,
    startDate: filter.startDate,
    endDate: filter.endDate,
  });
  const cachedClusters = await getCache<unknown[]>(cacheKey);
  if (cachedClusters) {
    return cachedClusters;
  }
  const clusters = await Cluster.find(query)
    .populate('kelurahanId', 'code name kecamatan kota provinsi')
    .populate('assignedOfficerId', 'name email role phone')
    .sort({ lastUpdatedAt: -1 })
    .lean();
  await setCache(cacheKey, clusters, CLUSTER_CACHE_TTL_SECONDS);
  return clusters;
};
export const getClusterByIdOrCode = async (idOrCode: string) => {
  const trimmed = idOrCode.trim();
  const requestedCacheKey = buildClusterDetailCacheKey(trimmed);
  const cachedCluster = await getCache<Record<string, unknown>>(requestedCacheKey);
  if (cachedCluster) {
    return cachedCluster;
  }
  const query = Types.ObjectId.isValid(trimmed)
    ? { _id: new Types.ObjectId(trimmed) }
    : { clusterCode: trimmed.toUpperCase() };
  const cluster = await Cluster.findOne(query)
    .populate('kelurahanId', 'code name kecamatan kota provinsi')
    .populate('assignedOfficerId', 'name email role phone')
    .lean();
  if (!cluster) {
    return null;
  }
  const idCacheKey = buildClusterDetailCacheKey(cluster._id.toString());
  const codeCacheKey = buildClusterDetailCacheKey(cluster.clusterCode);
  await Promise.all([
    setCache(idCacheKey, cluster, CLUSTER_CACHE_TTL_SECONDS),
    idCacheKey !== codeCacheKey
      ? setCache(codeCacheKey, cluster, CLUSTER_CACHE_TTL_SECONDS)
      : Promise.resolve(),
  ]);
  return cluster;
};
export const getClusterReportTrend = async (idOrCode: string) => {
  const trimmed = idOrCode.trim();
  const query = Types.ObjectId.isValid(trimmed)
    ? { _id: new Types.ObjectId(trimmed) }
    : { clusterCode: trimmed.toUpperCase() };
  const cluster = await Cluster.findOne(query).select('_id').lean();
  if (!cluster) {
    throw new AppError('Data klaster tidak ditemukan.', 404);
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  const dailyCounts = await Report.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        clusterId: cluster._id,
        reportedAt: { $gte: startDate },
        status: { $ne: 'rejected' },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$reportedAt',
            timezone: 'UTC',
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);
  const countsByDate = new Map(
    dailyCounts.map((item) => [item._id, item.count])
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    const dateKey = date.toISOString().slice(0, 10);
    return {
      date: dateKey,
      count: countsByDate.get(dateKey) ?? 0,
    };
  });
  return { days, generatedAt: new Date().toISOString() };
};
export const updateClusterStatus = async (
  idOrCode: string,
  input: UpdateClusterStatusInput,
  officer?: JwtOfficerPayload
) => {
  const trimmed = idOrCode.trim();
  if (!trimmed) {
    throw new AppError('Parameter ID atau kode klaster wajib disertakan.', 400);
  }
  const rawStatus = (input.status ?? '').toString().trim().toLowerCase();
  if (!VALID_CLUSTER_STATUSES.includes(rawStatus as ClusterStatus)) {
    throw new AppError(
      `Status penanganan klaster tidak valid. Pilihan yang diperbolehkan: ${VALID_CLUSTER_STATUSES.join(', ')}.`,
      400
    );
  }
  const nextStatus = rawStatus as ClusterStatus;
  const lookupQuery = Types.ObjectId.isValid(trimmed)
    ? { _id: new Types.ObjectId(trimmed) }
    : { clusterCode: trimmed.toUpperCase() };
  const existingCluster = await Cluster.findOne(lookupQuery);
  if (!existingCluster) {
    throw new AppError('Data klaster tidak ditemukan.', 404);
  }
  const previousStatus: ClusterStatus = existingCluster.status;
  existingCluster.status = nextStatus;
  existingCluster.lastUpdatedAt = new Date();
  if (input.assignedOfficerId !== undefined) {
    if (input.assignedOfficerId === null || String(input.assignedOfficerId).trim() === '') {
      existingCluster.set('assignedOfficerId', undefined);
    } else {
      const targetOfficerId = String(input.assignedOfficerId).trim();
      if (!Types.ObjectId.isValid(targetOfficerId)) {
        throw new AppError('Format assignedOfficerId tidak valid.', 400);
      }
      const officerExists = await Officer.findById(targetOfficerId).select('_id').lean();
      if (!officerExists) {
        throw new AppError('Petugas yang ditugaskan tidak ditemukan.', 404);
      }
      existingCluster.assignedOfficerId = new Types.ObjectId(targetOfficerId);
    }
  } else if (
    !existingCluster.assignedOfficerId &&
    officer?.officerId &&
    Types.ObjectId.isValid(officer.officerId)
  ) {
    existingCluster.assignedOfficerId = new Types.ObjectId(officer.officerId);
  }
  await existingCluster.save();
  if (existingCluster.reportIds && existingCluster.reportIds.length > 0) {
    const mappedReportStatus =
      nextStatus === 'resolved'
        ? 'resolved'
        : nextStatus === 'verified'
          ? 'verified'
          : nextStatus === 'monitoring'
            ? 'in_progress'
          : undefined;
    if (mappedReportStatus) {
      await Report.updateMany(
        {
          _id: { $in: existingCluster.reportIds },
          status: { $ne: 'rejected' },
        },
        {
          $set: { status: mappedReportStatus },
        }
      );
    }
  }
  const clusterIdStr = existingCluster._id.toString();
  const clusterCodeStr = existingCluster.clusterCode;
  await invalidateClusterCaches(clusterIdStr, clusterCodeStr);
  const populatedCluster = await Cluster.findById(existingCluster._id)
    .populate('kelurahanId', 'code name kecamatan kota provinsi')
    .populate('assignedOfficerId', 'name email role phone')
    .lean();
  const finalCluster = populatedCluster ?? existingCluster.toObject();
  emitClusterUpdated({
    event: SOCKET_EVENTS.CLUSTER_UPDATED,
    clusterId: clusterIdStr,
    clusterCode: clusterCodeStr,
    previousStatus,
    status: nextStatus,
    riskStatus: existingCluster.riskStatus,
    riskLevel: existingCluster.riskLevel,
    ...(existingCluster.assignedOfficerId
      ? { assignedOfficerId: existingCluster.assignedOfficerId.toString() }
      : {}),
    ...(officer
      ? {
          updatedBy: {
            officerId: officer.officerId,
            email: officer.email,
            role: officer.role,
          },
        }
      : {}),
    cluster: toSocketClusterItem(finalCluster),
    updatedAt: existingCluster.lastUpdatedAt.toISOString(),
  });
  return finalCluster;
};
