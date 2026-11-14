import apiClient from "@/lib/api/apiClient";

export type OfficerRole = "admin" | "field_officer" | "health_analyst";
export type BaselineRiskLevel = "low" | "moderate" | "high" | "critical";

export interface ManagedKelurahanReference {
  _id: string;
  code: string;
  name: string;
  kecamatan: string;
}

export interface ManagedOfficer {
  _id: string;
  name: string;
  nip: string;
  email: string;
  phone?: string;
  role: OfficerRole;
  isActive: boolean;
  assignedKelurahan?: ManagedKelurahanReference | string | null;
}

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface ManagedKelurahan {
  _id: string;
  code: string;
  name: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  population: number;
  areaSqKm?: number;
  centroid: GeoPoint;
  boundary: GeoPolygon;
  baselineRiskLevel: BaselineRiskLevel;
}

export interface UnmappedReport {
  _id: string;
  category: string;
  symptoms: string[];
  sickCount: number;
  age: number;
  ageGroups?: string[];
  severity: string;
  description?: string;
  address?: string;
  locationSuggestion?: {
    name: string;
    kecamatan?: string;
    kota?: string;
    provinsi?: string;
  };
  geom: GeoPoint;
  status: string;
  reportedAt: string | Date;
}

export interface CreateOfficerPayload {
  name: string;
  nip: string;
  email: string;
  password: string;
  phone?: string;
  role: OfficerRole;
  assignedKelurahan?: string;
  isActive: boolean;
}

export interface UpdateOfficerPayload {
  name: string;
  nip: string;
  email: string;
  password?: string;
  phone: string | null;
  role: OfficerRole;
  isActive: boolean;
}

export interface CreateKelurahanPayload {
  code: string;
  name: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  population: number;
  areaSqKm?: number;
  centroid: GeoPoint;
  boundary: GeoPolygon;
  baselineRiskLevel: BaselineRiskLevel;
}

export interface UpdateKelurahanPayload extends Omit<CreateKelurahanPayload, "areaSqKm"> {
  areaSqKm?: number | null;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

const withToken = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

const unwrapResponse = <T>(response: ApiResponse<T>, fallbackMessage: string): T => {
  if (!response.success) throw new Error(response.message || fallbackMessage);
  return response.data;
};

export const getManagedOfficers = async (token: string): Promise<ManagedOfficer[]> => {
  const response = await apiClient.get<ApiResponse<ManagedOfficer[]>>(
    "/api/officers",
    withToken(token)
  );
  return unwrapResponse(response.data, "Gagal memuat daftar petugas.");
};

export const createManagedOfficer = async (
  token: string,
  payload: CreateOfficerPayload
): Promise<ManagedOfficer> => {
  const response = await apiClient.post<ApiResponse<ManagedOfficer>>(
    "/api/officers",
    payload,
    withToken(token)
  );
  return unwrapResponse(response.data, "Gagal menambahkan petugas.");
};

export const updateManagedOfficer = async (
  token: string,
  officerId: string,
  payload: UpdateOfficerPayload
): Promise<ManagedOfficer> => {
  const response = await apiClient.patch<ApiResponse<ManagedOfficer>>(
    `/api/officers/${encodeURIComponent(officerId)}`,
    payload,
    withToken(token)
  );
  return unwrapResponse(response.data, "Gagal memperbarui data petugas.");
};

export const assignOfficerKelurahan = async (
  token: string,
  officerId: string,
  assignedKelurahan: string | null
): Promise<ManagedOfficer> => {
  const response = await apiClient.patch<ApiResponse<ManagedOfficer>>(
    `/api/officers/${encodeURIComponent(officerId)}/assign-kelurahan`,
    { assignedKelurahan, syncBaseLocation: true },
    withToken(token)
  );
  return unwrapResponse(response.data, "Gagal memperbarui penempatan petugas.");
};

export const deleteManagedOfficer = async (
  token: string,
  officerId: string
): Promise<void> => {
  const response = await apiClient.delete<ApiResponse<{ id: string }>>(
    `/api/officers/${encodeURIComponent(officerId)}`,
    withToken(token)
  );
  unwrapResponse(response.data, "Gagal menghapus petugas.");
};

export const getManagedKelurahans = async (token: string): Promise<ManagedKelurahan[]> => {
  const response = await apiClient.get<ApiResponse<ManagedKelurahan[]>>(
    "/api/kelurahans",
    withToken(token)
  );
  return unwrapResponse(response.data, "Gagal memuat daftar kelurahan.");
};

export const createManagedKelurahan = async (
  token: string,
  payload: CreateKelurahanPayload
): Promise<ManagedKelurahan> => {
  const response = await apiClient.post<ApiResponse<ManagedKelurahan>>(
    "/api/kelurahans",
    payload,
    withToken(token)
  );
  return unwrapResponse(response.data, "Gagal menambahkan kelurahan.");
};

export const updateManagedKelurahan = async (
  token: string,
  kelurahanId: string,
  payload: UpdateKelurahanPayload
): Promise<ManagedKelurahan> => {
  const response = await apiClient.patch<ApiResponse<ManagedKelurahan>>(
    `/api/kelurahans/${encodeURIComponent(kelurahanId)}`,
    payload,
    withToken(token)
  );
  return unwrapResponse(response.data, "Gagal memperbarui data kelurahan.");
};

export const deleteManagedKelurahan = async (
  token: string,
  kelurahanId: string
): Promise<void> => {
  const response = await apiClient.delete<ApiResponse<{ id: string }>>(
    `/api/kelurahans/${encodeURIComponent(kelurahanId)}`,
    withToken(token)
  );
  unwrapResponse(response.data, "Gagal menghapus kelurahan.");
};

export const getUnmappedReports = async (token: string): Promise<UnmappedReport[]> => {
  const response = await apiClient.get<ApiResponse<UnmappedReport[]>>(
    "/api/reports",
    {
      ...withToken(token),
      params: { unmapped: true },
    }
  );
  return unwrapResponse(
    response.data,
    "Gagal memuat laporan yang belum memiliki kelurahan."
  );
};
