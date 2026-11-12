"use client";

import dynamic from "next/dynamic";

const MapCanvas = dynamic(
  () => import("./MapCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl bg-green-50">
        <p className="text-sm text-green-800">
          Memuat peta...
        </p>
      </div>
    ),
  }
);

interface MapViewProps {
  selectedCategories: string[];
}

export default function MapView({
  selectedCategories,
}: MapViewProps) {
  return (
    <MapCanvas selectedCategories={selectedCategories} />
  );
}