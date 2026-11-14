"use client";

import { useEffect } from "react";
import { HeatLayer } from "leaflet.heat";
import { useMap } from "react-leaflet";
import type { Layer } from "leaflet";

interface HeatmapLayerProps {
  points: Array<[number, number, number]>;
}

export default function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const heatLayer = new HeatLayer(points, {
      radius: 28,
      blur: 20,
      maxZoom: 17,
      max: 1,
      gradient: {
        0.2: "#34D399",
        0.5: "#FACC15",
        0.75: "#F97316",
        1: "#DC2626",
      },
    });
    // leaflet.heat's types omit Leaflet 1's inherited Layer methods.
    const layer = heatLayer as unknown as Layer;
    map.addLayer(layer);

    return () => {
      map.removeLayer(layer as Layer);
    };
  }, [map, points]);

  return null;
}
