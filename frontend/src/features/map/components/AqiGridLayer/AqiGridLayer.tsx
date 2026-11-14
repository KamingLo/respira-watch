"use client";

import { Polygon, Popup, Tooltip } from "react-leaflet";
import type { AqiMapItem } from "@/types/map.types";

interface AqiGridLayerProps {
  items: AqiMapItem[];
}

export default function AqiGridLayer({ items }: AqiGridLayerProps) {
  return (
    <>
      {items.map((item) => {
        const rings = item.geometry.coordinates.map((ring) =>
          ring.map(
            ([longitude, latitude]) => [latitude, longitude] as [number, number]
          )
        );
        if (rings.length === 0 || rings[0].length < 4) return null;

        return (
          <Polygon
            key={item.gridId}
            positions={rings}
            pathOptions={{
              color: item.colorHex,
              fillColor: item.colorHex,
              fillOpacity: 0.24,
              weight: 1.5,
            }}
          >
            <Tooltip sticky>
              AQI {item.aqi} · {item.statusLabel}
            </Tooltip>
            <Popup>
              <div className="space-y-1 text-sm">
                <strong>{item.cellCode}</strong>
                <p>AQI: {item.aqi} · {item.statusLabel}</p>
                <p>PM2.5 {item.pm25} · PM10 {item.pm10}</p>
                <p>
                  Data:{" "}
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(item.recordedAt))}
                </p>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}
