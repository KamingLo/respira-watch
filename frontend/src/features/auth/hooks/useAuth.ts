"use client";

import { useState } from "react";
import { login as loginService } from "@/services/auth.service";
import { setOfficerToken } from "@/features/auth/authToken";

interface Officer {
  id: string;
  name: string;
  nip: string;
  email: string;
  role: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    officer: Officer;
  };
}

export default function useAuth() {
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError("");

      const response: AuthResponse = await loginService(
        email,
        password
      );

      if (!response.success) {
        throw new Error(response.message || "Login gagal.");
      }

      setOfficerToken(response.data.token);
      setOfficer(response.data.officer);

      return response.data;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat login.";

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    officer,
    loading,
    error,
    login,
  };
}
