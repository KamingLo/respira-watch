"use client";

import {
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";

import type { MapPoint } from "@/types/map.types";

interface ClusterMarkerProps {
  points: MapPoint[];
}

export default function ClusterMarker({
  points,
}: ClusterMarkerProps) {
  return (
    <>
      {points.map((point) => {
        const markerColor =
          point.category.toLowerCase() === "ispa"
            ? "#047857"
            : point.category.toLowerCase() === "diare"
              ? "#F59E0B"
              : "#64748B";

        // Backend: [longitude, latitude]
        // Leaflet: [latitude, longitude]
        const position: [number, number] = [
          point.geom.coordinates[1],
          point.geom.coordinates[0],
        ];

        return (
          <CircleMarker
            key={point.id}
            center={position}
            radius={Math.min(
              10 + point.sickCount * 2,
              22
            )}
            pathOptions={{
              color: markerColor,
              fillColor: markerColor,
              fillOpacity: 0.65,
              weight: 2,
            }}
          >
            <Tooltip direction="top">
              {point.category.toUpperCase()} ·{" "}
              {point.sickCount} orang
            </Tooltip>

            <Popup>
              <div className="space-y-1">
                <strong>
                  {point.category.toUpperCase()}
                </strong>

                <p>
                  Tingkat keparahan: {point.severity}
                </p>

                <p>
                  Jumlah orang sakit: {point.sickCount}
                </p>

                <p>
                  Lokasi: {point.kelurahan ?? "Tidak diketahui"}
                </p>

                <p>
                  Status: {point.status}
                </p>

                <p>
                  Gejala: {point.symptoms.join(", ")}
                </p>

                <p>
                  Dilaporkan:{" "}
                  {new Date(point.reportedAt).toLocaleString(
                    "id-ID"
                  )}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
