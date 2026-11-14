import apiClient from "@/lib/api/apiClient";
import type {
  AqiMapResponse,
  MapFilterParams,
  PublicMapResponse,
} from "@/types/map.types";

export const getPublicMap = async (
  filters?: MapFilterParams
): Promise<PublicMapResponse> => {
  const response = await apiClient.get<PublicMapResponse>(
    "/api/map",
    {
      params: filters,
    }
  );

  return response.data;
};

export const getAqiMap = async () => {
  const response = await apiClient.get<AqiMapResponse>("/api/aqi/map");

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat lapisan AQI.");
  }

  return response.data.data;
};
