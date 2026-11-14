export interface GridRiskScoreItem {
  gridId: string;
  cellCode: string;
  kelurahanId?: string;
  centroid: {
    type: "Point";
    coordinates: [number, number];
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  score: number;
  riskLevel: string;
  statusLabel: string;
  colorHex: string;
  components: {
    reportScore: number;
    aqiScore: number;
    weatherScore: number;
    weightedReportContribution: number;
    weightedAqiContribution: number;
    weightedWeatherContribution: number;
    totalScore: number;
  };
  metrics: {
    activeReportCount: number;
    totalSickCount: number;
    aqi: number;
    dominantPollutant?: string;
    weather: {
      temperatureC: number;
      humidityPct: number;
      windSpeedKmh: number;
      windDirectionDeg?: number;
      source: string;
    };
  };
  calculatedAt: string;
}

export interface RiskScoreMap {
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
    byRiskLevel: Record<string, number>;
  };
  items: GridRiskScoreItem[];
  cache: {
    hashKey: string;
    jsonKey: string;
    ttlSeconds: number;
    source: string;
    generatedAt: string;
  };
}

export interface NasaFirmsHotspot {
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

export interface NasaFirmsHotspots {
  bbox: string;
  sourceSatellite: string;
  dayRange: number;
  totalHotspots: number;
  hotspots: NasaFirmsHotspot[];
  cache: {
    cacheKey: string;
    ttlSeconds: number;
    cached: boolean;
    providerStatus:
      | "nasa_firms_live"
      | "redis_cache"
      | "fallback_no_api_key"
      | "fallback_upstream_timeout"
      | "fallback_upstream_error";
    upstreamNotice?: string;
    fetchedAt: string;
    expiresAt: string;
  };
}

export interface AnalyticsApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface CurrentWeather {
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  windDirectionDeg?: number;
  precipitationMm?: number;
  source: "open_meteo_live" | "mongodb_reading" | "default_baseline";
}

export interface ClusterReportTrend {
  days: Array<{
    date: string;
    count: number;
  }>;
  generatedAt: string;
}
