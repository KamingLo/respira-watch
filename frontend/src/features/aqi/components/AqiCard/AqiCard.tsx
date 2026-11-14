import AqiIndicator from "../AqiIndicator/AqiIndicator";
import type { AqiResult } from "@/types/aqi.types";

interface AqiCardProps {
  data: AqiResult | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function AqiCard({
  data,
  loading,
  error,
  onRefresh,
}: AqiCardProps) {
  const location = data?.kelurahan?.name ?? data?.cellCode ?? "Kualitas Udara Sekitar";
  const value = data?.weatherAqi.aqi;
  const recordedAt = data?.weatherAqi.recordedAt
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.weatherAqi.recordedAt))
    : null;

  return (
    <section className="w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#047857] to-[#064E3B] p-5 text-white shadow-md">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 text-lg font-bold">
            {location}
          </h2>
          <p className="mt-1 text-xs text-green-100">
            {data?.kelurahan?.kecamatan ?? "Lokasi terdekat"}
          </p>
        </div>

        <div className="rounded-xl bg-white/15 p-2">
          <span className="text-2xl">🌿</span>
        </div>
      </div>

      {/* AQI Value */}
      <div className="mt-6 flex items-end gap-3">
        <div>
          <p className="text-xs font-medium text-green-100">
            Indeks Kualitas Udara
          </p>

          <p className="mt-1 text-5xl font-bold tracking-tight">
            {loading && value === undefined ? "…" : value ?? "—"}
          </p>
        </div>

        {data && (
          <span className="mb-1 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: data.areaStatus.colorHex }}>
            {data.areaStatus.statusLabel}
          </span>
        )}
      </div>

      {/* AQI Indicator */}
      {value !== undefined && (
        <div className="mt-5">
        <AqiIndicator value={value} />
        </div>
      )}

      {/* Description */}
      {data ? (
        <>
          <p className="mt-4 text-sm leading-relaxed text-green-50">
            PM2.5 {data.weatherAqi.pm25} · PM10 {data.weatherAqi.pm10}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-green-50">
            {data.areaStatus.healthRecommendation}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-green-100">
            {recordedAt ? `Data diperbarui ${recordedAt}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-green-50">
          {error ?? "Gunakan lokasi perangkat untuk melihat kualitas udara terdekat."}
        </p>
      )}

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="mt-4 rounded-full border border-white/60 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? "Memuat data AQI..." : data ? "Perbarui AQI" : "Gunakan lokasi saya"}
      </button>

    </section>
  );
}
