"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

interface ReportLocationMapProps {
  position: [number, number];
  onSelect: (position: [number, number]) => void;
}

const selectedLocationIcon = L.divIcon({
  className: "report-location-marker",
  html: `
    <div style="
      width: 34px;
      height: 34px;
      background: #006B3C;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,.3);
      position: relative;
    ">
      <div style="
        width: 10px;
        height: 10px;
        background: white;
        border-radius: 50%;
        position: absolute;
        top: 9px;
        left: 9px;
      "></div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function MapClickHandler({
  onSelect,
}: {
  onSelect: (position: [number, number]) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function MapController({
  position,
}: {
  position: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(position, Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.5,
    });
  }, [position, map]);

  return null;
}

export default function ReportLocationMap({
  position,
  onSelect,
}: ReportLocationMapProps) {
  return (
    <MapContainer
      center={position}
      zoom={13}
      scrollWheelZoom
      className="h-full min-h-[320px] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onSelect={onSelect} />

      <MapController position={position} />

      <Marker
        position={position}
        icon={selectedLocationIcon}
        draggable
        eventHandlers={{
          dragend(event) {
            const marker = event.target;
            const location = marker.getLatLng();

            onSelect([location.lat, location.lng]);
          },
        }}
      />
    </MapContainer>
  );
}
