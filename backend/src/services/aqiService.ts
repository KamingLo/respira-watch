import { Types } from 'mongoose';
import { redisClient } from '../config/redis.js';
import { AqiReading, type AqiCategory, type IAqiReading } from '../models/AqiReading.js';
import { GridCell, type IGridCell } from '../models/GridCell.js';
import { Kelurahan } from '../models/Kelurahan.js';
import type { IGeoPoint, IGeoPolygon } from '../models/GeoJSON.js';
import { AppError } from '../utils/AppError.js';
import { isRedisReady } from '../utils/cache.js';

export const AQI_GRID_CACHE_PREFIX = 'aqi:grid';
export const AQI_GRID_CACHE_TTL_SECONDS = 2 * 60 * 60;
export const OPEN_METEO_AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export interface OpenMeteoAirQualityApiResponse {
  latitude: number;
  longitude: number;
  timezone?: string;
  current_units?: {
    time?: string;
    pm2_5?: string;
    pm10?: string;
    us_aqi?: string;
    european_aqi?: string;
    carbon_monoxide?: string;
    nitrogen_dioxide?: string;
    sulphur_dioxide?: string;
    ozone?: string;
  };
  current?: {
    time?: string;
    interval?: number;
    pm2_5?: number | null;
    pm10?: number | null;
    us_aqi?: number | null;
    european_aqi?: number | null;
    carbon_monoxide?: number | null;
    nitrogen_dioxide?: number | null;
    sulphur_dioxide?: number | null;
    ozone?: number | null;
  };
}

export interface OpenMeteoNormalizedReading {
  aqi: number;
  pm25: number;
  pm10: number;
  co?: number;
  no2?: number;
  so2?: number;
  o3?: number;
  dominantPollutant: 'PM2.5' | 'PM10' | 'CO' | 'NO2' | 'SO2' | 'O3';
  category: AqiCategory;
  riskLevel: IGridCell['riskLevel'];
  recordedAt: Date;
}

export interface AreaStatusInfo {
  category: AqiCategory;
  riskLevel: IGridCell['riskLevel'];
  statusLabel: string;
  colorHex: string;
  isSafeForOutdoor: boolean;
  healthRecommendation: string;
  sensitiveGroupWarning: string;
}

export interface CachedGridAqiPayload {
  gridId: string;
  cellCode: string;
  aqi: number;
  pm25: number;
  pm10: number;
  pollutants: {
    pm25: number;
    pm10: number;
    co?: number;
    no2?: number;
    so2?: number;
    o3?: number;
  };
  dominantPollutant: 'PM2.5' | 'PM10' | 'CO' | 'NO2' | 'SO2' | 'O3';
  category: AqiCategory;
  riskLevel: IGridCell['riskLevel'];
  source: IAqiReading['source'];
  recordedAt: string;
  cachedAt: string;
}

export interface AqiResultCardResponse {
  grid_id: string;
  cellCode: string;
  queryCoordinates: {
    lat: number;
    lng: number;
  };
  gridCentroid: {
    lat: number;
    lng: number;
  };
  distanceMeters: number;
  kelurahan: {
    id: string;
    code?: string;
    name?: string;
    kecamatan?: string;
    kota?: string;
    provinsi?: string;
  } | null;
  weatherAqi: {
    aqi: number;
    pm25: number;
    pm10: number;
    pollutants: {
      pm25: number;
      pm10: number;
      co?: number;
      no2?: number;
      so2?: number;
      o3?: number;
    };
    dominantPollutant: 'PM2.5' | 'PM10' | 'CO' | 'NO2' | 'SO2' | 'O3';
    recordedAt: string;
    source: string;
  };
  areaStatus: AreaStatusInfo & {
    activeReportCount: number;
    vulnerabilityIndex: number;
  };
  cacheMeta: {
    key: string;
    hit: boolean;
    source: 'redis' | 'mongodb_fallback' | 'open_meteo_live';
    ttlSeconds: number;
  };
}

export interface AqiGridMapItem {
  gridId: string;
  cellCode: string;
  geometry: IGeoPolygon;
  aqi: number;
  pm25: number;
  pm10: number;
  category: AqiCategory;
  statusLabel: string;
  colorHex: string;
  recordedAt: string;
  source: string;
}

export interface AqiTrendDay {
  date: string;
  averageAqi: number | null;
  averagePm25: number | null;
  averagePm10: number | null;
  readingCount: number;
}

export interface AqiTrendResponse {
  days: number;
  items: AqiTrendDay[];
  generatedAt: string;
}

export const buildGridAqiCacheKey = (gridId: string): string =>
  `${AQI_GRID_CACHE_PREFIX}:${gridId.trim()}`;

export const calculateAqiFromPm25 = (pm25: number): number => {
  const c = Math.max(0, pm25);
  const breakpoints: Array<[number, number, number, number]> = [
    [0.0, 12.0, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 500.4, 301, 500],
  ];

  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (c <= cHigh) {
      const clampedC = Math.max(cLow, c);
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (clampedC - cLow) + iLow);
    }
  }

  return 500;
};

export const resolveAreaStatusFromAqi = (aqi: number): AreaStatusInfo => {
  if (aqi <= 50) {
    return {
      category: 'baik',
      riskLevel: 'safe',
      statusLabel: 'Baik (Aman)',
      colorHex: '#10B981',
      isSafeForOutdoor: true,
      healthRecommendation:
        'Kualitas udara sangat baik. Aman untuk melakukan aktivitas fisik di luar ruangan.',
      sensitiveGroupWarning: 'Tidak ada pembatasan aktivitas bagi kelompok sensitif.',
    };
  }

  if (aqi <= 100) {
    return {
      category: 'sedang',
      riskLevel: 'moderate',
      statusLabel: 'Sedang (Moderat)',
      colorHex: '#F59E0B',
      isSafeForOutdoor: true,
      healthRecommendation:
        'Kualitas udara masih dapat diterima. Warga umum dapat beraktivitas di luar ruangan seperti biasa.',
      sensitiveGroupWarning:
        'Individu yang sangat sensitif terhadap polusi udara disarankan mengurangi aktivitas berat yang terlalu lama di luar ruangan.',
    };
  }

  if (aqi <= 150) {
    return {
      category: 'tidak_sehat_bagi_kelompok_sensitif',
      riskLevel: 'unhealthy',
      statusLabel: 'Tidak Sehat bagi Kelompok Sensitif',
      colorHex: '#F97316',
      isSafeForOutdoor: false,
      healthRecommendation:
        'Gunakan masker (KN95/KF94) saat beraktivitas di luar ruangan dan kurangi durasi paparan udara terbuka.',
      sensitiveGroupWarning:
        'Anak-anak, lansia, ibu hamil, dan penderita ISPA/asma wajib membatasi aktivitas di luar ruangan.',
    };
  }

  if (aqi <= 200) {
    return {
      category: 'tidak_sehat',
      riskLevel: 'unhealthy',
      statusLabel: 'Tidak Sehat',
      colorHex: '#EF4444',
      isSafeForOutdoor: false,
      healthRecommendation:
        'Hindari olahraga atau aktivitas fisik berat di luar ruangan. Gunakan masker pelindung dan nyalakan penjernih udara di dalam ruangan.',
      sensitiveGroupWarning:
        'Kelompok rentan (penderita ISPA, asma, penyakit jantung) harus tetap berada di dalam ruangan.',
    };
  }

  if (aqi <= 300) {
    return {
      category: 'sangat_tidak_sehat',
      riskLevel: 'very_unhealthy',
      statusLabel: 'Sangat Tidak Sehat',
      colorHex: '#8B5CF6',
      isSafeForOutdoor: false,
      healthRecommendation:
        'Peringatan kesehatan serius! Tutup jendela ruangan dan tunda seluruh kegiatan luar ruangan.',
      sensitiveGroupWarning:
        'Risiko tinggi kambuhnya gejala ISPA akut. Segera hubungi fasilitas kesehatan jika mengalami sesak napas.',
    };
  }

  return {
    category: 'berbahaya',
    riskLevel: 'hazardous',
    statusLabel: 'Berbahaya (Darurat Polusi)',
    colorHex: '#7F1D1D',
    isSafeForOutdoor: false,
    healthRecommendation:
      'Kondisi darurat kualitas udara! Seluruh warga dilarang beraktivitas di luar ruangan tanpa pelindung respirator standar medis.',
    sensitiveGroupWarning:
      'Evakuasi ke ruang bersih berfiltrasi udara dan siagakan layanan medis darurat.',
  };
};

export const calculateDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const earthRadiusMeters = 6_371_000;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
};

export const fetchOpenMeteoAirQuality = async (
  lat: number,
  lng: number
): Promise<OpenMeteoNormalizedReading> => {
  const url = new URL(OPEN_METEO_AIR_QUALITY_URL);
  url.searchParams.set('latitude', lat.toFixed(6));
  url.searchParams.set('longitude', lng.toFixed(6));
  url.searchParams.set(
    'current',
    'pm2_5,pm10,us_aqi,european_aqi,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone'
  );
  url.searchParams.set('timezone', 'Asia/Jakarta');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RespiraWatch-Backend/1.0',
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(
      `Open-Meteo API mengembalikan HTTP ${response.status} (${response.statusText}) untuk koordinat [${lat}, ${lng}]`
    );
  }

  const payload = (await response.json()) as OpenMeteoAirQualityApiResponse;
  const current = payload.current;

  if (!current) {
    throw new Error(
      `Respons Open-Meteo API tidak memuat objek 'current' untuk koordinat [${lat}, ${lng}]`
    );
  }

  const pm25 = Number(Math.max(0, Number(current.pm2_5 ?? 0)).toFixed(2));
  const pm10 = Number(Math.max(0, Number(current.pm10 ?? 0)).toFixed(2));
  const co =
    current.carbon_monoxide !== null && current.carbon_monoxide !== undefined
      ? Number(Math.max(0, Number(current.carbon_monoxide)).toFixed(2))
      : undefined;
  const no2 =
    current.nitrogen_dioxide !== null && current.nitrogen_dioxide !== undefined
      ? Number(Math.max(0, Number(current.nitrogen_dioxide)).toFixed(2))
      : undefined;
  const so2 =
    current.sulphur_dioxide !== null && current.sulphur_dioxide !== undefined
      ? Number(Math.max(0, Number(current.sulphur_dioxide)).toFixed(2))
      : undefined;
  const o3 =
    current.ozone !== null && current.ozone !== undefined
      ? Number(Math.max(0, Number(current.ozone)).toFixed(2))
      : undefined;

  const rawUsAqi = current.us_aqi ?? current.european_aqi;
  const aqi =
    rawUsAqi !== null && rawUsAqi !== undefined && Number.isFinite(Number(rawUsAqi))
      ? Math.max(0, Math.round(Number(rawUsAqi)))
      : calculateAqiFromPm25(pm25);

  const dominantPollutant: 'PM2.5' | 'PM10' = pm10 > pm25 * 2.5 ? 'PM10' : 'PM2.5';
  const statusInfo = resolveAreaStatusFromAqi(aqi);

  const recordedAt =
    current.time && !Number.isNaN(new Date(current.time).getTime())
      ? new Date(current.time)
      : new Date();

  return {
    aqi,
    pm25,
    pm10,
    ...(co !== undefined ? { co } : {}),
    ...(no2 !== undefined ? { no2 } : {}),
    ...(so2 !== undefined ? { so2 } : {}),
    ...(o3 !== undefined ? { o3 } : {}),
    dominantPollutant,
    category: statusInfo.category,
    riskLevel: statusInfo.riskLevel,
    recordedAt,
  };
};

export const ensureDefaultGridCells = async (): Promise<IGridCell[]> => {
  const existingCells = await GridCell.find().sort({ cellCode: 1 });
  if (existingCells.length > 0) {
    return existingCells;
  }

  const kelurahans = await Kelurahan.find().sort({ code: 1 });

  if (kelurahans.length > 0) {
    const cellsToCreate = kelurahans.map((kel, idx) => ({
      cellCode: `GRID-${kel.code.replace(/\./g, '-') || idx + 1}`,
      kelurahanId: kel._id,
      geometry: kel.boundary,
      centroid: kel.centroid,
      currentAqi: 50,
      dominantPollutant: 'PM2.5' as const,
      activeReportCount: 0,
      vulnerabilityIndex:
        kel.baselineRiskLevel === 'critical'
          ? 0.85
          : kel.baselineRiskLevel === 'high'
            ? 0.7
            : kel.baselineRiskLevel === 'moderate'
              ? 0.45
              : 0.2,
      riskLevel: 'safe' as const,
      lastCalculatedAt: new Date(),
    }));

    const created = await GridCell.insertMany(cellsToCreate, { ordered: false });
    console.log(`[AqiService] Berhasil menginisialisasi ${created.length} GridCell dari Kelurahan.`);
    return created;
  }

  const defaultStations: Array<{
    cellCode: string;
    lng: number;
    lat: number;
    vulnerabilityIndex: number;
  }> = [
    { cellCode: 'GRID-JKT-GAMBIR', lng: 106.827153, lat: -6.175392, vulnerabilityIndex: 0.45 },
    { cellCode: 'GRID-JKT-MANGGARAI', lng: 106.845599, lat: -6.208763, vulnerabilityIndex: 0.7 },
    { cellCode: 'GRID-JKT-SENAYAN', lng: 106.822745, lat: -6.229728, vulnerabilityIndex: 0.25 },
  ];

  const fallbackCells = defaultStations.map((st) => {
    const delta = 0.006;
    const geometry: IGeoPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [st.lng - delta, st.lat + delta],
          [st.lng + delta, st.lat + delta],
          [st.lng + delta, st.lat - delta],
          [st.lng - delta, st.lat - delta],
          [st.lng - delta, st.lat + delta],
        ],
      ],
    };
    const centroid: IGeoPoint = {
      type: 'Point',
      coordinates: [st.lng, st.lat],
    };

    return {
      cellCode: st.cellCode,
      geometry,
      centroid,
      currentAqi: 50,
      dominantPollutant: 'PM2.5' as const,
      activeReportCount: 0,
      vulnerabilityIndex: st.vulnerabilityIndex,
      riskLevel: 'safe' as const,
      lastCalculatedAt: new Date(),
    };
  });

  const createdFallback = await GridCell.insertMany(fallbackCells, { ordered: false });
  console.log(
    `[AqiService] Berhasil menginisialisasi ${createdFallback.length} GridCell default Jakarta.`
  );
  return createdFallback;
};

export const writeGridAqiToRedisSetex = async (
  gridId: string,
  payload: CachedGridAqiPayload
): Promise<void> => {
  if (!isRedisReady()) {
    return;
  }

  const cacheKey = buildGridAqiCacheKey(gridId);
  try {
    await redisClient.setex(cacheKey, AQI_GRID_CACHE_TTL_SECONDS, JSON.stringify(payload));
    console.log(
      `[Redis AQI] SETEX -> ${cacheKey} (AQI: ${payload.aqi}, TTL: ${AQI_GRID_CACHE_TTL_SECONDS}s)`
    );
  } catch (error) {
    console.warn(`[Redis AQI] Gagal melakukan SETEX untuk key "${cacheKey}":`, error);
  }
};

export const readGridAqiFromRedis = async (
  gridId: string
): Promise<CachedGridAqiPayload | null> => {
  if (!isRedisReady()) {
    return null;
  }

  const cacheKey = buildGridAqiCacheKey(gridId);
  try {
    const raw = await redisClient.get(cacheKey);
    if (!raw) {
      console.log(`[Redis AQI] MISS -> ${cacheKey}`);
      return null;
    }
    console.log(`[Redis AQI] HIT -> ${cacheKey}`);
    return JSON.parse(raw) as CachedGridAqiPayload;
  } catch (error) {
    console.warn(`[Redis AQI] Gagal membaca key "${cacheKey}" dari Redis:`, error);
    return null;
  }
};

export const syncSingleGridCellAqi = async (
  gridCell: IGridCell
): Promise<{ reading: IAqiReading; cachedPayload: CachedGridAqiPayload }> => {
  const [lng, lat] = gridCell.centroid.coordinates;
  const openMeteoData = await fetchOpenMeteoAirQuality(lat, lng);

  const gridIdStr = gridCell._id.toString();
  const stationCode = `OPENMETEO-${gridCell.cellCode}`;
  const stationName = `Open-Meteo Grid ${gridCell.cellCode}`;

  const cachePayload: CachedGridAqiPayload = {
    gridId: gridIdStr,
    cellCode: gridCell.cellCode,
    aqi: openMeteoData.aqi,
    pm25: openMeteoData.pm25,
    pm10: openMeteoData.pm10,
    pollutants: {
      pm25: openMeteoData.pm25,
      pm10: openMeteoData.pm10,
      ...(openMeteoData.co !== undefined ? { co: openMeteoData.co } : {}),
      ...(openMeteoData.no2 !== undefined ? { no2: openMeteoData.no2 } : {}),
      ...(openMeteoData.so2 !== undefined ? { so2: openMeteoData.so2 } : {}),
      ...(openMeteoData.o3 !== undefined ? { o3: openMeteoData.o3 } : {}),
    },
    dominantPollutant: openMeteoData.dominantPollutant,
    category: openMeteoData.category,
    riskLevel: openMeteoData.riskLevel,
    source: 'external_api',
    recordedAt: openMeteoData.recordedAt.toISOString(),
    cachedAt: new Date().toISOString(),
  };

  const [savedReading] = await Promise.all([
    AqiReading.create({
      stationCode,
      stationName,
      source: 'external_api',
      location: gridCell.centroid,
      ...(gridCell.kelurahanId ? { kelurahanId: gridCell.kelurahanId } : {}),
      gridCellId: gridCell._id,
      aqi: openMeteoData.aqi,
      category: openMeteoData.category,
      pollutants: {
        pm25: openMeteoData.pm25,
        pm10: openMeteoData.pm10,
        ...(openMeteoData.co !== undefined ? { co: openMeteoData.co } : {}),
        ...(openMeteoData.no2 !== undefined ? { no2: openMeteoData.no2 } : {}),
        ...(openMeteoData.so2 !== undefined ? { so2: openMeteoData.so2 } : {}),
        ...(openMeteoData.o3 !== undefined ? { o3: openMeteoData.o3 } : {}),
      },
      recordedAt: openMeteoData.recordedAt,
    }),
    GridCell.findByIdAndUpdate(gridCell._id, {
      $set: {
        currentAqi: openMeteoData.aqi,
        dominantPollutant: openMeteoData.dominantPollutant,
        riskLevel: openMeteoData.riskLevel,
        lastCalculatedAt: new Date(),
      },
    }),
    writeGridAqiToRedisSetex(gridIdStr, cachePayload),
  ]);

  return {
    reading: savedReading,
    cachedPayload: cachePayload,
  };
};

export const getNearestGridAqiByCoords = async (
  rawLat: unknown,
  rawLng: unknown
): Promise<AqiResultCardResponse> => {
  if (
    rawLat === undefined ||
    rawLat === null ||
    String(rawLat).trim() === '' ||
    rawLng === undefined ||
    rawLng === null ||
    String(rawLng).trim() === ''
  ) {
    throw new AppError(
      'Parameter query lat (latitude) dan lng (longitude) wajib disertakan.',
      400
    );
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new AppError(
      'Parameter lat (latitude) tidak valid. Nilai harus berupa angka di antara -90 hingga 90.',
      400
    );
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new AppError(
      'Parameter lng (longitude) tidak valid. Nilai harus berupa angka di antara -180 hingga 180.',
      400
    );
  }

  await ensureDefaultGridCells();

  const nearestGrid = await GridCell.findOne({
    centroid: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      },
    },
  }).populate('kelurahanId', 'code name kecamatan kota provinsi');

  if (!nearestGrid) {
    throw new AppError('Sel grid pemantauan udara terdekat tidak ditemukan.', 404);
  }

  const gridId = nearestGrid._id.toString();
  const cacheKey = buildGridAqiCacheKey(gridId);

  let aqiData = await readGridAqiFromRedis(gridId);
  let cacheSource: 'redis' | 'mongodb_fallback' | 'open_meteo_live' = 'redis';
  let isCacheHit = true;

  if (!aqiData) {
    isCacheHit = false;

    const latestReading = await AqiReading.findOne({ gridCellId: nearestGrid._id })
      .sort({ recordedAt: -1 })
      .lean();

    if (latestReading) {
      cacheSource = 'mongodb_fallback';
      const pm25Val = Number(latestReading.pollutants?.pm25 ?? 0);
      const pm10Val = Number(latestReading.pollutants?.pm10 ?? 0);
      const dominantPollutant: 'PM2.5' | 'PM10' =
        nearestGrid.dominantPollutant === 'PM10' || pm10Val > pm25Val * 2.5 ? 'PM10' : 'PM2.5';
      const areaStatusFromDb = resolveAreaStatusFromAqi(latestReading.aqi);

      aqiData = {
        gridId,
        cellCode: nearestGrid.cellCode,
        aqi: latestReading.aqi,
        pm25: pm25Val,
        pm10: pm10Val,
        pollutants: {
          pm25: pm25Val,
          pm10: pm10Val,
          ...(latestReading.pollutants?.co !== undefined ? { co: latestReading.pollutants.co } : {}),
          ...(latestReading.pollutants?.no2 !== undefined
            ? { no2: latestReading.pollutants.no2 }
            : {}),
          ...(latestReading.pollutants?.so2 !== undefined
            ? { so2: latestReading.pollutants.so2 }
            : {}),
          ...(latestReading.pollutants?.o3 !== undefined ? { o3: latestReading.pollutants.o3 } : {}),
        },
        dominantPollutant,
        category: latestReading.category ?? areaStatusFromDb.category,
        riskLevel: areaStatusFromDb.riskLevel,
        source: latestReading.source ?? 'external_api',
        recordedAt:
          latestReading.recordedAt instanceof Date
            ? latestReading.recordedAt.toISOString()
            : new Date(latestReading.recordedAt ?? Date.now()).toISOString(),
        cachedAt: new Date().toISOString(),
      };

      await writeGridAqiToRedisSetex(gridId, aqiData);
    } else {
      cacheSource = 'open_meteo_live';
      try {
        const synced = await syncSingleGridCellAqi(nearestGrid);
        aqiData = synced.cachedPayload;
      } catch (openMeteoError) {
        console.warn(
          `[AqiService] Gagal menarik Open-Meteo saat cold-start fallback untuk grid ${nearestGrid.cellCode}, menggunakan baseline GridCell:`,
          openMeteoError
        );
        const fallbackStatus = resolveAreaStatusFromAqi(nearestGrid.currentAqi || 50);
        aqiData = {
          gridId,
          cellCode: nearestGrid.cellCode,
          aqi: nearestGrid.currentAqi || 50,
          pm25: 12.0,
          pm10: 25.0,
          pollutants: {
            pm25: 12.0,
            pm10: 25.0,
          },
          dominantPollutant: nearestGrid.dominantPollutant ?? 'PM2.5',
          category: fallbackStatus.category,
          riskLevel: nearestGrid.riskLevel ?? fallbackStatus.riskLevel,
          source: 'external_api',
          recordedAt: (nearestGrid.lastCalculatedAt ?? new Date()).toISOString(),
          cachedAt: new Date().toISOString(),
        };
      }
    }
  }

  const [gridLng, gridLat] = nearestGrid.centroid.coordinates;
  const distanceMeters = calculateDistanceMeters(lat, lng, gridLat, gridLng);
  const statusDetails = resolveAreaStatusFromAqi(aqiData.aqi);

  const populatedKelurahan = nearestGrid.kelurahanId as
    | {
        _id?: Types.ObjectId;
        code?: string;
        name?: string;
        kecamatan?: string;
        kota?: string;
        provinsi?: string;
      }
    | undefined
    | null;

  const kelurahanInfo =
    populatedKelurahan && typeof populatedKelurahan === 'object' && populatedKelurahan._id
      ? {
          id: populatedKelurahan._id.toString(),
          code: populatedKelurahan.code,
          name: populatedKelurahan.name,
          kecamatan: populatedKelurahan.kecamatan,
          kota: populatedKelurahan.kota,
          provinsi: populatedKelurahan.provinsi,
        }
      : null;

  return {
    grid_id: gridId,
    cellCode: nearestGrid.cellCode,
    queryCoordinates: {
      lat,
      lng,
    },
    gridCentroid: {
      lat: gridLat,
      lng: gridLng,
    },
    distanceMeters,
    kelurahan: kelurahanInfo,
    weatherAqi: {
      aqi: aqiData.aqi,
      pm25: aqiData.pm25,
      pm10: aqiData.pm10,
      pollutants: aqiData.pollutants,
      dominantPollutant: aqiData.dominantPollutant,
      recordedAt: aqiData.recordedAt,
      source: aqiData.source,
    },
    areaStatus: {
      ...statusDetails,
      activeReportCount: nearestGrid.activeReportCount ?? 0,
      vulnerabilityIndex: nearestGrid.vulnerabilityIndex ?? 0,
    },
    cacheMeta: {
      key: cacheKey,
      hit: isCacheHit,
      source: cacheSource,
      ttlSeconds: AQI_GRID_CACHE_TTL_SECONDS,
    },
  };
};

export const getAqiGridMap = async (): Promise<{
  items: AqiGridMapItem[];
  generatedAt: string;
}> => {
  const cells = await ensureDefaultGridCells();
  const items = await Promise.all(
    cells.map(async (cell): Promise<AqiGridMapItem | null> => {
      const cached = await readGridAqiFromRedis(cell._id.toString());
      let aqi = cached?.aqi;
      let pm25 = cached?.pm25;
      let pm10 = cached?.pm10;
      let category = cached?.category;
      let recordedAt = cached?.recordedAt;
      let source = cached?.source;

      if (aqi === undefined) {
        const latest = await AqiReading.findOne({ gridCellId: cell._id })
          .sort({ recordedAt: -1 })
          .lean();
        if (!latest) return null;

        aqi = latest.aqi;
        pm25 = Number(latest.pollutants?.pm25 ?? 0);
        pm10 = Number(latest.pollutants?.pm10 ?? 0);
        category = latest.category;
        recordedAt = latest.recordedAt.toISOString();
        source = latest.source;
      }

      if (
        aqi === undefined ||
        pm25 === undefined ||
        pm10 === undefined ||
        category === undefined ||
        recordedAt === undefined
      ) {
        return null;
      }

      const status = resolveAreaStatusFromAqi(aqi);
      return {
        gridId: cell._id.toString(),
        cellCode: cell.cellCode,
        geometry: cell.geometry,
        aqi,
        pm25,
        pm10,
        category,
        statusLabel: status.statusLabel,
        colorHex: status.colorHex,
        recordedAt,
        source: source ?? 'mongodb_fallback',
      };
    })
  );

  return {
    items: items.filter((item): item is AqiGridMapItem => item !== null),
    generatedAt: new Date().toISOString(),
  };
};

const getJakartaDateKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
};

const roundMetric = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(1))
    : null;

export const getAqiHistory = async (
  rawDays: unknown,
  rawKelurahanId: unknown
): Promise<AqiTrendResponse> => {
  const days = rawDays === undefined ? 7 : Number(rawDays);
  if (!Number.isInteger(days) || ![7, 14, 30].includes(days)) {
    throw new AppError('Rentang tren AQI harus 7, 14, atau 30 hari.', 400);
  }

  const kelurahanId =
    typeof rawKelurahanId === 'string' ? rawKelurahanId.trim() : '';
  if (kelurahanId && !Types.ObjectId.isValid(kelurahanId)) {
    throw new AppError('Format parameter kelurahanId tidak valid.', 400);
  }

  const todayKey = getJakartaDateKey(new Date());
  const todayMidnight = new Date(`${todayKey}T00:00:00+07:00`);
  const startDate = new Date(
    todayMidnight.getTime() - (days - 1) * 24 * 60 * 60 * 1000
  );
  const match: Record<string, unknown> = {
    recordedAt: { $gte: startDate },
  };
  if (kelurahanId) {
    match.kelurahanId = new Types.ObjectId(kelurahanId);
  }

  const dailyReadings = await AqiReading.aggregate<{
    _id: string;
    averageAqi: number | null;
    averagePm25: number | null;
    averagePm10: number | null;
    readingCount: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$recordedAt',
            timezone: 'Asia/Jakarta',
          },
        },
        averageAqi: { $avg: '$aqi' },
        averagePm25: { $avg: '$pollutants.pm25' },
        averagePm10: { $avg: '$pollutants.pm10' },
        readingCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const byDate = new Map(dailyReadings.map((item) => [item._id, item]));
  const items = Array.from({ length: days }, (_, index): AqiTrendDay => {
    const date = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000);
    const dateKey = getJakartaDateKey(date);
    const reading = byDate.get(dateKey);
    return {
      date: dateKey,
      averageAqi: roundMetric(reading?.averageAqi),
      averagePm25: roundMetric(reading?.averagePm25),
      averagePm10: roundMetric(reading?.averagePm10),
      readingCount: reading?.readingCount ?? 0,
    };
  });

  return {
    days,
    items,
    generatedAt: new Date().toISOString(),
  };
};
