import apiClient from "@/lib/api/apiClient";
import type {
  AnalyticsApiResponse,
  CurrentWeather,
  NasaFirmsHotspots,
  RiskScoreMap,
} from "@/types/analytics.types";

export const getRiskScoreMap = async (
  forceRefresh = false
): Promise<RiskScoreMap> => {
  const response = await apiClient.get<AnalyticsApiResponse<RiskScoreMap>>(
    "/api/analytics/risk-scores",
    {
      params: forceRefresh ? { refresh: true } : undefined,
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat skor risiko area.");
  }

  return response.data.data;
};

export const getNasaFirmsHotspots = async (): Promise<NasaFirmsHotspots> => {
  const response = await apiClient.get<
    AnalyticsApiResponse<NasaFirmsHotspots>
  >("/api/analytics/hotspots");

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat titik api.");
  }

  return response.data.data;
};

export const getCurrentWeather = async (
  lat: number,
  lng: number
): Promise<CurrentWeather> => {
  const response = await apiClient.get<AnalyticsApiResponse<CurrentWeather>>(
    "/api/analytics/weather",
    { params: { lat, lng } }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat data cuaca.");
  }

  return response.data.data;
};
