"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";

import {
  clearOfficerToken,
  getOfficerToken,
} from "@/features/auth/authToken";
import { getMyProfile } from "@/services/auth.service";

type GuardStatus = "checking" | "authorized" | "redirecting" | "error";

const officerRoles = ["admin", "field_officer", "health_analyst"];

interface ProfileResponse {
  success: boolean;
  data?: {
    role?: string;
  };
}

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<GuardStatus>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const token = getOfficerToken();

    if (!token) {
      router.replace("/login");
      return () => {
        active = false;
      };
    }

    getMyProfile(token)
      .then((response: ProfileResponse) => {
        if (!active) return;

        if (
          !response.success ||
          !response.data?.role ||
          !officerRoles.includes(response.data.role)
        ) {
          clearOfficerToken();
          setStatus("redirecting");
          router.replace("/login");
          return;
        }

        setStatus("authorized");
      })
      .catch((error: unknown) => {
        if (!active) return;

        if (
          isAxiosError(error) &&
          (error.response?.status === 401 || error.response?.status === 403)
        ) {
          clearOfficerToken();
          setStatus("redirecting");
          router.replace("/login");
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? `Sesi petugas gagal diverifikasi: ${error.message}`
            : "Sesi petugas gagal diverifikasi. Periksa koneksi lalu coba lagi."
        );
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [retryCount, router]);

  if (status === "authorized") return children;

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F4ED] p-6">
        <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[#264536]">
            Akses dashboard belum bisa diverifikasi
          </h1>
          <p role="alert" className="mt-2 text-sm text-[#536D60]">
            {errorMessage}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setErrorMessage("");
                setStatus("checking");
                setRetryCount((count) => count + 1);
              }}
              className="rounded-full bg-[#006B3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00552F]"
            >
              Coba lagi
            </button>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="rounded-full border border-[#B5D2C3] px-4 py-2 text-sm font-semibold text-[#264536] hover:bg-[#F0F6F2]"
            >
              Ke halaman login
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F4ED]">
      <p className="text-sm font-medium text-[#38614B]">
        Memeriksa akses petugas...
      </p>
    </main>
  );
}