"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getPublicMap } from "@/services/map.service";

import type {
  MapPoint,
  PublicMapData,
} from "@/types/map.types";

const EMPTY_MAP_DATA: PublicMapData = {
  points: [],
  geoJson: {
    type: "FeatureCollection",
    features: [],
  },
  heatmap: [],
  summary: {
    totalReports: 0,
    totalSickCount: 0,
    byCategory: {
      ispa: 0,
      diare: 0,
      other: 0,
    },
    bySeverity: {},
    privacyJitterMeters: {
      min: 0,
      max: 0,
    },
    cacheKey: "",
    generatedAt: "",
  },
};

export default function useMap() {
  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(["ISPA", "Diare"]);

  const [mapData, setMapData] =
    useState<PublicMapData>(EMPTY_MAP_DATA);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMap = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getPublicMap();

      if (!response.success) {
        throw new Error("Gagal mengambil data peta.");
      }

      setMapData(response.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data peta.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  const filteredPoints = useMemo(() => {
    return mapData.points.filter((point: MapPoint) =>
      selectedCategories.includes(point.category.toUpperCase())
    );
  }, [mapData.points, selectedCategories]);

  return {
    selectedCategories,
    setSelectedCategories,

    mapData,
    points: filteredPoints,
    summary: mapData.summary,

    loading,
    error,
    refetch: fetchMap,
  };
}
