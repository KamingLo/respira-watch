"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  Download,
  Flame,
  Layers3,
  MapPin,
  Radio,
  RefreshCw,
  Wind,
} from "lucide-react";

import AqiIndicator from "@/features/aqi/components/AqiIndicator/AqiIndicator";
import MapFilter from "@/features/map/components/MapFilter/MapFilter";
import MapView from "@/features/map/components/MapView/MapView";
import useMap from "@/features/map/hooks/useMap";
import { getClusters } from "@/services/cluster.service";
import { getAqiByCoordinates } from "@/services/aqi.service";
import { getAqiMap } from "@/services/map.service";
import { getPublicKelurahans, type PublicKelurahan } from "@/services/kelurahan.service";
import { isMapCategorySelected } from "@/features/map/utils/category";
import {
  getNasaFirmsHotspots,
  getRiskScoreMap,
} from "@/services/analytics.service";
import useDashboardSocket from "@/hooks/useDashboardSocket";

import type { MapPoint } from "@/types/map.types";
import type { ClusterRecord } from "@/types/cluster.types";
import type {
  NasaFirmsHotspots,
  RiskScoreMap,
} from "@/types/analytics.types";
import type { AqiResult } from "@/types/aqi.types";
import type { AqiMapItem } from "@/types/map.types";

const reportStatuses = [
  { label: "Baru", key: "pending" },
  { label: "Dipantau", key: "in_progress" },
  { label: "Verifikasi", key: "verified" },
  { label: "Selesai", key: "resolved" },
];

const getRecentPoints = (points: MapPoint[], periodDays: number) => {
  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;

  return points.filter((point) => {
    const reportedAt = Date.parse(point.reportedAt);
    return Number.isFinite(reportedAt) && reportedAt >= cutoff;
  });
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

const getWeeklyTrend = (points: MapPoint[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      date,
      label: new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
      }).format(date),
      count: 0,
    };
  });

  points.forEach((point) => {
    const reportedAt = new Date(point.reportedAt);
    if (!Number.isFinite(reportedAt.getTime())) return;

    const day = days.find(
      (item) => item.date.toDateString() === reportedAt.toDateString()
    );
    if (day) day.count += 1;
  });

  return days;
};

const escapeCsv = (value: string | number | null | undefined) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function DashboardPage() {
  const [selectedKelurahanId, setSelectedKelurahanId] = useState("");
  const [periodDays, setPeriodDays] = useState(3);
  const [showAqiLayer, setShowAqiLayer] = useState(true);
  const [aqiMap, setAqiMap] = useState<AqiMapItem[]>([]);
  const [aqiMapError, setAqiMapError] = useState<string | null>(null);
  const [kelurahans, setKelurahans] = useState<PublicKelurahan[]>([]);
  const [kelurahanError, setKelurahanError] = useState<string | null>(null);
  const mapFilters = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - periodDays * 24 * 60 * 60 * 1000);
    return {
      ...(selectedKelurahanId ? { kelurahanId: selectedKelurahanId } : {}),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [periodDays, selectedKelurahanId]);
  const {
    selectedCategories,
    setSelectedCategories,
    points,
    heatmap,
    loading,
    error,
    refetch,
  } = useMap(mapFilters);

  const [clusters, setClusters] = useState<ClusterRecord[]>([]);
  const [clustersLoading, setClustersLoading] = useState(true);
  const [clustersError, setClustersError] = useState<string | null>(null);
  const [clusterRequestId, setClusterRequestId] = useState(0);
  const [riskScores, setRiskScores] = useState<RiskScoreMap | null>(null);
  const [riskScoresLoading, setRiskScoresLoading] = useState(false);
  const [riskScoresError, setRiskScoresError] = useState<string | null>(null);
  const [showRiskLayer, setShowRiskLayer] = useState(false);
  const [hotspots, setHotspots] = useState<NasaFirmsHotspots | null>(null);
  const [hotspotsLoading, setHotspotsLoading] = useState(false);
  const [hotspotsError, setHotspotsError] = useState<string | null>(null);
  const [showHotspotsLayer, setShowHotspotsLayer] = useState(false);
  const [aqiData, setAqiData] = useState<AqiResult | null>(null);
  const [aqiLoadedKey, setAqiLoadedKey] = useState<string | null>(null);
  const [aqiError, setAqiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPublicKelurahans()
      .then((items) => {
        if (active) setKelurahans(items);
      })
      .catch((error: unknown) => {
        if (active) {
          setKelurahanError(
            error instanceof Error ? error.message : "Gagal memuat kelurahan."
          );
        }
      });
    getAqiMap()
      .then((data) => {
        if (active) setAqiMap(data.items);
      })
      .catch((error: unknown) => {
        if (active) {
          setAqiMapError(
            error instanceof Error ? error.message : "Gagal memuat lapisan AQI."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshClusters = useCallback(() => {
    setClustersLoading(true);
    setClustersError(null);
    setClusterRequestId((current) => current + 1);
  }, []);

  const refreshDashboardData = useCallback(() => {
    void refetch();
    refreshClusters();
  }, [refetch, refreshClusters]);

  const socketState = useDashboardSocket({
    onReportNew: () => {
      void refetch();
    },
    onClusterChanged: refreshDashboardData,
  });

  useEffect(() => {
    let active = true;

    getClusters({
      ...(selectedCategories.length === 1
        ? { category: selectedCategories[0].toLowerCase() }
        : {}),
      ...(selectedKelurahanId ? { kelurahanId: selectedKelurahanId } : {}),
      ...mapFilters,
    })
      .then((data) => {
        if (active) setClusters(data);
      })
      .catch((error: unknown) => {
        if (active) {
          setClustersError(
            error instanceof Error
              ? error.message
              : "Gagal memuat data klaster."
          );
        }
      })
      .finally(() => {
        if (active) setClustersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    clusterRequestId,
    selectedCategories,
    selectedKelurahanId,
    mapFilters,
  ]);

  const recentPoints = useMemo(
    () => getRecentPoints(points, periodDays),
    [points, periodDays]
  );
  const visibleClusters = useMemo(
    () =>
      clusters.filter((cluster) =>
        isMapCategorySelected(cluster.category, selectedCategories)
      ),
    [clusters, selectedCategories]
  );
  const activeClusters = useMemo(
    () => visibleClusters.filter((cluster) => cluster.status === "active"),
    [visibleClusters]
  );
  const featuredCluster = visibleClusters[0] ?? null;
  const weeklyTrend = useMemo(() => getWeeklyTrend(points), [points]);
  const aqiLatitude = featuredCluster?.center.coordinates[1] ?? -3.344;
  const aqiLongitude = featuredCluster?.center.coordinates[0] ?? 114.591;
  const aqiRequestKey = `${aqiLatitude},${aqiLongitude}`;
  const aqiLoading = aqiLoadedKey !== aqiRequestKey;

  useEffect(() => {
    let active = true;

    getAqiByCoordinates(aqiLatitude, aqiLongitude)
      .then((data) => {
        if (active) {
          setAqiData(data);
          setAqiError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAqiError(
            error instanceof Error
              ? error.message
              : "Gagal memuat data kualitas udara."
          );
          setAqiData(null);
        }
      })
      .finally(() => {
        if (active) setAqiLoadedKey(aqiRequestKey);
      });

    return () => {
      active = false;
    };
  }, [aqiLatitude, aqiLongitude, aqiRequestKey]);

  const loadRiskScores = useCallback(async () => {
    setRiskScoresLoading(true);
    setRiskScoresError(null);
    try {
      setRiskScores(await getRiskScoreMap());
    } catch (error: unknown) {
      setRiskScoresError(
        error instanceof Error
          ? error.message
          : "Gagal memuat skor risiko area."
      );
      setShowRiskLayer(false);
    } finally {
      setRiskScoresLoading(false);
    }
  }, []);

  const loadHotspots = useCallback(async () => {
    setHotspotsLoading(true);
    setHotspotsError(null);
    try {
      setHotspots(await getNasaFirmsHotspots());
    } catch (error: unknown) {
      setHotspotsError(
        error instanceof Error
          ? error.message
          : "Gagal memuat titik api."
      );
      setShowHotspotsLayer(false);
    } finally {
      setHotspotsLoading(false);
    }
  }, []);

  const toggleRiskLayer = () => {
    const shouldShow = !showRiskLayer;
    setShowRiskLayer(shouldShow);
    if (shouldShow && !riskScores) void loadRiskScores();
  };

  const toggleHotspotsLayer = () => {
    const shouldShow = !showHotspotsLayer;
    setShowHotspotsLayer(shouldShow);
    if (shouldShow && !hotspots) void loadHotspots();
  };

  const weeklyMaximum = Math.max(
    1,
    ...weeklyTrend.map((day) => day.count)
  );
  const weeklyTotal = weeklyTrend.reduce((total, day) => total + day.count, 0);
  const newClusterCount = activeClusters.length;
  const district =
    recentPoints.find((point) => point.kelurahan?.kecamatan)?.kelurahan
      ?.kecamatan ||
    (clusters[0]?.kelurahanId &&
    typeof clusters[0].kelurahanId === "object"
      ? clusters[0].kelurahanId.kecamatan
      : undefined) ||
    "Banjarmasin Selatan";
  const aqiValue = aqiData?.weatherAqi.aqi;
  const areaName = featuredCluster
    ? getClusterLocation(featuredCluster)
    : "RW 04 Kelayan Selatan";
  const selectedKelurahanName = kelurahans.find(
    (kelurahan) => kelurahan.id === selectedKelurahanId
  )?.name;
  const selectedPeriodLabel =
    periodDays === 3 ? "72 jam terakhir" : `${periodDays} hari terakhir`;
  const retryClusters = refreshClusters;

  const exportCsv = () => {
    const rows = [
      [
        "Waktu",
        "Kecamatan",
        "Kelurahan",
        "Kategori",
        "Gejala",
        "Jumlah",
        "Status",
      ],
      ...recentPoints.map((point) => [
        point.reportedAt,
        point.kelurahan?.kecamatan ?? "",
        point.kelurahan?.name ?? "",
        point.category,
        point.symptoms.join("; "),
        point.sickCount,
        point.status,
      ]),
    ];
    const csv = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");

    link.href = url;
    link.download = "respirawatch-laporan-72-jam.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="min-h-screen bg-[#F5F4ED]">
      <div className="min-h-screen w-full bg-[#F5F4ED]">
        <div className="grid min-h-screen gap-0 xl:grid-cols-[minmax(0,1fr)_348px]">
          <section className="flex min-w-0 flex-col gap-4 p-4">
            <header className="flex min-h-14 flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm md:px-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#E9F4ED] px-3 py-2 text-[11px] font-semibold text-[#385C4A]">
                <MapPin size={14} />
                Kec. {district}
              </span>

              <div className="rounded-full bg-[#E9F4ED] px-1 py-0.5">
                <MapFilter
                  selectedCategories={selectedCategories}
                  onChange={setSelectedCategories}
                />
              </div>

              <span className="rounded-full bg-[#E9F4ED] px-3 py-2 text-[11px] font-semibold text-[#385C4A]">
                <label htmlFor="dashboard-period" className="sr-only">
                  Rentang waktu
                </label>
                <select
                  id="dashboard-period"
                  value={periodDays}
                  onChange={(event) => setPeriodDays(Number(event.target.value))}
                  className="bg-transparent text-[11px] font-semibold text-[#385C4A] outline-none"
                >
                  <option value={3}>72 jam terakhir</option>
                  <option value={7}>7 hari terakhir</option>
                  <option value={14}>14 hari terakhir</option>
                </select>
              </span>
              <label htmlFor="dashboard-kelurahan" className="sr-only">
                Filter kelurahan
              </label>
              <select
                id="dashboard-kelurahan"
                value={selectedKelurahanId}
                onChange={(event) => setSelectedKelurahanId(event.target.value)}
                aria-describedby={kelurahanError ? "kelurahan-filter-error" : undefined}
                className="max-w-[200px] rounded-full bg-[#E9F4ED] px-3 py-2 text-[11px] font-semibold text-[#385C4A] outline-none"
              >
                <option value="">Semua kelurahan</option>
                {kelurahans.map((kelurahan) => (
                  <option key={kelurahan.id} value={kelurahan.id}>
                    {kelurahan.name}
                  </option>
                ))}
              </select>
              {kelurahanError && (
                <span id="kelurahan-filter-error" className="sr-only">
                  {kelurahanError}
                </span>
              )}
              <span
                title={socketState.error ?? "Koneksi real-time dashboard"}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold ${
                  socketState.status === "connected"
                    ? "bg-[#E1F4E8] text-[#176B45]"
                    : socketState.status === "connecting"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-red-50 text-red-700"
                }`}
              >
                <Radio size={13} />
                {socketState.status === "connected"
                  ? "Live"
                  : socketState.status === "connecting"
                    ? "Menghubungkan"
                    : "Live terputus"}
              </span>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("clusters")
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                }
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#E7194B] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#C91440]"
              >
                <Bell size={14} />
                {newClusterCount} Klaster Aktif
              </button>
            </header>

            <p className="px-1 text-xs text-[#708477]">
              Cakupan angka petugas: {selectedPeriodLabel} ·{" "}
              {selectedKelurahanName ?? "semua kelurahan"} · kategori sesuai
              filter · laporan ditolak tidak dihitung.
            </p>

            <section className="rounded-[22px] bg-gradient-to-br from-[#0A9A50] via-[#006B3C] to-[#00462C] p-4 text-white shadow-md xl:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold">{areaName}</h1>
                  <p className="mt-1 text-[11px] text-green-100">
                    {featuredCluster
                      ? `${featuredCluster.reportCount} laporan ${featuredCluster.category.toUpperCase()}`
                      : `${recentPoints.length} laporan dalam 72 jam terakhir`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/40 bg-red-500 px-2.5 py-1 text-[10px] font-bold">
                  {featuredCluster?.riskStatus ?? "Terpantau"}
                </span>
              </div>

              <div className="my-3 flex items-center gap-3">
                <p className="text-5xl font-bold leading-none">
                  {aqiValue ?? (aqiLoading ? "…" : "—")}
                </p>
                <div>
                  <p className="text-sm font-bold">Indeks Kualitas Udara</p>
                  <p className="mt-1 text-[10px] text-green-100">
                    {aqiData?.areaStatus.statusLabel ??
                      (aqiError
                        ? "AQI belum tersedia"
                        : featuredCluster
                      ? `${featuredCluster.totalSickCount} orang terdampak`
                      : `Kec. ${district}`)}
                  </p>
                </div>
              </div>

              {aqiValue !== undefined && <AqiIndicator value={aqiValue} />}
            </section>

            <section
              id="map"
              aria-label="Peta klaster laporan"
              className="flex min-h-[350px] flex-col rounded-[24px] bg-white p-3 shadow-sm xl:h-[calc(100vh-9rem)] xl:min-h-[540px]"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAqiLayer((visible) => !visible)}
                  aria-pressed={showAqiLayer}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold transition ${
                    showAqiLayer
                      ? "border-[#087546] bg-[#E2F2E8] text-[#164A32]"
                      : "border-[#D5E2D9] bg-white text-[#536D60]"
                  }`}
                >
                  <Wind size={14} />
                  Lapisan AQI
                </button>
                <button
                  type="button"
                  onClick={toggleRiskLayer}
                  disabled={riskScoresLoading}
                  aria-pressed={showRiskLayer}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold transition disabled:cursor-wait disabled:opacity-70 ${
                    showRiskLayer
                      ? "border-[#087546] bg-[#E2F2E8] text-[#164A32]"
                      : "border-[#D5E2D9] bg-white text-[#536D60] hover:bg-[#F4F8F5]"
                  }`}
                >
                  {riskScoresLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Layers3 size={14} />
                  )}
                  {riskScoresLoading ? "Memuat risiko..." : "Skor risiko"}
                </button>
                <button
                  type="button"
                  onClick={toggleHotspotsLayer}
                  disabled={hotspotsLoading}
                  aria-pressed={showHotspotsLayer}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold transition disabled:cursor-wait disabled:opacity-70 ${
                    showHotspotsLayer
                      ? "border-orange-400 bg-orange-50 text-orange-800"
                      : "border-[#D5E2D9] bg-white text-[#536D60] hover:bg-[#F4F8F5]"
                  }`}
                >
                  {hotspotsLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Flame size={14} />
                  )}
                  {hotspotsLoading ? "Memuat hotspot..." : "Titik api"}
                </button>
                {showRiskLayer && riskScores && (
                  <span className="text-[10px] text-[#536D60]">
                    {riskScores.totalGrids} grid · rata-rata{" "}
                    {riskScores.summary.averageScore.toFixed(1)}/100
                  </span>
                )}
                {showHotspotsLayer && hotspots && (
                  <span className="text-[10px] text-[#536D60]">
                    {hotspots.totalHotspots} hotspot · {hotspots.sourceSatellite}
                  </span>
                )}
              </div>
              {(aqiMapError || riskScoresError || hotspotsError || hotspots?.cache.upstreamNotice) && (
                <p
                  role="status"
                  className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900"
                >
                  {aqiMapError ?? riskScoresError ?? hotspotsError ?? hotspots?.cache.upstreamNotice}
                </p>
              )}
              <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-[18px] bg-[#EDEBE4] xl:min-h-[510px]">
                {loading ? (
                  <div className="flex h-full min-h-[320px] items-center justify-center xl:min-h-[510px]">
                    <div className="text-center text-[#38614B]">
                      <RefreshCw
                        size={24}
                        className="mx-auto animate-spin"
                      />
                      <p className="mt-3 text-sm font-medium">
                        Memuat peta klaster...
                      </p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center xl:min-h-[510px]">
                    <p className="text-sm font-semibold text-red-700">
                      Peta gagal dimuat
                    </p>
                    <p className="mt-2 text-xs text-gray-600">{error}</p>
                    <button
                      type="button"
                      onClick={refetch}
                      className="mt-4 rounded-full bg-[#006B3C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00552F]"
                    >
                      Coba lagi
                    </button>
                  </div>
                ) : (
                  <MapView
                    points={recentPoints}
                    heatmap={heatmap}
                    aqiItems={showAqiLayer ? aqiMap : []}
                    clusters={visibleClusters}
                    riskScores={
                      showRiskLayer && riskScores ? riskScores.items : []
                    }
                    hotspots={
                      showHotspotsLayer && hotspots ? hotspots.hotspots : []
                    }
                  />
                )}
              </div>
            </section>

            <section
              id="clusters"
              aria-labelledby="cluster-summary-heading"
              className="rounded-[22px] bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="cluster-summary-heading"
                    className="text-sm font-bold text-[#264536]"
                  >
                    Klaster aktif
                  </h2>
                  <p className="mt-1 text-[11px] text-[#708477]">
                    Detail lokasi dan risiko untuk tindak lanjut.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#E9F4ED] px-2.5 py-1 text-[10px] font-semibold text-[#426451]">
                  {activeClusters.length}
                </span>
              </div>

              {clustersLoading ? (
                <p className="mt-4 text-xs text-[#708477]">
                  Memuat data klaster...
                </p>
              ) : clustersError ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p role="alert" className="text-xs text-red-700">
                    {clustersError}
                  </p>
                  <button
                    type="button"
                    onClick={retryClusters}
                    className="rounded-full bg-[#E7F3EC] px-3 py-2 text-xs font-bold text-[#164A32]"
                  >
                    Coba lagi
                  </button>
                </div>
              ) : activeClusters.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {activeClusters.map((cluster) => (
                    <Link
                      key={cluster._id}
                      href={`/dashboard/clusters/${encodeURIComponent(cluster._id)}`}
                      className="block rounded-2xl border border-[#E3ECE6] bg-[#F7FAF7] p-3 transition hover:border-[#9BC8AA] hover:bg-[#F0F7F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087546]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#164A32]">
                            {getClusterLocation(cluster)}
                          </p>
                          {getClusterLocation(cluster) !==
                            cluster.clusterCode && (
                            <p className="mt-1 text-[10px] text-[#708477]">
                              {cluster.clusterCode}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            cluster.riskStatus === "Prioritas"
                              ? "bg-red-50 text-red-700"
                              : cluster.riskStatus === "Siaga"
                                ? "bg-orange-50 text-orange-700"
                                : "bg-yellow-50 text-yellow-800"
                          }`}
                        >
                          {cluster.riskStatus}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-[#536D60]">
                        {cluster.reportCount} laporan{" "}
                        {cluster.category.toUpperCase()} ·{" "}
                        {cluster.totalSickCount} orang terdampak
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#087546]">
                        Lihat detail klaster
                        <ChevronRight size={15} />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-[#F7FAF7] p-3 text-xs leading-relaxed text-[#708477]">
                  Belum ada klaster aktif untuk filter yang dipilih. Marker
                  laporan tetap ditampilkan di peta; klaster akan muncul setelah
                  deteksi backend menemukannya.
                </p>
              )}
            </section>
          </section>

          <aside className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-1">
            <section className="hidden rounded-[22px] bg-gradient-to-br from-[#0A9A50] via-[#006B3C] to-[#00462C] p-4 text-white shadow-md xl:block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold">
                    {areaName}
                  </h1>
                  <p className="mt-1 text-[11px] text-green-100">
                    {featuredCluster
                      ? `${featuredCluster.reportCount} laporan ${featuredCluster.category.toUpperCase()}`
                      : `${recentPoints.length} laporan dalam 72 jam terakhir`}
                  </p>
                </div>
                <span className="rounded-full border border-white/40 bg-red-500 px-2.5 py-1 text-[10px] font-bold">
                  {featuredCluster?.riskStatus ?? "Terpantau"}
                </span>
              </div>

              <div className="my-3 flex items-center gap-3">
                <p className="text-5xl font-bold leading-none">
                  {aqiValue ?? (aqiLoading ? "…" : "—")}
                </p>
                <div>
                  <p className="text-sm font-bold">Indeks Kualitas Udara</p>
                  <p className="mt-1 text-[10px] text-green-100">
                    {aqiData?.areaStatus.statusLabel ??
                      (aqiError
                        ? "AQI belum tersedia"
                        : featuredCluster
                      ? `${featuredCluster.totalSickCount} orang terdampak`
                      : `Kec. ${district}`)}
                  </p>
                </div>
              </div>

              {aqiValue !== undefined && <AqiIndicator value={aqiValue} />}
            </section>

            <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-white p-2 shadow-sm">
              {reportStatuses.map((status) => {
                const count = recentPoints.filter((point) =>
                  point.status.toLowerCase().includes(status.key)
                ).length;

                return (
                  <div
                    key={status.key}
                    className={`rounded-xl border px-1 py-2 text-center ${
                      status.key === "verifikasi"
                        ? "border-[#087546] bg-[#E8F4EC] text-[#164A32]"
                        : "border-[#D5E2D9] text-[#536D60]"
                    }`}
                    title={`${count} laporan`}
                  >
                    <span className="block truncate text-[9px] font-bold">
                      {status.label}
                    </span>
                    <span className="mt-1 block text-[10px]">{count}</span>
                  </div>
                );
              })}
            </div>

            <section
              id="trend"
              className="rounded-[22px] bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-1 xl:min-h-[320px]"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#264536]">
                  Tren Laporan 7 Hari
                </h2>
                <span className="rounded-full bg-[#E9F4ED] px-2.5 py-1 text-[10px] font-semibold text-[#426451]">
                  {weeklyTotal} laporan
                </span>
              </div>

              <div
                role="img"
                aria-label={`Grafik laporan 7 hari, total ${weeklyTotal} laporan`}
                className="relative mt-4 h-28"
              >
                <div className="absolute inset-0 flex flex-col justify-between">
                  <span className="border-t border-[#EEF1EC]" />
                  <span className="border-t border-[#EEF1EC]" />
                  <span className="border-t border-[#EEF1EC]" />
                </div>
                <div className="absolute inset-x-1 bottom-0 top-2 flex items-end justify-around gap-2">
                  {weeklyTrend.map((day, index) => (
                    <div
                      key={day.date.toISOString()}
                      title={`${day.label}: ${day.count} laporan`}
                      className={`w-full max-w-7 rounded-t-md ${
                        day.count === 0
                          ? "bg-[#E7F2EC]"
                          : index === weeklyTrend.length - 1
                            ? "bg-[#087546]"
                            : "bg-[#123D2B]"
                      }`}
                      style={{
                        height: `${Math.max(
                          8,
                          (day.count / weeklyMaximum) * 78
                        )}%`,
                      }}
                    />
                  ))}
                </div>
                <svg
                  viewBox="0 0 320 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  <polyline
                    points={weeklyTrend
                      .map((day, index) => {
                        const x =
                          12 + (index * 296) / (weeklyTrend.length - 1);
                        const y =
                          88 - (day.count / weeklyMaximum) * 62;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#F97316"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>

              <div className="mt-2 flex justify-around text-[9px] text-[#708477]">
                {weeklyTrend.map((day) => (
                  <span key={day.date.toISOString()}>{day.label}</span>
                ))}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-[#536D60]">
                {weeklyTotal > 0
                  ? `${weeklyTotal} laporan kesehatan tercatat dalam 7 hari terakhir.`
                  : "Belum ada laporan yang tercatat dalam 7 hari terakhir."}
              </p>
            </section>

            <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#E7F3EC] px-3 py-3 text-xs font-bold text-[#164A32] transition hover:bg-[#D8EDE1]"
              >
                <Download size={15} />
                Ekspor CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0B8749] to-[#00552F] px-3 py-3 text-xs font-bold text-white shadow-md transition hover:brightness-110"
              >
                <ClipboardList size={15} />
                Ekspor Laporan PDF
              </button>
            </div>
          </aside>
        </div>
      </div>

    </main>
  );
}
