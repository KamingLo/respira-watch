import apiClient from "@/lib/api/apiClient";
import type {
  ComplaintClassification,
  ComplaintClassificationResponse,
  ClusterAiSummary,
} from "@/types/ai.types";

export const classifyComplaint = async (
  text: string,
  age?: number
): Promise<ComplaintClassification> => {
  const response = await apiClient.post<ComplaintClassificationResponse>(
    "/api/ai/classify",
    {
      text,
      ...(age !== undefined ? { age } : {}),
    }
  );

  if (!response.data.success) {
    throw new Error(
      response.data.message || "Keluhan belum bisa dianalisis."
    );
  }

  return response.data.data;
};

export const getClusterAiSummary = async (
  clusterId: string,
  forceRefresh = false
): Promise<ClusterAiSummary> => {
  const response = await apiClient.get<{
    success: boolean;
    message?: string;
    data: ClusterAiSummary;
  }>(`/api/clusters/${encodeURIComponent(clusterId)}/summary`, {
    params: forceRefresh ? { refresh: true } : undefined,
  });

  if (!response.data.success) {
    throw new Error(
      response.data.message || "Gagal memuat ringkasan AI klaster."
    );
  }

  return response.data.data;
};
