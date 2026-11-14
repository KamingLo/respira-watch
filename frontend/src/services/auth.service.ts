import apiClient from "@/lib/api/apiClient";

export interface OfficerProfile {
  name: string;
  nip: string;
  email: string;
  phone?: string;
  role: string;
  isActive?: boolean;
  assignedKelurahan?: string | {
    name?: string;
    kecamatan?: string;
  };
}

export interface OfficerProfileResponse {
  success: boolean;
  message?: string;
  data?: OfficerProfile;
}

export const login = async (
  email: string,
  password: string
) => {
  const response = await apiClient.post("/auth/login", {
    email,
    password,
  });

  return response.data;
};

export const getMyProfile = async (
  token: string
): Promise<OfficerProfileResponse> => {
  const response = await apiClient.get<OfficerProfileResponse>("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};