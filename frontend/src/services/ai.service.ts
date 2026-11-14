import apiClient from "@/lib/api/apiClient";
import type {
  ComplaintClassification,
  ComplaintClassificationResponse,
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
