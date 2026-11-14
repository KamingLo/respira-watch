import apiClient from "@/lib/api/apiClient";
import { getOfficerToken } from "@/features/auth/authToken";
import type { ReportLocationSuggestion } from "@/types/report.types";

export type OfficerReportStatus =
  | "pending"
  | "verified"
  | "in_progress"
  | "resolved"
  | "rejected";

export interface OfficerReport {
  _id: string;
  category: string;
  symptoms: string[];
  sickCount: number;
  age: number;
  ageGroups: string[];
  severity: string;
  description: string;
  address?: string;
  locationSuggestion?: ReportLocationSuggestion;
  status: OfficerReportStatus;
  reportedAt: string;
  geom: {
    coordinates: [number, number];
  };
  kelurahanId?: {
    name?: string;
    kecamatan?: string;
  } | null;
}

interface OfficerReportApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface OfficerReportFilters {
  status?: OfficerReportStatus;
  unmapped?: boolean;
}

const officerHeaders = () => {
  const token = getOfficerToken();
  if (!token) {
    throw new Error("Sesi petugas tidak ditemukan. Silakan masuk kembali.");
  }
  return { Authorization: `Bearer ${token}` };
};

export const getOfficerReports = async (
  filters: OfficerReportFilters = {}
): Promise<OfficerReport[]> => {
  const response = await apiClient.get<
    OfficerReportApiResponse<OfficerReport[]>
  >("/api/reports", {
    headers: officerHeaders(),
    params: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.unmapped ? { unmapped: "true" } : {}),
    },
  });
  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat laporan warga.");
  }
  return response.data.data;
};

export const updateOfficerReportStatus = async (
  reportId: string,
  status: OfficerReportStatus
): Promise<OfficerReport> => {
  const response = await apiClient.patch<
    OfficerReportApiResponse<OfficerReport>
  >(`/api/reports/${encodeURIComponent(reportId)}/status`, { status }, {
    headers: officerHeaders(),
  });
  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memperbarui status laporan.");
  }
  return response.data.data;
};
