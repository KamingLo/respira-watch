"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, RefreshCw, Sparkles } from "lucide-react";

import AqiIndicator from "@/features/aqi/components/AqiIndicator/AqiIndicator";
import {
  getClusterByIdOrCode,
  getClusterTrend,
  updateClusterStatus,
} from "@/services/cluster.service";
import { getClusterAiSummary } from "@/services/ai.service";
import { getCurrentWeather } from "@/services/analytics.service";
import useDashboardSocket from "@/hooks/useDashboardSocket";
import type { ClusterRecord, ClusterStatus } from "@/types/cluster.types";
import type { ClusterAiSummary } from "@/types/ai.types";
import type {
  ClusterReportTrend,
  CurrentWeather,
} from "@/types/analytics.types";

const statusLabels: Record<ClusterRecord["status"], string> = {
  active: "Aktif",
  monitoring: "Dipantau",
  verified: "Diverifikasi lapangan",
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
  const [summaryState, setSummaryState] = useState<
    | {
        requestKey: string;
        status: "success";
        data: ClusterAiSummary;
      }
    | {
        requestKey: string;
        status: "error";
        error: string;
      }
    | null
  >(null);
  const [summaryRetryCount, setSummaryRetryCount] = useState(0);
  const [trendState, setTrendState] = useState<{
    clusterId: string;
    data?: ClusterReportTrend;
    error?: string;
  } | null>(null);
  const [weatherState, setWeatherState] = useState<{
    requestKey: string;
    data?: CurrentWeather;
    error?: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<ClusterStatus | null>(
    null
  );
  const [statusError, setStatusError] = useState<string | null>(null);

  const refreshDetail = useCallback(() => {
    setDetail((current) => ({ ...current, loading: true, error: null }));
    setRetryCount((count) => count + 1);
  }, []);

  const socketState = useDashboardSocket({
    onClusterChanged: refreshDetail,
  });

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
  const clusterId = cluster?._id;
  const summaryRequestKey = clusterId
    ? `${clusterId}:${summaryRetryCount}`
    : null;
  const currentSummaryState =
    summaryState?.requestKey === summaryRequestKey ? summaryState : null;
  const summaryLoading = Boolean(clusterId) && currentSummaryState === null;
  const summary =
    currentSummaryState?.status === "success" ? currentSummaryState.data : null;
  const summaryError =
    currentSummaryState?.status === "error" ? currentSummaryState.error : null;
  const trend =
    trendState && trendState.clusterId === clusterId ? trendState.data : null;
  const trendError =
    trendState && trendState.clusterId === clusterId ? trendState.error : null;
  const weatherLatitude = cluster?.center.coordinates[1];
  const weatherLongitude = cluster?.center.coordinates[0];
  const weatherRequestKey =
    weatherLatitude !== undefined && weatherLongitude !== undefined
      ? `${weatherLatitude},${weatherLongitude}`
      : null;
  const weather =
    weatherState?.requestKey === weatherRequestKey ? weatherState.data : null;
  const weatherError =
    weatherState?.requestKey === weatherRequestKey ? weatherState.error : null;

  useEffect(() => {
    if (!clusterId) return;

    let active = true;
    const requestKey = `${clusterId}:${summaryRetryCount}`;

    getClusterAiSummary(clusterId)
      .then((data) => {
        if (active) {
          setSummaryState({ requestKey, status: "success", data });
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setSummaryState({
            requestKey,
            status: "error",
            error:
              requestError instanceof Error
                ? requestError.message
                : "Gagal memuat ringkasan AI klaster.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [clusterId, summaryRetryCount]);

  useEffect(() => {
    if (!clusterId) return;

    let active = true;
    getClusterTrend(clusterId)
      .then((data) => {
        if (active) setTrendState({ clusterId, data });
      })
      .catch((requestError: unknown) => {
        if (active) {
          setTrendState({
            clusterId,
            error:
              requestError instanceof Error
                ? requestError.message
                : "Gagal memuat tren laporan.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [clusterId]);

  useEffect(() => {
    if (
      !weatherRequestKey ||
      weatherLatitude === undefined ||
      weatherLongitude === undefined
    ) {
      return;
    }

    let active = true;
    getCurrentWeather(weatherLatitude, weatherLongitude)
      .then((data) => {
        if (active) setWeatherState({ requestKey: weatherRequestKey, data });
      })
      .catch((requestError: unknown) => {
        if (active) {
          setWeatherState({
            requestKey: weatherRequestKey,
            error:
              requestError instanceof Error
                ? requestError.message
                : "Gagal memuat data cuaca.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [weatherLatitude, weatherLongitude, weatherRequestKey]);

  const handleStatusChange = async (status: ClusterStatus) => {
    if (!cluster || updatingStatus) return;

    setUpdatingStatus(status);
    setStatusError(null);
    try {
      const updatedCluster = await updateClusterStatus(cluster._id, status);
      setDetail((current) => ({
        ...current,
        cluster: updatedCluster,
      }));
      setSummaryRetryCount((count) => count + 1);
    } catch (requestError: unknown) {
      setStatusError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memperbarui status klaster."
      );
    } finally {
      setUpdatingStatus(null);
    }
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
            onClick={refreshDetail}
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
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {(["active", "monitoring", "verified", "resolved"] as const).map((status) => (
            <button
              type="button"
              key={status}
              onClick={() => void handleStatusChange(status)}
              disabled={cluster.status === status || updatingStatus !== null}
              aria-pressed={cluster.status === status}
              className={`rounded-xl border px-2 py-2.5 text-center text-[11px] font-semibold ${
                cluster.status === status
                  ? "border-[#087546] bg-[#D9EEE1] text-[#164A32]"
                  : "border-[#D5E2D9] bg-white text-[#708477] hover:bg-[#F4F8F5]"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {updatingStatus === status ? (
                <span className="inline-flex items-center gap-1">
                  <RefreshCw size={12} className="animate-spin" />
                  Menyimpan
                </span>
              ) : (
                statusLabels[status]
              )}
            </button>
          ))}
        </section>
        {statusError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {statusError}
          </p>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#087546]" />
            <h2 className="text-sm font-bold text-[#264536]">
              Ringkasan AI Klaster
            </h2>
          </div>

          {summaryLoading ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-[#708477]">
              <RefreshCw size={14} className="animate-spin" />
              Menyusun ringkasan...
            </p>
          ) : summaryError ? (
            <div className="mt-3 rounded-xl bg-amber-50 p-3">
              <p role="alert" className="text-xs text-amber-900">
                {summaryError}
              </p>
              <button
                type="button"
                onClick={() => setSummaryRetryCount((count) => count + 1)}
                className="mt-2 text-xs font-bold text-[#087546] underline"
              >
                Coba lagi
              </button>
            </div>
          ) : summary ? (
            <>
              <p className="mt-3 text-sm font-bold text-[#164A32]">
                {summary.aiSummary.headline}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#536D60]">
                {summary.aiSummary.executiveSummary}
              </p>
              <p className="mt-3 rounded-xl bg-[#F4F8F5] p-3 text-xs leading-relaxed text-[#536D60]">
                {summary.aiSummary.environmentalCorrelation}
              </p>
              <ul className="mt-3 space-y-2">
                {summary.aiSummary.recommendedInterventions.map(
                  (intervention, index) => (
                    <li
                      key={`${index}-${intervention}`}
                      className="flex gap-2 text-xs leading-relaxed text-[#536D60]"
                    >
                      <span className="font-bold text-[#087546]">
                        {index + 1}.
                      </span>
                      {intervention}
                    </li>
                  )
                )}
              </ul>
              {summary.aiSummary.urgencyNotes && (
                <p className="mt-3 text-xs font-semibold text-orange-800">
                  {summary.aiSummary.urgencyNotes}
                </p>
              )}
              <p className="mt-3 text-[10px] text-[#708477]">
                {summary.meta.usedFallback
                  ? "Ringkasan berbasis fallback data klaster."
                  : `Dibuat dengan AI · ${summary.meta.model}`}
                {summary.cache.cached ? " · Data tersimpan sementara" : ""}
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-[#708477]">
              Ringkasan AI belum tersedia.
            </p>
          )}

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

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#264536]">
            Tren Laporan 7 Hari
          </h2>
          {trendError ? (
            <p role="alert" className="mt-3 text-xs text-red-700">
              {trendError}
            </p>
          ) : trend ? (
            <>
              <div
                className="mt-4 grid grid-cols-7 items-end gap-2"
                aria-label="Jumlah laporan per hari selama tujuh hari"
              >
                {trend.days.map((day) => {
                  const maxCount = Math.max(
                    1,
                    ...trend.days.map((item) => item.count)
                  );
                  return (
                    <div
                      key={day.date}
                      className="flex flex-col items-center gap-1"
                      title={`${day.count} laporan`}
                    >
                      <span className="text-[10px] font-semibold text-[#536D60]">
                        {day.count}
                      </span>
                      <div className="flex h-20 w-full items-end rounded-t-md bg-[#F0F5F1]">
                        <div
                          className="w-full rounded-t-md bg-[#0B8749]"
                          style={{
                            height: `${Math.max(8, (day.count / maxCount) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-[#708477]">
                        {new Intl.DateTimeFormat("id-ID", {
                          weekday: "short",
                        }).format(new Date(`${day.date}T12:00:00Z`))}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] text-[#708477]">
                Data laporan yang terhubung ke klaster ini.
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-[#708477]">
              Memuat tren laporan...
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#264536]">
            Cuaca &amp; Curah Hujan
          </h2>
          {weatherError ? (
            <p role="alert" className="mt-3 text-xs text-red-700">
              {weatherError}
            </p>
          ) : weather ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["Suhu", `${weather.temperatureC}°C`],
                  ["Kelembapan", `${weather.humidityPct}%`],
                  ["Angin", `${weather.windSpeedKmh} km/j`],
                  [
                    "Curah hujan",
                    weather.precipitationMm === undefined
                      ? "Tidak tersedia"
                      : `${weather.precipitationMm} mm`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#F4F8F5] p-3">
                    <p className="text-[10px] text-[#708477]">{label}</p>
                    <p className="mt-1 text-sm font-bold text-[#164A32]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-[#708477]">
                {weather.source === "open_meteo_live"
                  ? "Cuaca terkini dari Open-Meteo."
                  : weather.source === "mongodb_reading"
                    ? "Menggunakan data cuaca tersimpan."
                    : "Layanan cuaca langsung tidak tersedia; nilai adalah perkiraan."}
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-[#708477]">Memuat data cuaca...</p>
          )}
        </section>

        <Link
          href="/dashboard#map"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0B8749] to-[#00552F] px-4 py-3 text-sm font-bold text-white shadow-md"
        >
          <MapPin size={17} />
          Kembali ke peta klaster
        </Link>
        <p
          className="text-center text-[10px] text-[#708477]"
          title={socketState.error ?? undefined}
        >
          Real-time:{" "}
          {socketState.status === "connected"
            ? "terhubung"
            : socketState.status === "connecting"
              ? "menghubungkan"
              : "tidak terhubung"}
        </p>
      </div>
    </main>
  );
}