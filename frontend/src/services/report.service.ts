import apiClient from "@/lib/api/apiClient";
import type {
  ReportPayload,
  ReportApiResponse,
} from "@/types/report.types";

export const createReport = async (
  payload: ReportPayload
): Promise<ReportApiResponse> => {
  const response = await apiClient.post<ReportApiResponse>(
    "/api/reports",
    payload,
    {
      headers: {
        "x-device-hash": payload.deviceHash,
      },
    }
  );

  return response.data;
};
