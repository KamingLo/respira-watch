"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, RefreshCw } from "lucide-react";

import AqiIndicator from "@/features/aqi/components/AqiIndicator/AqiIndicator";
import { getClusterByIdOrCode } from "@/services/cluster.service";
import type { ClusterRecord } from "@/types/cluster.types";

const statusLabels: Record<ClusterRecord["status"], string> = {
  active: "Aktif",
  monitoring: "Dipantau",
  resolved: "Selesai",
};

const riskClasses: Record<ClusterRecord["riskStatus"], string> = {
  Waspada: "border-yellow-300 bg-yellow-300 text-[#173729]",
  Siaga: "border-orange-400 bg-orange-500 text-white",
  Prioritas: "border-rose-400 bg-rose-600 text-white",
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Belum tersedia";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getClusterLocation = (cluster: ClusterRecord): string => {
  if (
    cluster.kelurahanId &&
    typeof cluster.kelurahanId === "object" &&
    cluster.kelurahanId.name
  ) {
    return cluster.kelurahanId.name;
  }

  return cluster.clusterCode;
};

export default function ClusterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<{
    id: string;
    cluster: ClusterRecord | null;
    loading: boolean;
    error: string | null;
  }>({
    id: "",
    cluster: null,
    loading: true,
    error: null,
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    getClusterByIdOrCode(params.id)
      .then((data) => {
        if (active) {
          setDetail({
            id: params.id,
            cluster: data,
            loading: false,
            error: null,
          });
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setDetail({
            id: params.id,
            cluster: null,
            loading: false,
            error:
              requestError instanceof Error
                ? requestError.message
                : "Gagal memuat detail klaster.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [params.id, retryCount]);

  const loading = detail.id !== params.id || detail.loading;
  const cluster = detail.id === params.id ? detail.cluster : null;
  const error = detail.id === params.id ? detail.error : null;
  const retryLoad = () => {
    setDetail((current) => ({ ...current, loading: true, error: null }));
    setRetryCount((count) => count + 1);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EDF2EE] px-4">
        <p className="flex items-center gap-2 text-sm font-medium text-green-900">
          <RefreshCw size={18} className="animate-spin" />
          Memuat detail klaster...
        </p>
      </main>
    );
  }

  if (error || !cluster) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#EDF2EE] px-4 text-center">
        <h1 className="text-lg font-bold text-red-700">
          Detail klaster tidak dapat dimuat
        </h1>
        <p className="mt-2 max-w-sm text-sm text-gray-600">
          {error ?? "Data klaster tidak ditemukan."}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-full border border-green-800 px-4 py-2 text-sm font-semibold text-green-900"
          >
            Kembali
          </button>
          <button
            type="button"
            onClick={retryLoad}
            className="rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Coba lagi
          </button>
        </div>
      </main>
    );
  }

  const [longitude, latitude] = cluster.center.coordinates;

  return (
    <main className="min-h-screen bg-[#EDF2EE] px-4 pb-10 pt-4 sm:px-6">
      <div className="mx-auto max-w-[480px] space-y-4">
        <header className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Kembali ke dashboard"
            onClick={() => router.push("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B] shadow-sm"
          >
            <ArrowLeft size={19} />
          </button>
          <h1 className="text-base font-bold text-[#123D2B]">Detail Klaster</h1>
          <span className="h-10 w-10" aria-hidden="true" />
        </header>

        <section className="rounded-2xl bg-gradient-to-br from-[#0A9A50] via-[#006B3C] to-[#00462C] p-4 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">
                {getClusterLocation(cluster)}
              </h2>
              <p className="mt-1 text-[11px] text-green-100">
                {cluster.reportCount} laporan {cluster.category.toUpperCase()} ·{" "}
                {cluster.totalSickCount} orang terdampak
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${riskClasses[cluster.riskStatus]}`}
            >
              {cluster.riskStatus}
            </span>
          </div>

          <div className="my-4 flex items-end gap-3">
            <p className="text-5xl font-bold leading-none">
              {cluster.averageAqi ?? "—"}
            </p>
            <div className="pb-1">
              <p className="text-sm font-bold">
                {cluster.averageAqi === undefined
                  ? "AQI belum tersedia"
                  : "Indeks Kualitas Udara (AQI)"}
              </p>
              <p className="mt-1 text-[10px] text-green-100">
                Status penanganan: {statusLabels[cluster.status]}
              </p>
            </div>
          </div>

          {cluster.averageAqi !== undefined && (
            <AqiIndicator value={cluster.averageAqi} />
          )}
        </section>

        <section
          aria-label="Status penanganan klaster"
          className="grid grid-cols-3 gap-2"
        >
          {(["active", "monitoring", "resolved"] as const).map((status) => (
            <div
              key={status}
              className={`rounded-xl border px-2 py-2.5 text-center text-[11px] font-semibold ${
                cluster.status === status
                  ? "border-[#087546] bg-[#D9EEE1] text-[#164A32]"
                  : "border-[#D5E2D9] bg-white text-[#708477]"
              }`}
            >
              {statusLabels[status]}
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#264536]">
            Ringkasan Klaster
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#536D60]">
            Klaster {cluster.category.toUpperCase()} terdeteksi di{" "}
            {getClusterLocation(cluster)} dengan risiko{" "}
            {cluster.riskStatus.toLowerCase()}. Tinjau lokasi dan gejala dominan
            untuk menentukan tindak lanjut.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#F4F8F5] p-3">
              <p className="text-[10px] text-[#708477]">Jumlah laporan</p>
              <p className="mt-1 text-lg font-bold text-[#164A32]">
                {cluster.reportCount}
              </p>
            </div>
            <div className="rounded-xl bg-[#F4F8F5] p-3">
              <p className="text-[10px] text-[#708477]">Radius klaster</p>
              <p className="mt-1 text-lg font-bold text-[#164A32]">
                {cluster.radiusMeters} m
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#708477]">
              Gejala dominan
            </p>
            <p className="mt-1 text-xs text-[#264536]">
              {cluster.dominantSymptoms.length > 0
                ? cluster.dominantSymptoms.join(", ")
                : "Belum tersedia"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#264536]">Lokasi &amp; Waktu</h2>
          <p className="mt-3 flex items-start gap-2 text-xs text-[#536D60]">
            <MapPin size={15} className="mt-0.5 shrink-0 text-green-800" />
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </p>
          <p className="mt-3 text-xs text-[#536D60]">
            Pertama terdeteksi: {formatDate(cluster.firstDetectedAt)}
          </p>
          <p className="mt-1 text-xs text-[#536D60]">
            Pembaruan terakhir: {formatDate(cluster.lastUpdatedAt)}
          </p>
        </section>

        <Link
          href="/dashboard#map"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0B8749] to-[#00552F] px-4 py-3 text-sm font-bold text-white shadow-md"
        >
          <MapPin size={17} />
          Kembali ke peta klaster
        </Link>
      </div>
    </main>
  );
}