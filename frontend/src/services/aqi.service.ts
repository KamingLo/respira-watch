import apiClient from "@/lib/api/apiClient";
import type {
  AqiApiResponse,
  AqiResult,
  AqiTrend,
  AqiTrendApiResponse,
} from "@/types/aqi.types";

export const getAqiByCoordinates = async (
  lat: number,
  lng: number
): Promise<AqiResult> => {
  const response = await apiClient.get<AqiApiResponse>("/api/aqi", {
    params: { lat, lng },
  });

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat data kualitas udara.");
  }

  return response.data.data;
};

export const getAqiTrend = async (days = 7): Promise<AqiTrend> => {
  const response = await apiClient.get<AqiTrendApiResponse>(
    "/api/aqi/trend",
    { params: { days } }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat tren kualitas udara.");
  }

  return response.data.data;
};