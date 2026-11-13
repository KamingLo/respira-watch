"use client";

import dynamic from "next/dynamic";

import type { MapPoint } from "@/types/map.types";

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
  points: MapPoint[];
}

export default function MapView({
  points,
}: MapViewProps) {
  return <MapCanvas points={points} />;
}
