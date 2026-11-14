import apiClient from "@/lib/api/apiClient";
import type {
  ClusterApiResponse,
  ClusterRecord,
} from "@/types/cluster.types";

export const getClusters = async (): Promise<ClusterRecord[]> => {
  const response = await apiClient.get<ClusterApiResponse<ClusterRecord[]>>(
    "/api/clusters"
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