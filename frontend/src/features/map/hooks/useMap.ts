"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import { getPublicMap } from "@/services/map.service";
import { isMapCategorySelected } from "@/features/map/utils/category";

import type {
  MapPoint,
  MapFilterParams,
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
const EMPTY_MAP_FILTERS: MapFilterParams = {};

const requestMapData = async (
  filters: MapFilterParams
): Promise<PublicMapData> => {
  const response = await getPublicMap(filters);

  if (!response.success) {
    throw new Error("Gagal mengambil data peta.");
  }

  return response.data;
};

const getMapErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error) && !error.response) {
    return `Tidak dapat terhubung ke backend peta di ${
      process.env.NEXT_PUBLIC_API_URL || "URL API yang dikonfigurasi"
    }. Pastikan backend berjalan, lalu coba lagi.`;
  }

  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan saat mengambil data peta.";
};

export default function useMap(
  filters: MapFilterParams = EMPTY_MAP_FILTERS
) {
  const stableFilters = useMemo(
    () => ({ ...filters }),
    [filters]
  );
  const refreshInProgress = useRef(false);
  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(["ISPA", "Diare"]);

  const [mapData, setMapData] =
    useState<PublicMapData>(EMPTY_MAP_DATA);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    requestMapData(stableFilters)
      .then((data) => {
        if (!active) return;
        setMapData(data);
        setError(null);
      })
      .catch((error: unknown) => {
        if (active) setError(getMapErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [stableFilters]);

  const refreshMapData = useCallback(async (showLoading: boolean) => {
    if (refreshInProgress.current) return;

    refreshInProgress.current = true;
    if (showLoading) setLoading(true);
    setError(null);

    try {
      setMapData(await requestMapData(stableFilters));
    } catch (error: unknown) {
      setError(getMapErrorMessage(error));
    } finally {
      refreshInProgress.current = false;
      if (showLoading) setLoading(false);
    }
  }, [stableFilters]);

  const refetch = useCallback(
    () => refreshMapData(true),
    [refreshMapData]
  );

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshMapData(false);
      }
    };

    const intervalId = window.setInterval(refreshWhenVisible, 15_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshMapData]);

  const filteredPoints = useMemo(() => {
    return mapData.points.filter((point: MapPoint) =>
      isMapCategorySelected(point.category, selectedCategories)
    );
  }, [mapData.points, selectedCategories]);
  const filteredHeatmap = useMemo(
    () =>
      mapData.heatmap.filter((point) =>
        isMapCategorySelected(point.category, selectedCategories)
      ),
    [mapData.heatmap, selectedCategories]
  );

  return {
    selectedCategories,
    setSelectedCategories,

    mapData,
    points: filteredPoints,
    heatmap: filteredHeatmap,
    summary: mapData.summary,

    loading,
    error,
    refetch,
  };
}
