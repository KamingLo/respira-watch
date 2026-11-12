"use client";

import dynamic from "next/dynamic";

interface MapViewProps {
  selectedCategories: string[];
}

const MapCanvas = dynamic(
  () => import("./MapCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl bg-[#E9EAE2]">
        <p className="text-sm text-gray-500">
          Memuat peta...
        </p>
      </div>
    ),
  }
);

export default function MapView({
  selectedCategories,
}: MapViewProps) {
  return (
    <div className="h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <MapCanvas selectedCategories={selectedCategories} />
    </div>
  );
}
