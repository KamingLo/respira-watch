"use client";

import { CircleMarker, Polygon, Popup, Tooltip } from "react-leaflet";

import type {
  GridRiskScoreItem,
  NasaFirmsHotspot,
} from "@/types/analytics.types";

interface RiskAndHotspotLayersProps {
  riskScores: GridRiskScoreItem[];
  hotspots: NasaFirmsHotspot[];
}

const isValidColor = (value: string): boolean => /^#[\da-f]{6}$/i.test(value);

export default function RiskAndHotspotLayers({
  riskScores,
  hotspots,
}: RiskAndHotspotLayersProps) {
  return (
    <>
      {riskScores.map((item) => {
        const rings = item.geometry.coordinates.map((ring) =>
          ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number])
        );
        const color = isValidColor(item.colorHex) ? item.colorHex : "#047857";

        if (rings.length === 0 || rings[0].length < 4) return null;

        return (
          <Polygon
            key={`risk-${item.gridId}`}
            positions={rings}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.18,
              weight: 1.5,
            }}
          >
            <Tooltip sticky>
              Risiko {item.score.toFixed(0)}/100 · {item.statusLabel}
            </Tooltip>
            <Popup>
              <div className="space-y-1 text-sm">
                <strong>{item.cellCode}</strong>
                <p>Skor risiko: {item.score.toFixed(1)}/100</p>
                <p>{item.statusLabel}</p>
                <p>
                  {item.metrics.activeReportCount} laporan · AQI{" "}
                  {item.metrics.aqi}
                </p>
              </div>
            </Popup>
          </Polygon>
        );
      })}

      {hotspots.map((hotspot) => {
        if (
          !Number.isFinite(hotspot.latitude) ||
          !Number.isFinite(hotspot.longitude)
        ) {
          return null;
        }

        const radius = Math.max(5, Math.min(13, 5 + Math.sqrt(hotspot.frp)));

        return (
          <CircleMarker
            key={`hotspot-${hotspot.id}`}
            center={[hotspot.latitude, hotspot.longitude]}
            radius={radius}
            pathOptions={{
              color: "#7C2D12",
              fillColor: "#F97316",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip>Titik api NASA FIRMS</Tooltip>
            <Popup>
              <div className="space-y-1 text-sm">
                <strong>Hotspot karhutla</strong>
                <p>Kepercayaan: {hotspot.confidence}</p>
                <p>FRP: {hotspot.frp}</p>
                <p>
                  {hotspot.acqDate} · {hotspot.acqTime} UTC
                </p>
                <p>{hotspot.satellite}</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
