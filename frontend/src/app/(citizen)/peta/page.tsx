"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  RefreshCw,
} from "lucide-react";

import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import Badge from "@/components/ui/Badge/Badge";

import MapView from "@/features/map/components/MapView/MapView";
import MapFilter from "@/features/map/components/MapFilter/MapFilter";
import MapLegend from "@/features/map/components/MapLegend/MapLegend";
import AqiCard from "@/features/aqi/components/AqiCard/AqiCard";

import useMap from "@/features/map/hooks/useMap";
import { getAqiByCoordinates } from "@/services/aqi.service";
import { getAqiMap } from "@/services/map.service";
import type { AqiResult } from "@/types/aqi.types";
import type { AqiMapItem } from "@/types/map.types";

export default function CitizenMapPage() {
  const router = useRouter();
  const [aqiData, setAqiData] = useState<AqiResult | null>(null);
  const [aqiLoading, setAqiLoading] = useState(false);
  const [aqiError, setAqiError] = useState<string | null>(null);
  const [aqiMap, setAqiMap] = useState<AqiMapItem[]>([]);
  const [aqiMapError, setAqiMapError] = useState<string | null>(null);
  const [showAqiLayer, setShowAqiLayer] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const {
    selectedCategories,
    setSelectedCategories,
    points,
    heatmap,
    loading,
    error,
    refetch,
  } = useMap();

  useEffect(() => {
    let active = true;
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

  const handleReport = () => {
    router.push("/lapor");
  };

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
          .catch((error: unknown) => {
            setAqiError(
              error instanceof Error
                ? error.message
                : "Gagal memuat kualitas udara di lokasi ini."
            );
          })
          .finally(() => setAqiLoading(false));
      },
      (error) => {
        setAqiLoading(false);
        setAqiError(
          error.code === error.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk melihat AQI sekitar."
            : "Lokasi belum bisa didapatkan. Coba lagi."
        );
      },
      { enableHighAccuracy: false, timeout: 10_000 }
    );
  }, []);

  // Menghitung jumlah laporan berdasarkan filter aktif
  const ispaCount = points.filter(
    (point) => point.category.trim().toLowerCase() === "ispa"
  ).length;

  const diareCount = points.filter(
    (point) => point.category.trim().toLowerCase() === "diare"
  ).length;

  return (
    <main className="min-h-screen bg-[#EDF2EE] p-4 pb-28 md:p-6">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* MAIN CONTENT */}
        <section className="min-w-0 space-y-5">

          {/* HEADER */}
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">
                Halo, Rina 👋
              </p>

              <h1 className="mt-1 text-xl font-bold text-[#123D2B] md:text-2xl">
                Pantau Udara & Gejala
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Pantau kondisi lingkungan di sekitarmu.
              </p>
            </div>

          </header>

          <div className="lg:hidden">
            <AqiCard
              data={aqiData}
              loading={aqiLoading}
              error={aqiError}
              onRefresh={requestNearbyAqi}
            />
          </div>

          {/* MAP CARD */}
          <Card className="!p-3 md:!p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-800 md:text-lg">
                  Peta Persebaran Laporan
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Pantau laporan gejala di sekitar wilayahmu.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div
                  aria-label="Kontrol lapisan peta"
                  className="flex gap-2 lg:hidden"
                >
                  <button
                    type="button"
                    aria-pressed={showHeatmap}
                    onClick={() => setShowHeatmap((visible) => !visible)}
                    className={`h-11 rounded-full border px-4 py-2 text-sm font-semibold ${
                      showHeatmap
                        ? "border-green-800 bg-green-800 text-white"
                        : "border-green-800 bg-white text-green-800"
                    }`}
                  >
                    Heatmap
                  </button>
                  <button
                    type="button"
                    aria-pressed={showAqiLayer}
                    onClick={() => setShowAqiLayer((visible) => !visible)}
                    className={`h-11 rounded-full border px-4 py-2 text-sm font-semibold ${
                      showAqiLayer
                        ? "border-green-800 bg-green-800 text-white"
                        : "border-green-800 bg-white text-green-800"
                    }`}
                  >
                    AQI
                  </button>
                </div>

                <MapFilter
                  selectedCategories={selectedCategories}
                  onChange={setSelectedCategories}
                />
              </div>
            </div>

            {/* MAP CONTENT */}
            <div className="relative h-[350px] overflow-hidden rounded-xl md:h-[500px] lg:h-[calc(100vh-280px)] lg:min-h-[520px]">

              {loading ? (
                <div className="flex h-full items-center justify-center bg-green-50">
                  <div className="text-center">
                    <RefreshCw
                      size={25}
                      className="mx-auto animate-spin text-green-700"
                    />

                    <p className="mt-3 text-sm text-green-800">
                      Memuat data peta...
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center bg-green-50 px-4 text-center">
                  <p className="font-semibold text-red-700">
                    Gagal memuat data peta
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    {error}
                  </p>

                  <button
                    onClick={refetch}
                    className="mt-4 flex items-center gap-2 rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900"
                  >
                    <RefreshCw size={15} />
                    Coba Lagi
                  </button>
                </div>
              ) : (
                <MapView
                  points={points}
                  heatmap={showHeatmap ? heatmap : []}
                  aqiItems={showAqiLayer ? aqiMap : []}
                />
              )}
            </div>
            {aqiMapError && (
              <p role="status" className="mt-2 text-xs text-amber-800">
                {aqiMapError}
              </p>
            )}

            {/* MAP LEGEND */}
            <div className="mt-4">
              <MapLegend />
            </div>

            {/* REPORT SUMMARY */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <div>
                <p className="text-xs text-gray-500">
                  Laporan sesuai filter
                </p>

                <p className="mt-1 text-lg font-bold text-green-800">
                  {points.length} laporan
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Semua wilayah dan tanggal; laporan yang ditolak tidak dihitung.
                </p>
              </div>

              <div className="flex gap-2">
                <Badge variant="success">
                  ISPA: {ispaCount}
                </Badge>

                <Badge variant="warning">
                  Diare: {diareCount}
                </Badge>
              </div>
            </div>
          </Card>

          {/* REPORT BUTTON */}
          <Button
            fullWidth
            size="large"
            onClick={handleReport}
            className="!rounded-full !bg-gradient-to-r !from-green-700 !to-green-900 !py-4 shadow-lg"
          >
            <FileText size={19} />
            Lapor Gejala
          </Button>
        </section>

        {/* DESKTOP INFORMATION PANEL */}
        <aside className="hidden min-w-0 space-y-5 lg:sticky lg:top-20 lg:block lg:self-start">

          <AqiCard
            data={aqiData}
            loading={aqiLoading}
            error={aqiError}
            onRefresh={requestNearbyAqi}
          />
        </aside>
      </div>
    </main>
  );
}
