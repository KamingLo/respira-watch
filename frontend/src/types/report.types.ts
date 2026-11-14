export type ReportCategory = "ispa" | "diare";

export type ReportSeverity =
  | "ringan"
  | "sedang"
  | "berat"
  | "kritis";

export type ReportAgeGroup =
  | "balita"
  | "anak"
  | "remaja"
  | "dewasa"
  | "lansia";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ReportLocationSuggestion {
  name: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
}

export interface ReportLocation {
  address: string;
  coordinates: [number, number]; // [longitude, latitude]
  kelurahanId?: string;
  locationSuggestion?: ReportLocationSuggestion;
}

export interface ReportPayload {
  reporterName?: string;
  category: ReportCategory;
  symptoms: string[];
  sickCount: number;
  age: number;
  ageGroups: ReportAgeGroup[];
  severity: ReportSeverity;
  deviceHash: string;
  description: string;
  address?: string;
  locationSuggestion?: ReportLocationSuggestion;
  geom: GeoPoint;
  kelurahanId?: string;
}

export interface CreatedReport {
  _id?: string;
  id?: string;
  isUpdated: boolean;
  category: ReportCategory;
  symptoms: string[];
  sickCount: number;
  age: number;
  ageGroups: ReportAgeGroup[];
  severity: ReportSeverity;
  status: string;
  reportedAt?: string;
}

export interface ReportApiResponse {
  success: boolean;
  message: string;
  data: CreatedReport;
}
