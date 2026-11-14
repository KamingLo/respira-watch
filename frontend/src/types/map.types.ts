export interface MapPoint {
  id: string;
  category: string;
  symptoms: string[];
  sickCount: number;
  age: number;
  severity: string;
  status: string;
  geom: {
    type: "Point";
    coordinates: [number, number];
  };
  kelurahan: {
    id: string;
    code?: string;
    name?: string;
    kecamatan?: string;
  } | null;
  reportedAt: string;
}

export interface MapGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Omit<MapPoint, "geom">;
}

export interface MapGeoJson {
  type: "FeatureCollection";
  features: MapGeoJsonFeature[];
}

export interface MapHeatmapPoint {
  coordinates: [number, number];
  lng: number;
  lat: number;
  weight: number;
  intensity: number;
  category: string;
  severity: string;
  sickCount: number;
}

export interface MapSummary {
  totalReports: number;
  totalSickCount: number;
  byCategory: {
    ispa: number;
    diare: number;
    other: number;
  };
  bySeverity: Record<string, number>;
  privacyJitterMeters: {
    min: number;
    max: number;
  };
  cacheKey: string;
  generatedAt: string;
}

export interface PublicMapData {
  points: MapPoint[];
  geoJson: MapGeoJson;
  heatmap: MapHeatmapPoint[];
  summary: MapSummary;
}

export interface PublicMapResponse {
  success: boolean;
  data: PublicMapData;
}

export interface MapFilterParams {
  category?: string;
  severity?: string;
}
