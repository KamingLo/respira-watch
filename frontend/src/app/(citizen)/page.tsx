"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  MapPin,
  FileText,
  Activity,
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

export default function HomePage() {
  const router = useRouter();

  const {
    selectedCategories,
    setSelectedCategories,
    points,
    loading,
    error,
    refetch,
  } = useMap();

  const handleReport = () => {
    router.push("/lapor");
  };

  // Menghitung jumlah laporan berdasarkan filter aktif
  const ispaCount = points.filter(
    (point) => point.category.toLowerCase() === "ispa"
  ).length;

  const diareCount = points.filter(
    (point) => point.category.toLowerCase() === "diare"
  ).length;

  return (
    <main className="min-h-screen bg-[#EDF2EE] p-4 pb-28 md:p-6">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)_300px]">

        {/* DESKTOP CITIZEN SIDEBAR */}
        <aside className="hidden lg:block">
          <Card className="sticky top-6 min-h-[calc(100vh-3rem)]">
            <div className="flex items-center gap-2">
              <Activity className="text-green-700" size={26} />

              <h2 className="text-xl font-bold text-green-800">
                RespiraWatch
              </h2>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Pantau kesehatan lingkunganmu.
            </p>

            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-green-50 p-3 font-semibold text-green-800">
                <MapPin size={19} />
                Peta Publik
              </div>

              <button
                onClick={handleReport}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-gray-600 transition hover:bg-green-50 hover:text-green-800"
              >
                <FileText size={19} />
                Lapor Gejala
              </button>
            </div>
          </Card>
        </aside>

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

            <button
              aria-label="Notifikasi"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-green-800 shadow-sm transition hover:bg-green-50"
            >
              <Bell size={21} />
            </button>
          </header>

          {/* AQI - MOBILE ONLY */}
          <div className="lg:hidden">
            <AqiCard
              value={118}
              location="Kel. Kelayan Selatan"
              subLocation="RW 04 · Banjarmasin Selatan"
            />
          </div>

          {/* MAP CARD */}
          <Card className="!p-3 md:!p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-800">
                  Peta Persebaran Laporan
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Pantau laporan gejala di sekitar wilayahmu.
                </p>
              </div>

              <MapFilter
                selectedCategories={selectedCategories}
                onChange={setSelectedCategories}
              />
            </div>

            {/* MAP CONTENT */}
            <div className="relative h-[350px] overflow-hidden rounded-xl md:h-[450px] lg:h-[calc(100vh-310px)] lg:min-h-[450px]">

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
                <MapView points={points} />
              )}
            </div>

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
        <aside className="hidden space-y-5 lg:block">

          <AqiCard
            value={118}
            location="Kel. Kelayan Selatan"
            subLocation="RW 04 · Banjarmasin Selatan"
          />

          <Card title="Informasi Wilayah">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Status wilayah
              </span>

              <Badge variant="warning">
                Waspada
              </Badge>
            </div>

            <div className="mt-4 rounded-xl bg-green-50 p-4">
              <p className="text-2xl font-bold text-green-800">
                {points.length}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Laporan sesuai filter kategori.
              </p>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-gray-500">
              Tetap pantau kondisi lingkungan dan jaga kesehatan.
            </p>
          </Card>

          <Card>
            <h3 className="font-bold text-gray-800">
              Tips Kesehatan
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Gunakan masker ketika kualitas udara kurang baik
              dan kurangi aktivitas berat di luar ruangan.
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
