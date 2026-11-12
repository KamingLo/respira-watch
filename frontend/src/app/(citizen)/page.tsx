"use client";

import MapView from "@/features/map/components/MapView/MapView";
import MapFilter from "@/features/map/components/MapFilter/MapFilter";
import MapLegend from "@/features/map/components/MapLegend/MapLegend";
import AqiCard from "@/features/aqi/components/AqiCard/AqiCard";
import useMap from "@/features/map/hooks/useMap";

export default function HomePage() {
  const {
    selectedCategories,
    setSelectedCategories,
  } = useMap();

  return (
    <main className="min-h-screen bg-[#EDF2EE] p-4 pb-24 lg:p-6">

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)_320px]">

        {/* Desktop Sidebar */}
        <aside className="hidden rounded-2xl bg-white p-5 lg:block">
          <h2 className="text-xl font-bold text-green-800">
            RespiraWatch
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Pantau kesehatan lingkunganmu.
          </p>

          <div className="mt-8 space-y-4 text-sm text-gray-700">
            <p className="font-semibold text-green-700">
              Peta Publik
            </p>
            <p>Lapor Gejala</p>
            <p>Informasi Kesehatan</p>
          </div>
        </aside>

        {/* Main Map Content */}
        <section className="min-w-0 space-y-4">

          <div>
            <p className="text-sm text-gray-600">
              Halo, Rina
            </p>

            <h1 className="text-xl font-bold text-[#123D2B] md:text-2xl">
              Pantau Udara & Gejala
            </h1>
          </div>

          {/* Mobile AQI */}
          <div className="lg:hidden">
            <AqiCard
              value={118}
              location="Kel. Kelayan Selatan"
              subLocation="RW 04 · Banjarmasin Selatan"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
            <h2 className="font-semibold text-gray-800">
              Peta Persebaran Laporan
            </h2>

            <MapFilter
              selectedCategories={selectedCategories}
              onChange={setSelectedCategories}
            />
          </div>

          <div className="h-[350px] overflow-hidden rounded-2xl lg:h-[calc(100vh-180px)] lg:min-h-[500px]">
            <MapView
              selectedCategories={selectedCategories}
            />
          </div>

          <MapLegend />

          {/* Mobile Report Button */}
          <button className="w-full rounded-full bg-gradient-to-r from-green-600 to-green-900 py-4 font-bold text-white shadow-lg lg:hidden">
            Lapor Gejala
          </button>

        </section>

        {/* Desktop Information Panel */}
        <aside className="hidden space-y-4 lg:block">
          <AqiCard
            value={118}
            location="Kel. Kelayan Selatan"
            subLocation="RW 04 · Banjarmasin Selatan"
          />

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-bold text-gray-800">
              Informasi Wilayah
            </h3>

            <p className="mt-3 text-sm text-gray-600">
              7 laporan gejala dalam wilayah ini.
            </p>

            <div className="mt-4 rounded-xl bg-green-50 p-3">
              <p className="text-sm font-semibold text-green-800">
                Status: Waspada
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Tetap pantau kondisi lingkungan dan kesehatan.
              </p>
            </div>
          </div>

          <button className="w-full rounded-full bg-green-800 py-4 font-bold text-white">
            Lapor Gejala
          </button>
        </aside>

      </div>
    </main>
  );
}
