"use client";

import {
  MapContainer,
  TileLayer,
  ZoomControl,
} from "react-leaflet";

import ClusterMarker from "../ClusterMarker/ClusterMarker";

interface MapCanvasProps {
  selectedCategories: string[];
}

export default function MapCanvas({
  selectedCategories,
}: MapCanvasProps) {
  return (
    <MapContainer
      center={[-3.344, 114.591]}
      zoom={15}
      zoomControl={false}
      scrollWheelZoom={true}
      className="h-full min-h-[320px] w-full"
    >
      <ZoomControl position="bottomright" />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClusterMarker
        selectedCategories={selectedCategories}
      />
    </MapContainer>
  );
}
