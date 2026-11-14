"use client";

import { Fragment } from "react";
import Link from "next/link";
import { CircleMarker, Polygon, Popup, Tooltip } from "react-leaflet";

import type { ClusterRecord } from "@/types/cluster.types";

interface ClusterAreaMarkersProps {
  clusters: ClusterRecord[];
}

const getClusterLocation = (cluster: ClusterRecord): string => {
  if (
    cluster.kelurahanId &&
    typeof cluster.kelurahanId === "object" &&
    cluster.kelurahanId.name
  ) {
    return cluster.kelurahanId.name;
  }

  return cluster.clusterCode;
};

export default function ClusterAreaMarkers({
  clusters,
}: ClusterAreaMarkersProps) {
  return (
    <>
      {clusters.map((cluster) => {
        const [longitude, latitude] = cluster.center.coordinates;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
          return null;
        }

        const color = /^#[\da-f]{6}$/i.test(cluster.colorHex)
          ? cluster.colorHex
          : "#047857";
        const boundaryPositions = cluster.boundary?.coordinates.map((ring) =>
          ring.map(
            ([ringLongitude, ringLatitude]) =>
              [ringLatitude, ringLongitude] as [number, number]
          )
        );

        return (
          <Fragment key={cluster._id}>
            {boundaryPositions && boundaryPositions[0]?.length >= 4 && (
              <Polygon
                key={`${cluster._id}-boundary`}
                positions={boundaryPositions}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              />
            )}
            <CircleMarker
              key={cluster._id}
              center={[latitude, longitude]}
              radius={15}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: color,
                fillOpacity: 0.9,
                weight: 3,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {cluster.category.toUpperCase()} · {cluster.reportCount} laporan
              </Tooltip>
              <Popup>
                <div className="space-y-2">
                  <strong className="block text-sm">
                    Klaster {getClusterLocation(cluster)}
                  </strong>
                  <p>
                    {cluster.category.toUpperCase()} · {cluster.reportCount}{" "}
                    laporan · {cluster.riskStatus}
                  </p>
                  <Link
                    href={`/dashboard/clusters/${encodeURIComponent(cluster._id)}`}
                    className="inline-flex rounded-full bg-green-800 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Lihat detail klaster
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
    </>
  );
}
