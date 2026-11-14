export interface AqiResult {
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
    dominantPollutant: string;
    recordedAt: string;
    source: string;
  };
  areaStatus: {
    category: string;
    riskLevel: string;
    statusLabel: string;
    colorHex: string;
    isSafeForOutdoor: boolean;
    healthRecommendation: string;
    sensitiveGroupWarning: string;
    activeReportCount: number;
    vulnerabilityIndex: number;
  };
  cacheMeta: {
    key: string;
    hit: boolean;
    source: string;
    ttlSeconds: number;
  };
}

export interface AqiApiResponse {
  success: boolean;
  message?: string;
  data: AqiResult;
}

export interface AqiTrendDay {
  date: string;
  averageAqi: number | null;
  averagePm25: number | null;
  averagePm10: number | null;
  readingCount: number;
}

export interface AqiTrend {
  days: number;
  items: AqiTrendDay[];
  generatedAt: string;
}

export interface AqiTrendApiResponse {
  success: boolean;
  message?: string;
  data: AqiTrend;
}