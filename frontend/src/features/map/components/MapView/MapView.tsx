"use client";

import dynamic from "next/dynamic";

import type { MapPoint } from "@/types/map.types";
import type { ClusterRecord } from "@/types/cluster.types";
import type { AqiMapItem, MapHeatmapPoint } from "@/types/map.types";
import type {
  GridRiskScoreItem,
  NasaFirmsHotspot,
} from "@/types/analytics.types";

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
  clusters?: ClusterRecord[];
  riskScores?: GridRiskScoreItem[];
  hotspots?: NasaFirmsHotspot[];
  heatmap?: MapHeatmapPoint[];
  aqiItems?: AqiMapItem[];
}

export default function MapView({
  points,
  clusters = [],
  riskScores = [],
  hotspots = [],
  heatmap = [],
  aqiItems = [],
}: MapViewProps) {
  return (
    <MapCanvas
      points={points}
      clusters={clusters}
      riskScores={riskScores}
      hotspots={hotspots}
      heatmap={heatmap}
      aqiItems={aqiItems}
    />
  );
}
