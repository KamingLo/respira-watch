export type ReportCategory = "ispa" | "diare";

export type ReportSeverity =
  | "ringan"
  | "sedang"
  | "berat"
  | "kritis";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ReportLocation {
  address: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ReportPayload {
  reporterName?: string;
  category: ReportCategory;
  symptoms: string[];
  sickCount: 1;
  age: number;
  severity: ReportSeverity;
  deviceHash: string;
  description: string;
  address?: string;
  geom: GeoPoint;
}

export interface CreatedReport {
  _id?: string;
  id?: string;
  category: ReportCategory;
  symptoms: string[];
  sickCount: number;
  age: number;
  severity: ReportSeverity;
  status: string;
  reportedAt?: string;
}

export interface ReportApiResponse {
  success: boolean;
  message: string;
  data: CreatedReport;
}
