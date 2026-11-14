import apiClient from "@/lib/api/apiClient";
import { getOfficerToken } from "@/features/auth/authToken";

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

const officerHeaders = () => {
  const token = getOfficerToken();
  if (!token) {
    throw new Error("Sesi petugas tidak ditemukan. Silakan masuk kembali.");
  }
  return { Authorization: `Bearer ${token}` };
};

export const getOfficerReports = async (
  status?: OfficerReportStatus
): Promise<OfficerReport[]> => {
  const response = await apiClient.get<
    OfficerReportApiResponse<OfficerReport[]>
  >("/api/reports", {
    headers: officerHeaders(),
    params: status ? { status } : undefined,
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
