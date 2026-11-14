import { Types } from 'mongoose';
import { redisClient } from '../config/redis.js';
import { AqiReading } from '../models/AqiReading.js';
import type { IGeoPoint, IGeoPolygon } from '../models/GeoJSON.js';
import { GridCell, type IGridCell } from '../models/GridCell.js';
import { Report, type ReportSeverity } from '../models/Report.js';
import { getCache, isRedisReady, setCache } from '../utils/cache.js';
import {
  calculateDistanceMeters,
  ensureDefaultGridCells,
  readGridAqiFromRedis,
} from './aqiService.js';

export const RISK_WEIGHT_REPORT = 0.5;
export const RISK_WEIGHT_AQI = 0.3;
export const RISK_WEIGHT_WEATHER = 0.2;

export const RISK_SCORE_HASH_KEY = 'analytics:risk_map:hash';
export const RISK_SCORE_MAP_JSON_KEY = 'analytics:risk_map:all';
export const RISK_SCORE_CACHE_TTL_SECONDS = 2 * 60 * 60;
export const GRID_REPORT_RADIUS_METERS = 1_500;
export const REPORT_LOOKBACK_HOURS = 72;

export const OPEN_METEO_WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
export const WEATHER_FETCH_TIMEOUT_MS = 8_000;

export const NASA_FIRMS_BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
export const NASA_FIRMS_DEFAULT_SOURCE = 'VIIRS_SNPP_NRT';
export const NASA_FIRMS_DEFAULT_BBOX = '95,-11,141,6';
export const NASA_FIRMS_DEFAULT_DAY_RANGE = 1;
export const NASA_FIRMS_FETCH_TIMEOUT_MS = 8_000;
export const NASA_FIRMS_CACHE_PREFIX = 'analytics:firms:hotspots';
export const NASA_FIRMS_CACHE_TTL_SECONDS = 12 * 60 * 60;

export interface WeatherMetrics {
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  windDirectionDeg?: number;
  source: 'open_meteo_live' | 'mongodb_reading' | 'default_baseline';
}

export interface GridRiskScoreComponents {
  reportScore: number;
  aqiScore: number;
  weatherScore: number;
  weightedReportContribution: number;
  weightedAqiContribution: number;
  weightedWeatherContribution: number;
  totalScore: number;
}

export interface GridCellRiskScoreItem {
  gridId: string;
  cellCode: string;
  kelurahanId?: string;
  centroid: IGeoPoint;
  geometry: IGeoPolygon;
  score: number;
  riskLevel: IGridCell['riskLevel'];
  statusLabel: string;
  colorHex: string;
  components: GridRiskScoreComponents;
  metrics: {
    activeReportCount: number;
    totalSickCount: number;
    aqi: number;
    dominantPollutant?: IGridCell['dominantPollutant'];
    weather: WeatherMetrics;
  };
  calculatedAt: string;
}

export interface AreaRiskScoreMapPayload {
  weights: {
    report: number;
    aqi: number;
    weather: number;
    formula: string;
  };
  totalGrids: number;
  summary: {
    maxScore: number;
    minScore: number;
    averageScore: number;
    byRiskLevel: Record<IGridCell['riskLevel'], number>;
  };
  items: GridCellRiskScoreItem[];
  geoJson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: IGeoPolygon;
      properties: Omit<GridCellRiskScoreItem, 'geometry'>;
    }>;
  };
  cache: {
    hashKey: string;
    jsonKey: string;
    ttlSeconds: number;
    source: 'redis_o1' | 'fresh_batch_computation';
    generatedAt: string;
  };
}

export interface NasaFirmsHotspotItem {
  id: string;
  latitude: number;
  longitude: number;
  brightness: number;
  brightTi5?: number;
  frp: number;
  confidence: string;
  satellite: string;
  instrument: string;
  acqDate: string;
  acqTime: string;
  dayNight: string;
}

export interface NasaFirmsHotspotResponse {
  bbox: string;
  sourceSatellite: string;
  dayRange: number;
  totalHotspots: number;
  hotspots: NasaFirmsHotspotItem[];
  geoJson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: IGeoPoint;
      properties: Omit<NasaFirmsHotspotItem, 'latitude' | 'longitude'>;
    }>;
  };
  cache: {
    cacheKey: string;
    ttlSeconds: number;
    cached: boolean;
    providerStatus: 'nasa_firms_live' | 'redis_cache' | 'fallback_no_api_key' | 'fallback_upstream_timeout';
    upstreamNotice?: string;
    fetchedAt: string;
    expiresAt: string;
  };
}

const SEVERITY_SCORE_MULTIPLIER: Record<ReportSeverity, number> = {
  ringan: 1.0,
  mild: 1.0,
  sedang: 1.5,
  moderate: 1.5,
  berat: 2.5,
  severe: 2.5,
  kritis: 3.5,
  critical: 3.5,
};

const clampScore = (val: number, min = 0, max = 100): number => {
  if (!Number.isFinite(val)) {
    return min;
  }
  return Math.max(min, Math.min(max, val));
};

export const calculateReportComponentScore = (
  activeReportCount: number,
  weightedSeveritySum: number,
  totalSickCount: number
): number => {
  if (activeReportCount <= 0) {
    return 0;
  }

  const baseCountScore = activeReportCount * 9;
  const severityBonus = weightedSeveritySum * 3.5;
  const sickBonus = Math.min(totalSickCount, 40) * 1.2;

  return Number(clampScore(baseCountScore + severityBonus + sickBonus, 0, 100).toFixed(2));
};

export const calculateAqiComponentScore = (aqi: number): number => {
  const safeAqi = Math.max(0, Number.isFinite(aqi) ? aqi : 0);
  if (safeAqi <= 50) {
    return Number(((safeAqi / 50) * 20).toFixed(2));
  }
  if (safeAqi <= 100) {
    return Number((20 + ((safeAqi - 50) / 50) * 25).toFixed(2));
  }
  if (safeAqi <= 150) {
    return Number((45 + ((safeAqi - 100) / 50) * 25).toFixed(2));
  }
  if (safeAqi <= 200) {
    return Number((70 + ((safeAqi - 150) / 50) * 15).toFixed(2));
  }
  if (safeAqi <= 300) {
    return Number((85 + ((safeAqi - 200) / 100) * 15).toFixed(2));
  }
  return 100;
};

export const calculateWeatherComponentScore = (weather: {
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
}): number => {
  const windSpeed = Math.max(0, Number.isFinite(weather.windSpeedKmh) ? weather.windSpeedKmh : 10);
  const humidity = clampScore(Number.isFinite(weather.humidityPct) ? weather.humidityPct : 70, 0, 100);
  const temp = Number.isFinite(weather.temperatureC) ? weather.temperatureC : 29;

  const windStagnationScore =
    windSpeed <= 5
      ? 90
      : windSpeed <= 10
        ? 65
        : windSpeed <= 18
          ? 40
          : 15;

  const humidityStressScore =
    humidity >= 85 || humidity <= 35
      ? 85
      : humidity >= 75 || humidity <= 45
        ? 55
        : 25;

  const tempStressScore =
    temp >= 34 || temp <= 20
      ? 80
      : temp >= 31 || temp <= 23
        ? 50
        : 20;

  const compositeWeather =
    0.45 * windStagnationScore + 0.35 * humidityStressScore + 0.2 * tempStressScore;

  return Number(clampScore(compositeWeather, 0, 100).toFixed(2));
};

export const calculateCompositeAreaRiskScore = (input: {
  reportScore: number;
  aqiScore: number;
  weatherScore: number;
}): GridRiskScoreComponents => {
  const reportScore = clampScore(input.reportScore, 0, 100);
  const aqiScore = clampScore(input.aqiScore, 0, 100);
  const weatherScore = clampScore(input.weatherScore, 0, 100);

  const weightedReportContribution = Number((RISK_WEIGHT_REPORT * reportScore).toFixed(2));
  const weightedAqiContribution = Number((RISK_WEIGHT_AQI * aqiScore).toFixed(2));
  const weightedWeatherContribution = Number((RISK_WEIGHT_WEATHER * weatherScore).toFixed(2));

  const totalScore = Math.round(
    clampScore(
      weightedReportContribution + weightedAqiContribution + weightedWeatherContribution,
      0,
      100
    )
  );

  return {
    reportScore,
    aqiScore,
    weatherScore,
    weightedReportContribution,
    weightedAqiContribution,
    weightedWeatherContribution,
    totalScore,
  };
};

export const resolveRiskLevelFromCompositeScore = (
  score: number
): {
  riskLevel: IGridCell['riskLevel'];
  statusLabel: string;
  colorHex: string;
} => {
  if (score >= 80) {
    return {
      riskLevel: 'hazardous',
      statusLabel: 'Berbahaya / Kritis',
      colorHex: '#7F1D1D',
    };
  }
  if (score >= 65) {
    return {
      riskLevel: 'very_unhealthy',
      statusLabel: 'Risiko Sangat Tinggi',
      colorHex: '#8B5CF6',
    };
  }
  if (score >= 45) {
    return {
      riskLevel: 'unhealthy',
      statusLabel: 'Risiko Tinggi (Siaga)',
      colorHex: '#EF4444',
    };
  }
  if (score >= 25) {
    return {
      riskLevel: 'moderate',
      statusLabel: 'Risiko Sedang (Waspada)',
      colorHex: '#F59E0B',
    };
  }
  return {
    riskLevel: 'safe',
    statusLabel: 'Aman / Risiko Rendah',
    colorHex: '#10B981',
  };
};

interface OpenMeteoForecastWeatherResponse {
  current?: {
    temperature_2m?: number | null;
    relative_humidity_2m?: number | null;
    wind_speed_10m?: number | null;
    wind_direction_10m?: number | null;
  };
}

export const fetchGridWeatherMetrics = async (
  lat: number,
  lng: number,
  gridId?: Types.ObjectId
): Promise<WeatherMetrics> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_FETCH_TIMEOUT_MS);

  try {
    const url = new URL(OPEN_METEO_WEATHER_URL);
    url.searchParams.set('latitude', lat.toFixed(6));
    url.searchParams.set('longitude', lng.toFixed(6));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m'
    );
    url.searchParams.set('timezone', 'Asia/Jakarta');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RespiraWatch-Backend/1.0',
      },
      signal: controller.signal,
    });

    if (response.ok) {
      const data = (await response.json()) as OpenMeteoForecastWeatherResponse;
      if (data.current) {
        return {
          temperatureC: Number((data.current.temperature_2m ?? 29.5).toFixed(1)),
          humidityPct: Math.round(data.current.relative_humidity_2m ?? 72),
          windSpeedKmh: Number((data.current.wind_speed_10m ?? 8.5).toFixed(1)),
          ...(typeof data.current.wind_direction_10m === 'number'
            ? { windDirectionDeg: Math.round(data.current.wind_direction_10m) }
            : {}),
          source: 'open_meteo_live',
        };
      }
    }
  } catch {
    if (gridId) {
      const latestReading = await AqiReading.findOne({
        gridCellId: gridId,
        'weather.temperatureC': { $exists: true },
      })
        .sort({ recordedAt: -1 })
        .select('weather')
        .lean();

      if (latestReading?.weather) {
        return {
          temperatureC: latestReading.weather.temperatureC ?? 29.5,
          humidityPct: latestReading.weather.humidityPct ?? 72,
          windSpeedKmh: latestReading.weather.windSpeedKmh ?? 8.5,
          ...(latestReading.weather.windDirectionDeg !== undefined
            ? { windDirectionDeg: latestReading.weather.windDirectionDeg }
            : {}),
          source: 'mongodb_reading',
        };
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    temperatureC: 29.5,
    humidityPct: 72,
    windSpeedKmh: 8.5,
    source: 'default_baseline',
  };
};

export const computeAllGridRiskScoresBatch = async (): Promise<AreaRiskScoreMapPayload> => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - REPORT_LOOKBACK_HOURS * 60 * 60 * 1000);

  const gridCells = await ensureDefaultGridCells();

  const recentReports = await Report.find({
    reportedAt: { $gte: windowStart },
    status: { $ne: 'rejected' },
  })
    .select('_id severity sickCount geom location gridCellId kelurahanId')
    .lean();

  const items: GridCellRiskScoreItem[] = [];
  const byRiskLevel: Record<IGridCell['riskLevel'], number> = {
    safe: 0,
    moderate: 0,
    unhealthy: 0,
    very_unhealthy: 0,
    hazardous: 0,
  };

  const hashFieldEntries: string[] = [];
  const bulkUpdateOps: Array<{
    updateOne: {
      filter: { _id: Types.ObjectId };
      update: {
        $set: {
          activeReportCount: number;
          vulnerabilityIndex: number;
          riskLevel: IGridCell['riskLevel'];
          currentAqi: number;
          lastCalculatedAt: Date;
        };
      };
    };
  }> = [];

  for (const cell of gridCells) {
    const gridId = cell._id.toString();
    const [cellLng, cellLat] = cell.centroid?.coordinates ?? [106.827153, -6.175392];

    const cachedAqi = await readGridAqiFromRedis(gridId);
    const effectiveAqi =
      cachedAqi && Number.isFinite(cachedAqi.aqi)
        ? cachedAqi.aqi
        : typeof cell.currentAqi === 'number' && cell.currentAqi > 0
          ? cell.currentAqi
          : 50;

    let activeReportCount = 0;
    let totalSickCount = 0;
    let weightedSeveritySum = 0;

    for (const rep of recentReports) {
      let belongsToCell = false;

      if (rep.gridCellId && rep.gridCellId.toString() === gridId) {
        belongsToCell = true;
      } else if (
        cell.kelurahanId &&
        rep.kelurahanId &&
        cell.kelurahanId.toString() === rep.kelurahanId.toString()
      ) {
        belongsToCell = true;
      } else {
        const rawPoint = rep.geom?.coordinates?.length === 2 ? rep.geom : rep.location;
        if (rawPoint && Array.isArray(rawPoint.coordinates) && rawPoint.coordinates.length === 2) {
          const [repLng, repLat] = rawPoint.coordinates;
          const dist = calculateDistanceMeters(
            Number(cellLat),
            Number(cellLng),
            Number(repLat),
            Number(repLng)
          );
          if (dist <= GRID_REPORT_RADIUS_METERS) {
            belongsToCell = true;
          }
        }
      }

      if (belongsToCell) {
        activeReportCount += 1;
        const sick = typeof rep.sickCount === 'number' && rep.sickCount > 0 ? rep.sickCount : 1;
        totalSickCount += sick;
        const sevMultiplier = SEVERITY_SCORE_MULTIPLIER[rep.severity] ?? 1.5;
        weightedSeveritySum += sevMultiplier;
      }
    }

    const weatherMetrics = await fetchGridWeatherMetrics(
      Number(cellLat),
      Number(cellLng),
      cell._id
    );

    const reportScore = calculateReportComponentScore(
      activeReportCount,
      weightedSeveritySum,
      totalSickCount
    );
    const aqiScore = calculateAqiComponentScore(effectiveAqi);
    const weatherScore = calculateWeatherComponentScore(weatherMetrics);

    const components = calculateCompositeAreaRiskScore({
      reportScore,
      aqiScore,
      weatherScore,
    });

    const riskMeta = resolveRiskLevelFromCompositeScore(components.totalScore);
    byRiskLevel[riskMeta.riskLevel] += 1;

    const item: GridCellRiskScoreItem = {
      gridId,
      cellCode: cell.cellCode,
      ...(cell.kelurahanId ? { kelurahanId: cell.kelurahanId.toString() } : {}),
      centroid: cell.centroid,
      geometry: cell.geometry,
      score: components.totalScore,
      riskLevel: riskMeta.riskLevel,
      statusLabel: riskMeta.statusLabel,
      colorHex: riskMeta.colorHex,
      components,
      metrics: {
        activeReportCount,
        totalSickCount,
        aqi: effectiveAqi,
        ...(cachedAqi?.dominantPollutant
          ? { dominantPollutant: cachedAqi.dominantPollutant }
          : cell.dominantPollutant
            ? { dominantPollutant: cell.dominantPollutant }
            : {}),
        weather: weatherMetrics,
      },
      calculatedAt: now.toISOString(),
    };

    items.push(item);

    const serializedItem = JSON.stringify(item);
    hashFieldEntries.push(gridId, serializedItem, cell.cellCode.toUpperCase(), serializedItem);

    bulkUpdateOps.push({
      updateOne: {
        filter: { _id: cell._id },
        update: {
          $set: {
            activeReportCount,
            vulnerabilityIndex: Number((components.totalScore / 100).toFixed(2)),
            riskLevel: riskMeta.riskLevel,
            currentAqi: effectiveAqi,
            lastCalculatedAt: now,
          },
        },
      },
    });
  }

  if (bulkUpdateOps.length > 0) {
    await GridCell.bulkWrite(bulkUpdateOps);
  }

  const scores = items.map((i) => i.score);
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((acc, s) => acc + s, 0) / scores.length)
      : 0;

  const mapPayload: AreaRiskScoreMapPayload = {
    weights: {
      report: RISK_WEIGHT_REPORT,
      aqi: RISK_WEIGHT_AQI,
      weather: RISK_WEIGHT_WEATHER,
      formula: '0.5 * Laporan + 0.3 * AQI + 0.2 * Cuaca',
    },
    totalGrids: items.length,
    summary: {
      maxScore,
      minScore,
      averageScore,
      byRiskLevel,
    },
    items,
    geoJson: {
      type: 'FeatureCollection',
      features: items.map(({ geometry, ...properties }) => ({
        type: 'Feature' as const,
        geometry,
        properties,
      })),
    },
    cache: {
      hashKey: RISK_SCORE_HASH_KEY,
      jsonKey: RISK_SCORE_MAP_JSON_KEY,
      ttlSeconds: RISK_SCORE_CACHE_TTL_SECONDS,
      source: 'fresh_batch_computation',
      generatedAt: now.toISOString(),
    },
  };

  if (isRedisReady()) {
    try {
      const pipeline = redisClient.pipeline();
      if (hashFieldEntries.length > 0) {
        pipeline.del(RISK_SCORE_HASH_KEY);
        pipeline.hset(RISK_SCORE_HASH_KEY, ...hashFieldEntries);
        pipeline.expire(RISK_SCORE_HASH_KEY, RISK_SCORE_CACHE_TTL_SECONDS);
      }
      pipeline.set(
        RISK_SCORE_MAP_JSON_KEY,
        JSON.stringify({
          ...mapPayload,
          cache: {
            ...mapPayload.cache,
            source: 'redis_o1',
          },
        }),
        'EX',
        RISK_SCORE_CACHE_TTL_SECONDS
      );
      await pipeline.exec();
      console.log(
        `[AnalyticsService] Peta skor risiko (${items.length} sel grid) tersimpan di Redis Hash (${RISK_SCORE_HASH_KEY}) & JSON (${RISK_SCORE_MAP_JSON_KEY}) untuk pembacaan O(1).`
      );
    } catch (error) {
      console.warn('[AnalyticsService] Gagal menyimpan peta skor risiko ke Redis:', error);
    }
  }

  return mapPayload;
};

export const getSingleGridRiskScoreO1 = async (
  gridIdOrCode: string
): Promise<GridCellRiskScoreItem | null> => {
  const normalized = gridIdOrCode.trim();
  if (!normalized) {
    return null;
  }

  if (isRedisReady()) {
    try {
      const rawFromHash =
        (await redisClient.hget(RISK_SCORE_HASH_KEY, normalized)) ??
        (await redisClient.hget(RISK_SCORE_HASH_KEY, normalized.toUpperCase()));

      if (rawFromHash) {
        console.log(`[Redis O(1) HGET] HIT -> ${RISK_SCORE_HASH_KEY} [${normalized}]`);
        return JSON.parse(rawFromHash) as GridCellRiskScoreItem;
      }
    } catch (error) {
      console.warn('[AnalyticsService] Gagal membaca HGET skor risiko:', error);
    }
  }

  const computedMap = await computeAllGridRiskScoresBatch();
  return (
    computedMap.items.find(
      (item) =>
        item.gridId === normalized ||
        item.cellCode.toUpperCase() === normalized.toUpperCase()
    ) ?? null
  );
};

export const getAreaRiskScoreMap = async (
  options: { forceRefresh?: boolean } = {}
): Promise<AreaRiskScoreMapPayload> => {
  if (!options.forceRefresh) {
    const cachedMap = await getCache<AreaRiskScoreMapPayload>(RISK_SCORE_MAP_JSON_KEY);
    if (cachedMap) {
      return {
        ...cachedMap,
        cache: {
          ...cachedMap.cache,
          source: 'redis_o1',
        },
      };
    }
  }

  return computeAllGridRiskScoresBatch();
};

export const buildNasaFirmsCacheKey = (
  bbox: string,
  source: string,
  dayRange: number
): string => {
  const normalizedBbox = bbox
    .split(',')
    .map((p) => p.trim())
    .join(',');
  return `${NASA_FIRMS_CACHE_PREFIX}:${source.toUpperCase()}:${dayRange}d:${normalizedBbox}`;
};

export const parseNasaFirmsCsvToHotspots = (csvText: string): NasaFirmsHotspotItem[] => {
  if (!csvText || typeof csvText !== 'string') {
    return [];
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headerParts = (lines[0] ?? '')
    .split(',')
    .map((col) => col.trim().toLowerCase());

  const colIndex = (name: string): number => headerParts.indexOf(name);

  const latIdx = colIndex('latitude');
  const lngIdx = colIndex('longitude');
  const brightTi4Idx = colIndex('bright_ti4');
  const brightnessIdx = colIndex('brightness');
  const brightTi5Idx = colIndex('bright_ti5');
  const frpIdx = colIndex('frp');
  const confIdx = colIndex('confidence');
  const satIdx = colIndex('satellite');
  const instIdx = colIndex('instrument');
  const dateIdx = colIndex('acq_date');
  const timeIdx = colIndex('acq_time');
  const dnIdx = colIndex('daynight');

  if (latIdx === -1 || lngIdx === -1) {
    return [];
  }

  const hotspots: NasaFirmsHotspotItem[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = (lines[i] ?? '').split(',').map((c) => c.trim());
    if (cols.length <= Math.max(latIdx, lngIdx)) {
      continue;
    }

    const latitude = Number(cols[latIdx]);
    const longitude = Number(cols[lngIdx]);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      continue;
    }

    const rawBright =
      brightTi4Idx !== -1
        ? Number(cols[brightTi4Idx])
        : brightnessIdx !== -1
          ? Number(cols[brightnessIdx])
          : 310;
    const brightness = Number.isFinite(rawBright) ? rawBright : 310;

    const rawBrightTi5 = brightTi5Idx !== -1 ? Number(cols[brightTi5Idx]) : undefined;
    const rawFrp = frpIdx !== -1 ? Number(cols[frpIdx]) : 0;
    const frp = Number.isFinite(rawFrp) ? rawFrp : 0;

    const acqDate =
      (dateIdx !== -1 && cols[dateIdx]) || new Date().toISOString().slice(0, 10);
    const acqTime = (timeIdx !== -1 && cols[timeIdx]) || '0000';
    const satellite = (satIdx !== -1 && cols[satIdx]) || 'SNPP';
    const instrument = (instIdx !== -1 && cols[instIdx]) || 'VIIRS';
    const confidence = (confIdx !== -1 && cols[confIdx]) || 'nominal';
    const dayNight = (dnIdx !== -1 && cols[dnIdx]) || 'D';

    hotspots.push({
      id: `FIRMS-${acqDate}-${acqTime}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
      latitude,
      longitude,
      brightness,
      ...(rawBrightTi5 !== undefined && Number.isFinite(rawBrightTi5)
        ? { brightTi5: rawBrightTi5 }
        : {}),
      frp,
      confidence,
      satellite,
      instrument,
      acqDate,
      acqTime,
      dayNight,
    });
  }

  return hotspots;
};

export const getNasaFirmsHotspots = async (options: {
  bbox?: string;
  source?: string;
  dayRange?: number;
  forceRefresh?: boolean;
} = {}): Promise<NasaFirmsHotspotResponse> => {
  const bbox = (options.bbox ?? NASA_FIRMS_DEFAULT_BBOX).trim() || NASA_FIRMS_DEFAULT_BBOX;
  const sourceSatellite =
    (options.source ?? NASA_FIRMS_DEFAULT_SOURCE).trim() || NASA_FIRMS_DEFAULT_SOURCE;
  const rawDayRange = Number(options.dayRange ?? NASA_FIRMS_DEFAULT_DAY_RANGE);
  const dayRange =
    Number.isInteger(rawDayRange) && rawDayRange >= 1 && rawDayRange <= 10
      ? rawDayRange
      : NASA_FIRMS_DEFAULT_DAY_RANGE;

  const cacheKey = buildNasaFirmsCacheKey(bbox, sourceSatellite, dayRange);

  if (!options.forceRefresh) {
    const cachedData = await getCache<NasaFirmsHotspotResponse>(cacheKey);
    if (cachedData) {
      return {
        ...cachedData,
        cache: {
          ...cachedData.cache,
          cached: true,
          providerStatus: 'redis_cache',
        },
      };
    }
  }

  const mapKey = (process.env.NASA_FIRMS_MAP_KEY ?? process.env.FIRMS_API_KEY ?? '').trim();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + NASA_FIRMS_CACHE_TTL_SECONDS * 1000);

  let hotspots: NasaFirmsHotspotItem[] = [];
  let providerStatus: NasaFirmsHotspotResponse['cache']['providerStatus'] = 'nasa_firms_live';
  let upstreamNotice: string | undefined;

  if (!mapKey) {
    providerStatus = 'fallback_no_api_key';
    upstreamNotice =
      'NASA_FIRMS_MAP_KEY belum dikonfigurasi pada environment; mengembalikan daftar hotspot kosong tervalidasi.';
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NASA_FIRMS_FETCH_TIMEOUT_MS);

    try {
      const endpoint = `${NASA_FIRMS_BASE_URL}/${encodeURIComponent(mapKey)}/${encodeURIComponent(sourceSatellite)}/${encodeURIComponent(bbox)}/${dayRange}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'text/csv, text/plain, */*',
          'User-Agent': 'RespiraWatch-Backend/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`NASA FIRMS HTTP ${response.status} (${response.statusText})`);
      }

      const csvText = await response.text();
      if (csvText.toLowerCase().includes('invalid map_key')) {
        throw new Error('NASA FIRMS menolak MAP_KEY (Invalid MAP_KEY).');
      }

      hotspots = parseNasaFirmsCsvToHotspots(csvText);
    } catch (error) {
      providerStatus = 'fallback_upstream_timeout';
      upstreamNotice =
        error instanceof Error && error.name === 'AbortError'
          ? `Koneksi ke NASA FIRMS dihentikan karena melebihi batas timeout (${NASA_FIRMS_FETCH_TIMEOUT_MS}ms).`
          : error instanceof Error
            ? `Koneksi ke NASA FIRMS mengalami kendala (${error.message}); menggunakan mode fallback aman.`
            : 'Koneksi ke NASA FIRMS mengalami kendala.';
      console.warn(`[AnalyticsService.getNasaFirmsHotspots] ${upstreamNotice}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const payload: NasaFirmsHotspotResponse = {
    bbox,
    sourceSatellite,
    dayRange,
    totalHotspots: hotspots.length,
    hotspots,
    geoJson: {
      type: 'FeatureCollection',
      features: hotspots.map(({ latitude, longitude, ...properties }) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [longitude, latitude],
        },
        properties,
      })),
    },
    cache: {
      cacheKey,
      ttlSeconds: NASA_FIRMS_CACHE_TTL_SECONDS,
      cached: false,
      providerStatus,
      ...(upstreamNotice ? { upstreamNotice } : {}),
      fetchedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };

  await setCache(cacheKey, payload, NASA_FIRMS_CACHE_TTL_SECONDS);

  return payload;
};
