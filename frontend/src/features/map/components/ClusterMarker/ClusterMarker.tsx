"use client";

import {
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";

interface ClusterMarkerProps {
  selectedCategories: string[];
}

interface ClusterData {
  id: number;
  category: "ISPA" | "Diare";
  position: [number, number];
  count: number;
  location: string;
}

const clusterData: ClusterData[] = [
  {
    id: 1,
    category: "ISPA",
    position: [-3.344, 114.591],
    count: 8,
    location: "Kelayan Selatan",
  },
  {
    id: 2,
    category: "Diare",
    position: [-3.346, 114.593],
    count: 5,
    location: "Kelayan Tengah",
  },
  {
    id: 3,
    category: "ISPA",
    position: [-3.342, 114.589],
    count: 12,
    location: "Kelayan Barat",
  },
];

export default function ClusterMarker({
  selectedCategories,
}: ClusterMarkerProps) {
  const filteredClusters = clusterData.filter((cluster) =>
    selectedCategories.includes(cluster.category)
  );

  return (
    <>
      {filteredClusters.map((cluster) => {
        const markerColor =
          cluster.category === "ISPA" ? "#047857" : "#F59E0B";

        return (
          <CircleMarker
            key={cluster.id}
            center={cluster.position}
            radius={Math.min(10 + cluster.count, 22)}
            pathOptions={{
              color: markerColor,
              fillColor: markerColor,
              fillOpacity: 0.65,
              weight: 2,
            }}
          >
            <Tooltip direction="top">
              {cluster.category} ({cluster.count} laporan)
            </Tooltip>

            <Popup>
              <div>
                <strong>{cluster.category}</strong>
                <p>{cluster.location}</p>
                <p>{cluster.count} laporan gejala</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
