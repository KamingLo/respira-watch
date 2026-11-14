"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Settings2, UserRound } from "lucide-react";

import {
  clearOfficerToken,
  getOfficerToken,
} from "@/features/auth/authToken";
import {
  getMyProfile,
  type OfficerProfile,
} from "@/services/auth.service";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  field_officer: "Petugas Lapangan",
  health_analyst: "Analis Kesehatan",
};

export default function OfficerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = getOfficerToken();

    if (!token) {
      return;
    }

    getMyProfile(token)
      .then((response) => {
        if (!response.success || !response.data) {
          throw new Error(response.message || "Profil petugas tidak ditemukan.");
        }
        if (active) setProfile(response.data);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Gagal memuat profil petugas."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const kelurahanName =
    profile?.assignedKelurahan &&
    typeof profile.assignedKelurahan === "object"
      ? profile.assignedKelurahan.name
      : undefined;

  const handleLogout = () => {
    clearOfficerToken();
    router.replace("/login");
  };

  return (
    <main className="min-h-screen bg-[#F5F4ED] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Kembali ke dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B]"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#123D2B]">Akun Petugas</h1>
            <p className="mt-1 text-sm text-[#536D60]">
              Informasi akun yang sedang digunakan.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            <LogOut size={17} />
            Keluar
          </button>
        </header>

        {loading ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-[#536D60]">
            Memuat profil petugas...
          </p>
        ) : error ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">
            {error}
          </p>
        ) : profile ? (
          <>
            {profile.role === "admin" && (
              <Link
                href="/dashboard/admin"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#006B3C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00552F]"
              >
                <Settings2 size={17} />
                Kelola petugas & kelurahan
              </Link>
            )}

            <section className="rounded-2xl border border-[#D5E2D9] bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-4 border-b border-[#E6ECE8] pb-5">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E9F4ED] text-[#087546]">
                  <UserRound size={28} />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#164A32]">{profile.name}</h2>
                  <p className="text-sm text-[#536D60]">
                    {roleLabels[profile.role] ?? profile.role}
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#708477]">
                    NIP
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#264536]">
                    {profile.nip}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#708477]">
                    Email
                  </dt>
                  <dd className="mt-1 break-all text-sm font-medium text-[#264536]">
                    {profile.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#708477]">
                    Nomor telepon
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#264536]">
                    {profile.phone || "Belum tersedia"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#708477]">
                    Wilayah tugas
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#264536]">
                    {kelurahanName || "Belum ditetapkan"}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
