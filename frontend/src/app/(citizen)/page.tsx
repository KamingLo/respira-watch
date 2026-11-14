"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, MapPin } from "lucide-react";

import AqiCard from "@/features/aqi/components/AqiCard/AqiCard";
import Card from "@/components/ui/Card/Card";
import useMap from "@/features/map/hooks/useMap";
import { getAqiByCoordinates } from "@/services/aqi.service";
import type { AqiResult } from "@/types/aqi.types";

export default function CitizenHomePage() {
  const { summary, loading, error } = useMap();
  const [aqiData, setAqiData] = useState<AqiResult | null>(null);
  const [aqiLoading, setAqiLoading] = useState(false);
  const [aqiError, setAqiError] = useState<string | null>(null);

  const requestNearbyAqi = useCallback(() => {
    if (!navigator.geolocation) {
      setAqiError("Browser ini tidak mendukung akses lokasi.");
      return;
    }

    setAqiLoading(true);
    setAqiError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        getAqiByCoordinates(coords.latitude, coords.longitude)
          .then(setAqiData)
          .catch((requestError: unknown) => {
            setAqiError(
              requestError instanceof Error
                ? requestError.message
                : "Gagal memuat kualitas udara di lokasi ini."
            );
          })
          .finally(() => setAqiLoading(false));
      },
      (locationError) => {
        setAqiLoading(false);
        setAqiError(
          locationError.code === locationError.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk melihat AQI sekitar."
            : "Lokasi belum bisa didapatkan. Coba lagi."
        );
      },
      { enableHighAccuracy: false, timeout: 10_000 }
    );
  }, []);

  return (
    <main className="min-h-screen bg-[#EDF2EE] p-4 pb-28 md:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-[#176B45]">RespiraWatch</p>
          <h1 className="text-2xl font-bold text-[#123D2B] md:text-3xl">
            Beranda Warga
          </h1>
          <p className="text-sm text-gray-600">
            Pantau kualitas udara dan laporan kesehatan di wilayahmu.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <AqiCard
            data={aqiData}
            loading={aqiLoading}
            error={aqiError}
            onRefresh={requestNearbyAqi}
          />

          <Card className="!p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#123D2B]">
                  Ringkasan laporan
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Laporan terpetakan yang tidak ditolak.
                </p>
              </div>
              <div className="rounded-xl bg-[#EAF5EE] p-2 text-[#176B45]">
                <MapPin size={22} />
              </div>
            </div>

            {error ? (
              <p role="status" className="mt-5 text-sm text-red-700">
                Gagal memuat ringkasan laporan: {error}
              </p>
            ) : (
              <>
                <p className="mt-5 text-4xl font-bold text-[#176B45]">
                  {loading ? "…" : summary.totalReports}
                </p>
                <p className="text-sm text-gray-600">laporan seluruh wilayah</p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#F3F8F4] p-3">
                    <p className="text-xs text-gray-600">ISPA</p>
                    <p className="mt-1 text-xl font-bold text-[#176B45]">
                      {loading ? "…" : summary.byCategory.ispa}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F3F8F4] p-3">
                    <p className="text-xs text-gray-600">Diare</p>
                    <p className="mt-1 text-xl font-bold text-[#176B45]">
                      {loading ? "…" : summary.byCategory.diare}
                    </p>
                  </div>
                </div>
              </>
            )}

            <Link
              href="/peta"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#006B3C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#005631]"
            >
              Lihat peta laporan
              <ArrowRight size={17} />
            </Link>
          </Card>
        </div>

        <Card className="flex flex-col items-start justify-between gap-4 !p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-[#123D2B]">
              Ada gejala yang ingin dilaporkan?
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Bantu petugas memantau kondisi kesehatan di lingkunganmu.
            </p>
          </div>
          <Link
            href="/lapor"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-green-700 to-green-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            <FileText size={18} />
            Lapor gejala
          </Link>
        </Card>
      </div>
    </main>
  );
}
