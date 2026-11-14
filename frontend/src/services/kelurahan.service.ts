import apiClient from "@/lib/api/apiClient";

export interface PublicKelurahan {
  id: string;
  code: string;
  name: string;
  kecamatan: string;
  centroid: {
    type: "Point";
    coordinates: [number, number];
  };
}

interface PublicKelurahanResponse {
  success: boolean;
  message?: string;
  data: PublicKelurahan[];
}

export const getPublicKelurahans = async (): Promise<PublicKelurahan[]> => {
  const response = await apiClient.get<PublicKelurahanResponse>(
    "/api/kelurahans/public"
  );
  if (!response.data.success) {
    throw new Error(response.data.message || "Gagal memuat pilihan kelurahan.");
  }
  return response.data.data;
};
