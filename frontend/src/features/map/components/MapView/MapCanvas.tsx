"use client";

import {
  MapContainer,
  TileLayer,
} from "react-leaflet";

import type { MapPoint } from "@/types/map.types";

import ClusterMarker from "../ClusterMarker/ClusterMarker";

interface MapCanvasProps {
  points: MapPoint[];
}

export default function MapCanvas({
  points,
}: MapCanvasProps) {
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

      <ClusterMarker points={points} />
    </MapContainer>
  );
}
