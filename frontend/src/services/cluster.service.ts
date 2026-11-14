import apiClient from "@/lib/api/apiClient";
import type {
  ClusterApiResponse,
  ClusterRecord,
  ClusterStatus,
} from "@/types/cluster.types";
import type { ClusterReportTrend } from "@/types/analytics.types";
import { getOfficerToken } from "@/features/auth/authToken";

export interface ClusterListFilters {
  category?: string;
  status?: string;
  kelurahanId?: string;
  startDate?: string;
  endDate?: string;
}

export const getClusters = async (
  filters: ClusterListFilters = {}
): Promise<ClusterRecord[]> => {
  const response = await apiClient.get<ClusterApiResponse<ClusterRecord[]>>(
    "/api/clusters",
    { params: filters }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat daftar klaster.");
  }

  return response.data.data;
};

export const getClusterByIdOrCode = async (
  idOrCode: string
): Promise<ClusterRecord> => {
  const response = await apiClient.get<ClusterApiResponse<ClusterRecord>>(
    `/api/clusters/${encodeURIComponent(idOrCode)}`
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat detail klaster.");
  }

  return response.data.data;
};

export const getClusterTrend = async (
  idOrCode: string
): Promise<ClusterReportTrend> => {
  const token = getOfficerToken();
  if (!token) {
    throw new Error("Sesi petugas tidak ditemukan. Silakan masuk kembali.");
  }

  const response = await apiClient.get<
    ClusterApiResponse<ClusterReportTrend>
  >(`/api/clusters/${encodeURIComponent(idOrCode)}/trend`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat tren klaster.");
  }

  return response.data.data;
};

export const updateClusterStatus = async (
  idOrCode: string,
  status: ClusterStatus
): Promise<ClusterRecord> => {
  const token = getOfficerToken();
  if (!token) {
    throw new Error("Sesi petugas tidak ditemukan. Silakan masuk kembali.");
  }

  const response = await apiClient.patch<
    ClusterApiResponse<ClusterRecord>
  >(
    `/api/clusters/${encodeURIComponent(idOrCode)}`,
    { status },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.data.success) {
    throw new Error(
      response.data.message || "Gagal memperbarui status klaster."
    );
  }

  return response.data.data;
};