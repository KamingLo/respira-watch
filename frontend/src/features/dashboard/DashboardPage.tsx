"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  ClipboardList,
  Download,
  MapPin,
  RefreshCw,
  UserRound,
} from "lucide-react";

import AqiIndicator from "@/features/aqi/components/AqiIndicator/AqiIndicator";
import MapFilter from "@/features/map/components/MapFilter/MapFilter";
import MapView from "@/features/map/components/MapView/MapView";
import useMap from "@/features/map/hooks/useMap";
import Sidebar from "@/components/layout/Sidebar/Sidebar";

import type { MapPoint } from "@/types/map.types";

interface ClusterSummary {
  name: string;
  reports: number;
  ispa: number;
  diare: number;
  status: string;
  priority: boolean;
  lastReportedAt: number;
}

const reportStatuses = [
  { label: "Baru", key: "baru" },
  { label: "Dipantau", key: "pantau" },
  { label: "Verifikasi", key: "verifikasi" },
  { label: "Selesai", key: "selesai" },
];

const getRecentPoints = (points: MapPoint[]) => {
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;

  return points.filter((point) => {
    const reportedAt = Date.parse(point.reportedAt);
    return Number.isFinite(reportedAt) && reportedAt >= cutoff;
  });
};

const groupPointsByArea = (points: MapPoint[]): ClusterSummary[] => {
  const clusters = new Map<string, ClusterSummary>();

  points.forEach((point) => {
    const name = point.kelurahan?.name || "Wilayah belum diketahui";
    const timestamp = Date.parse(point.reportedAt);
    const cluster = clusters.get(name) ?? {
      name,
      reports: 0,
      ispa: 0,
      diare: 0,
      status: point.status,
      priority: false,
      lastReportedAt: 0,
    };

    cluster.reports += 1;
    if (point.category.toLowerCase() === "ispa") {
      cluster.ispa += 1;
    } else if (point.category.toLowerCase() === "diare") {
      cluster.diare += 1;
    }

    cluster.priority ||= ["berat", "kritis", "tinggi"].includes(
      point.severity.toLowerCase()
    );

    if (Number.isFinite(timestamp) && timestamp >= cluster.lastReportedAt) {
      cluster.lastReportedAt = timestamp;
      cluster.status = point.status;
    }

    clusters.set(name, cluster);
  });

  return [...clusters.values()].sort(
    (first, second) => second.reports - first.reports
  );
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
  const {
    selectedCategories,
    setSelectedCategories,
    points,
    loading,
    error,
    refetch,
  } = useMap();

  const recentPoints = useMemo(() => getRecentPoints(points), [points]);
  const clusters = useMemo(
    () => groupPointsByArea(recentPoints),
    [recentPoints]
  );
  const weeklyTrend = useMemo(() => getWeeklyTrend(points), [points]);

  const weeklyMaximum = Math.max(
    1,
    ...weeklyTrend.map((day) => day.count)
  );
  const weeklyTotal = weeklyTrend.reduce((total, day) => total + day.count, 0);
  const newClusterCount = clusters.filter(
    (cluster) => cluster.status.toLowerCase() === "baru"
  ).length;
  const district =
    recentPoints.find((point) => point.kelurahan?.kecamatan)?.kelurahan
      ?.kecamatan || "Banjarmasin Selatan";

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
    <main className="min-h-screen bg-[#F5F4ED] pb-20 lg:pb-0">
      <div className="min-h-screen w-full bg-[#F5F4ED]">
        <div className="grid min-h-screen gap-0 lg:grid-cols-[208px_minmax(0,1fr)] xl:grid-cols-[208px_minmax(0,1fr)_348px]">
          <Sidebar>
            {clusters.length === 0 ? (
              <p className="rounded-xl bg-white px-2.5 py-3 text-[11px] leading-relaxed text-[#708477]">
                Belum ada laporan baru dalam 72 jam terakhir.
              </p>
            ) : (
              clusters.slice(0, 3).map((cluster) => (
                <div
                  key={cluster.name}
                  className="rounded-xl bg-white px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-bold text-[#264536]">
                      {cluster.name}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                        cluster.priority
                          ? "bg-red-50 text-red-600"
                          : "bg-[#EAF5EE] text-[#176B45]"
                      }`}
                    >
                      {cluster.priority ? "Prioritas" : cluster.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#708477]">
                    {cluster.reports} laporan · {cluster.ispa} ISPA ·{" "}
                    {cluster.diare} Diare
                  </p>
                </div>
              ))
            )}
          </Sidebar>

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
                72 Jam Terakhir
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
                {newClusterCount} Klaster Baru
              </button>
            </header>

            <section
              id="map"
              aria-label="Peta klaster laporan"
              className="flex min-h-[540px] flex-col rounded-[24px] bg-white p-3 shadow-sm xl:h-[calc(100vh-9rem)]"
            >
              <div className="relative min-h-[510px] flex-1 overflow-hidden rounded-[18px] bg-[#EDEBE4]">
                {loading ? (
                  <div className="flex h-full min-h-[510px] items-center justify-center">
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
                  <div className="flex h-full min-h-[510px] flex-col items-center justify-center px-6 text-center">
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
                  <MapView points={recentPoints} />
                )}
              </div>
            </section>
          </section>

          <aside className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:grid-cols-1">
            <section className="rounded-[22px] bg-gradient-to-br from-[#0A9A50] via-[#006B3C] to-[#00462C] p-4 text-white shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold">
                    RW 04 Kelayan Selatan
                  </h1>
                  <p className="mt-1 text-[11px] text-green-100">
                    {recentPoints.length} laporan dalam 72 jam terakhir
                  </p>
                </div>
                <span className="rounded-full border border-white/40 bg-red-500 px-2.5 py-1 text-[10px] font-bold">
                  {118 > 100 ? "Prioritas" : "Terpantau"}
                </span>
              </div>

              <div className="my-3 flex items-center gap-3">
                <p className="text-5xl font-bold leading-none">118</p>
                <div>
                  <p className="text-sm font-bold">Udara Tidak Sehat</p>
                  <p className="mt-1 text-[10px] text-green-100">
                    Indeks Kualitas Udara (AQI)
                  </p>
                </div>
              </div>

              <AqiIndicator value={118} />
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
                  Tren 7 Hari &amp; Ringkasan
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
                  ? `${weeklyTotal} laporan tercatat dalam 7 hari terakhir. Pantau perubahan kualitas udara dan tindak lanjuti laporan prioritas.`
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

      <nav
        aria-label="Navigasi dashboard mobile"
        className="fixed bottom-3 left-1/2 z-[1100] w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 rounded-full border-2 border-[#B5D2C3] bg-white p-2 shadow-[0_8px_25px_rgba(0,80,45,0.12)] lg:hidden"
      >
        <div className="flex h-14 items-center gap-1">
          <Link
            href="/dashboard#map"
            aria-label="Peta Klaster"
            className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#006B3C] text-white"
          >
            <MapPin size={24} />
          </Link>
          <Link
            href="/dashboard#clusters"
            aria-label="Daftar Laporan"
            className="flex h-12 flex-1 items-center justify-center rounded-full text-[#0B2D1E] hover:bg-green-50"
          >
            <ClipboardList size={24} />
          </Link>
          <Link
            href="/dashboard#trend"
            aria-label="Tren Kualitas Udara"
            className="flex h-12 flex-1 items-center justify-center rounded-full text-[#0B2D1E] hover:bg-green-50"
          >
            <Activity size={24} />
          </Link>
          <Link
            href="/login"
            aria-label="Akun Petugas"
            className="flex h-12 flex-1 items-center justify-center rounded-full text-[#0B2D1E] hover:bg-green-50"
          >
            <UserRound size={24} />
          </Link>
        </div>
      </nav>
    </main>
  );
}
