"use client";

import {
  MapContainer,
  TileLayer,
} from "react-leaflet";

import type { MapPoint } from "@/types/map.types";
import type { ClusterRecord } from "@/types/cluster.types";
import type {
  GridRiskScoreItem,
  NasaFirmsHotspot,
} from "@/types/analytics.types";
import type { AqiMapItem, MapHeatmapPoint } from "@/types/map.types";

import ClusterMarker from "../ClusterMarker/ClusterMarker";
import ClusterAreaMarkers from "../ClusterMarker/ClusterAreaMarkers";
import RiskAndHotspotLayers from "../RiskAndHotspotLayers/RiskAndHotspotLayers";
import HeatmapLayer from "../HeatmapLayer/HeatmapLayer";
import AqiGridLayer from "../AqiGridLayer/AqiGridLayer";

interface MapCanvasProps {
  points: MapPoint[];
  clusters?: ClusterRecord[];
  riskScores?: GridRiskScoreItem[];
  hotspots?: NasaFirmsHotspot[];
  heatmap?: MapHeatmapPoint[];
  aqiItems?: AqiMapItem[];
}

export default function MapCanvas({
  points,
  clusters = [],
  riskScores = [],
  hotspots = [],
  heatmap = [],
  aqiItems = [],
}: MapCanvasProps) {
  const heatmapPoints = heatmap.map(
    (item) => [item.lat, item.lng, item.intensity] as [number, number, number]
  );

  return (
    <MapContainer
      center={[-3.344, 114.591]}
      zoom={15}
      scrollWheelZoom={true}
      className="h-full min-h-[320px] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <HeatmapLayer points={heatmapPoints} />
      <AqiGridLayer items={aqiItems} />
      <ClusterMarker points={points} />
      <ClusterAreaMarkers clusters={clusters} />
      <RiskAndHotspotLayers riskScores={riskScores} hotspots={hotspots} />
    </MapContainer>
  );
}
