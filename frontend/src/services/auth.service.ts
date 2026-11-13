import apiClient from "@/lib/api/apiClient";

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

export const getMyProfile = async (token: string) => {
  const response = await apiClient.get("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};