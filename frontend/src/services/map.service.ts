import apiClient from "@/lib/api/apiClient";
import type {
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
