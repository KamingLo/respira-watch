"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Wind } from "lucide-react";

import { getAqiTrend } from "@/services/aqi.service";
import type { AqiTrend } from "@/types/aqi.types";

const getAqiStyle = (value: number) => {
  if (value <= 50) return { label: "Baik", color: "#10B981" };
  if (value <= 100) return { label: "Sedang", color: "#EAB308" };
  if (value <= 150) return { label: "Tidak sehat bagi kelompok sensitif", color: "#F97316" };
  if (value <= 200) return { label: "Tidak sehat", color: "#EF4444" };
  if (value <= 300) return { label: "Sangat tidak sehat", color: "#A855F7" };
  return { label: "Berbahaya", color: "#7F1D1D" };
};

const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("id-ID", options).format(
    new Date(`${date}T12:00:00+07:00`)
  );

const getWeightedAverage = (
  items: AqiTrend["items"],
  select: (item: AqiTrend["items"][number]) => number | null
) => {
  let weightedTotal = 0;
  let totalReadings = 0;

  items.forEach((item) => {
    const value = select(item);
    if (value === null || item.readingCount === 0) return;
    weightedTotal += value * item.readingCount;
    totalReadings += item.readingCount;
  });

  return totalReadings > 0
    ? Number((weightedTotal / totalReadings).toFixed(1))
    : null;
};

export default function AqiTrendsPage() {
  const [days, setDays] = useState(7);
  const [refreshCount, setRefreshCount] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: AqiTrend;
    error?: string;
  } | null>(null);
  const requestKey = `${days}:${refreshCount}`;
  const loading = result?.key !== requestKey;
  const data = result?.key === requestKey ? result.data : undefined;
  const error = result?.key === requestKey ? result.error : undefined;

  useEffect(() => {
    let active = true;
    getAqiTrend(days)
      .then((trend) => {
        if (active) setResult({ key: requestKey, data: trend });
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            key: requestKey,
            error:
              requestError instanceof Error
                ? requestError.message
                : "Gagal memuat tren kualitas udara.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [days, requestKey]);

  const readings = useMemo(
    () => data?.items.filter((item) => item.averageAqi !== null) ?? [],
    [data]
  );
  const averageAqi = data
    ? getWeightedAverage(data.items, (item) => item.averageAqi)
    : null;
  const averagePm25 = data
    ? getWeightedAverage(data.items, (item) => item.averagePm25)
    : null;
  const averagePm10 = data
    ? getWeightedAverage(data.items, (item) => item.averagePm10)
    : null;
  const maxAqi = Math.max(100, ...readings.map((item) => item.averageAqi ?? 0));
  const lastUpdated = data
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.generatedAt))
    : null;

  return (
    <main className="min-h-screen bg-[#F5F4ED] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Kembali ke dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B]"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#123D2B]">
              Tren Kualitas Udara
            </h1>
            <p className="mt-1 text-sm text-[#536D60]">
              Rata-rata AQI dan polutan harian dari pembacaan grid.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshCount((count) => count + 1)}
            disabled={loading}
            aria-label="Muat ulang tren"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B] disabled:opacity-60"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <label
            htmlFor="aqi-trend-period"
            className="block text-sm font-bold text-[#264536]"
          >
            Rentang waktu
          </label>
          <select
            id="aqi-trend-period"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#B5D2C3] bg-white px-3 text-sm text-[#123D2B] sm:max-w-xs"
          >
            <option value={7}>7 hari terakhir</option>
            <option value={14}>14 hari terakhir</option>
            <option value={30}>30 hari terakhir</option>
          </select>
        </section>

        {error && (
          <section
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRefreshCount((count) => count + 1)}
              className="mt-2 font-bold underline"
            >
              Coba lagi
            </button>
          </section>
        )}

        {loading ? (
          <p className="flex items-center gap-2 rounded-2xl bg-white p-5 text-sm text-[#536D60]">
            <RefreshCw size={16} className="animate-spin" />
            Memuat data historis AQI...
          </p>
        ) : data && (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  label: "AQI rata-rata",
                  value: averageAqi,
                  unit: "",
                  icon: Wind,
                },
                {
                  label: "PM2.5 rata-rata",
                  value: averagePm25,
                  unit: "µg/m³",
                  icon: Wind,
                },
                {
                  label: "PM10 rata-rata",
                  value: averagePm10,
                  unit: "µg/m³",
                  icon: Wind,
                },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <article
                    key={metric.label}
                    className="rounded-2xl border border-[#E1EAE3] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-[#087546]">
                      <Icon size={16} />
                      <p className="text-xs font-semibold text-[#536D60]">
                        {metric.label}
                      </p>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-[#164A32]">
                      {metric.value ?? "—"}
                      {metric.value !== null && metric.unit && (
                        <span className="ml-1 text-xs font-medium text-[#708477]">
                          {metric.unit}
                        </span>
                      )}
                    </p>
                  </article>
                );
              })}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#264536]">
                    Rata-rata AQI per hari
                  </h2>
                  <p className="mt-1 text-xs text-[#708477]">
                    Setiap batang mewakili rata-rata pembacaan semua grid pada hari tersebut.
                  </p>
                </div>
                <span className="rounded-full bg-[#E9F4ED] px-3 py-1 text-xs font-bold text-[#176B45]">
                  Skala sampai {Math.ceil(maxAqi / 50) * 50}
                </span>
              </div>

              {readings.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#F4F8F5] p-4 text-sm text-[#536D60]">
                  Belum ada data AQI historis pada rentang ini. Data akan muncul
                  setelah sinkronisasi kualitas udara tersimpan.
                </p>
              ) : (
                <div className="mt-5 overflow-x-auto pb-2">
                  <div
                    className="grid h-52 items-end gap-2"
                    style={{
                      minWidth: `${Math.max(320, data.items.length * 38)}px`,
                      gridTemplateColumns: `repeat(${data.items.length}, minmax(0, 1fr))`,
                    }}
                    aria-label="Grafik rata-rata AQI harian"
                  >
                    {data.items.map((item) => {
                      const aqi = item.averageAqi;
                      const style = aqi === null ? null : getAqiStyle(aqi);
                      const height =
                        aqi === null
                          ? 0
                          : Math.max(4, (aqi / maxAqi) * 150);
                      return (
                        <div
                          key={item.date}
                          className="flex h-full flex-col items-center justify-end gap-1"
                          title={
                            aqi === null
                              ? `${item.date}: tidak ada data`
                              : `${item.date}: AQI ${aqi} (${style?.label})`
                          }
                        >
                          <span className="text-[9px] font-semibold text-[#536D60]">
                            {aqi ?? "—"}
                          </span>
                          <div className="flex h-[150px] w-full items-end rounded-t-md bg-[#F0F5F1]">
                            {style && (
                              <div
                                className="w-full rounded-t-md"
                                style={{
                                  height: `${height}px`,
                                  backgroundColor: style.color,
                                }}
                              />
                            )}
                          </div>
                          <span className="whitespace-nowrap text-[9px] text-[#708477]">
                            {formatDate(item.date, {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#EEF1EC] pt-3">
                {[
                  ["Baik", "#10B981"],
                  ["Sedang", "#EAB308"],
                  ["Tidak sehat", "#EF4444"],
                  ["Sangat tidak sehat", "#A855F7"],
                ].map(([label, color]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-[10px] text-[#536D60]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-[#264536]">
                Data per hari
              </h2>
              <div className="mt-3 divide-y divide-[#EEF1EC]">
                {[...data.items].reverse().map((item) => {
                  const style =
                    item.averageAqi === null
                      ? null
                      : getAqiStyle(item.averageAqi);
                  return (
                    <div
                      key={item.date}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#264536]">
                          {formatDate(item.date, {
                            weekday: "long",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                        <p className="mt-1 text-[11px] text-[#708477]">
                          {item.readingCount} pembacaan grid
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-sm font-bold"
                          style={{ color: style?.color ?? "#708477" }}
                        >
                          {item.averageAqi ?? "Tidak ada data"}
                          {item.averageAqi !== null && " AQI"}
                        </p>
                        {style && (
                          <p className="mt-1 text-[10px] text-[#708477]">
                            {style.label}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-[#708477]">
                          PM2.5 {item.averagePm25 ?? "—"} · PM10{" "}
                          {item.averagePm10 ?? "—"} µg/m³
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <p className="flex items-start gap-2 px-1 text-[10px] leading-relaxed text-[#708477]">
              <Wind size={13} className="mt-0.5 shrink-0" />
              Rata-rata dihitung dari pembacaan AQI grid yang tersimpan di
              server. Diperbarui: {lastUpdated ?? "belum tersedia"}.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
