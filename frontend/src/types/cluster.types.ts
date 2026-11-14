export type ClusterCategory = "ispa" | "diare";
export type ClusterRiskStatus = "Waspada" | "Siaga" | "Prioritas";
export type ClusterStatus = "active" | "monitoring" | "resolved";

export interface ClusterLocation {
  _id?: string;
  code?: string;
  name?: string;
  kecamatan?: string;
  kota?: string;
}

export interface ClusterRecord {
  _id: string;
  clusterCode: string;
  category: ClusterCategory;
  center: {
    type: "Point";
    coordinates: [number, number];
  };
  boundary?: {
    type: "Polygon";
    coordinates: number[][][];
  };
  radiusMeters: number;
  reportCount: number;
  totalSickCount: number;
  averageAqi?: number;
  dominantSymptoms: string[];
  riskStatus: ClusterRiskStatus;
  riskColor: "Kuning" | "Oranye" | "Merah";
  colorHex: string;
  riskLevel: string;
  status: ClusterStatus;
  kelurahanId?: ClusterLocation | string | null;
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export interface ClusterApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}
