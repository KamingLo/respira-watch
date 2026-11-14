"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search, Loader2, X, LocateFixed } from "lucide-react";

import type { ReportLocation } from "@/types/report.types";

const ReportLocationMap = dynamic(
  () => import("./ReportLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center bg-[#E5F1E9] text-sm text-[#315344]">
        Memuat peta...
      </div>
    ),
  }
);

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface ReportLocationPickerProps {
  value: ReportLocation | null;
  onChange: (location: ReportLocation) => void;
}

const DEFAULT_POSITION: [number, number] = [
  -3.344,
  114.591,
];

export default function ReportLocationPicker({
  value,
  onChange,
}: ReportLocationPickerProps) {
  const [query, setQuery] = useState(value?.address ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("Browser ini tidak mendukung akses lokasi.");
      return;
    }

    setGettingLocation(true);
    setSearchError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void reverseGeocode(coords.latitude, coords.longitude).finally(() =>
          setGettingLocation(false)
        );
      },
      (error) => {
        setGettingLocation(false);
        setSearchError(
          error.code === error.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Pilih kelurahan atau cari alamat secara manual."
            : "Lokasi belum bisa didapatkan. Pilih kelurahan atau coba lagi."
        );
      },
      { enableHighAccuracy: false, timeout: 10_000 }
    );
  };

  const position: [number, number] = value
    ? [value.coordinates[1], value.coordinates[0]]
    : DEFAULT_POSITION;

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setQuery(value?.address ?? "");
    });

    return () => {
      active = false;
    };
  }, [value?.address]);

  // Pencarian alamat dengan debounce
  useEffect(() => {
    const shouldSearch = query.trim().length >= 3;
    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      if (!shouldSearch) {
        setResults([]);
        setSearching(false);
        setSearchError("");
        return;
      }

      try {
        setSearching(true);
        setSearchError("");

        const params = new URLSearchParams({
          q: query.trim(),
          format: "jsonv2",
          limit: "5",
          countrycodes: "id",
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Pencarian alamat gagal.");
        }

        const data: SearchResult[] = await response.json();

        setResults(data);

        if (data.length === 0) {
          setSearchError("Alamat tidak ditemukan.");
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.name !== "AbortError"
        ) {
          setSearchError("Gagal mencari alamat. Coba lagi.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, shouldSearch ? 800 : 0);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  // Reverse geocoding untuk mendapatkan alamat dari koordinat
  const reverseGeocode = async (
    lat: number,
    lng: number
  ) => {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: "jsonv2",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params}`
      );

      if (!response.ok) {
        throw new Error("Gagal mendapatkan alamat.");
      }

      const data = await response.json();

      const address =
        data.display_name ??
        `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      setQuery(address);

      onChange({
        address,
        coordinates: [lng, lat],
      });
    } catch {
      const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      setQuery(address);

      onChange({
        address,
        coordinates: [lng, lat],
      });
    }
  };

  // Memilih hasil pencarian
  const handleSelectResult = (result: SearchResult) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setSearchError("Koordinat alamat tidak valid.");
      return;
    }

    const location: ReportLocation = {
      address: result.display_name,
      coordinates: [lng, lat],
    };

    setQuery(result.display_name);
    setResults([]);
    setSearchError("");

    onChange(location);
  };

  // Memilih titik langsung dari peta
  const handleMapSelect = (position: [number, number]) => {
    const [lat, lng] = position;

    reverseGeocode(lat, lng);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setSearchError("");
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-bold text-[#123D2B]">
          Lokasi Penderita
        </h2>

        <p className="mt-1 text-xs text-[#61776A]">
          Cari alamat atau tentukan lokasi langsung pada peta.
        </p>
      </div>

      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={gettingLocation}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#087546] bg-white px-4 py-2 text-sm font-semibold text-[#164A32] disabled:opacity-70"
      >
        {gettingLocation ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <LocateFixed size={18} />
        )}
        {gettingLocation ? "Mengambil lokasi..." : "Gunakan lokasi GPS"}
      </button>

      {/* Address Search */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-[#B5D2C3] bg-white px-3">
          <Search size={19} className="shrink-0 text-[#006B3C]" />

          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchError("");
            }}
            placeholder="Cari jalan, kelurahan, atau kota..."
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-[#123D2B] outline-none placeholder:text-gray-400"
          />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Hapus pencarian"
              className="text-gray-500 hover:text-red-500"
            >
              <X size={18} />
            </button>
          )}

          {searching && (
            <Loader2
              size={18}
              className="animate-spin text-[#006B3C]"
            />
          )}
        </div>

        {/* Search Results */}
        {results.length > 0 && (
          <div className="absolute z-[1100] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#B5D2C3] bg-white shadow-lg">
            {results.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="flex w-full items-start gap-2 border-b border-gray-100 p-3 text-left text-sm text-[#123D2B] transition hover:bg-[#E5F1E9] last:border-b-0"
              >
                <MapPin
                  size={17}
                  className="mt-0.5 shrink-0 text-[#006B3C]"
                />

                <span>{result.display_name}</span>
              </button>
            ))}
          </div>
        )}

        {searchError && (
          <p className="mt-2 text-xs text-red-600">
            {searchError}
          </p>
        )}
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-2xl border border-[#B5D2C3]">
        <div className="flex items-center gap-2 bg-[#E5F1E9] px-3 py-2">
          <MapPin size={17} className="text-[#006B3C]" />

          <p className="text-xs font-semibold text-[#315344]">
            Ketuk peta atau geser pin untuk memilih lokasi
          </p>
        </div>

        <div className="h-[320px] w-full">
          <ReportLocationMap
            position={position}
            onSelect={handleMapSelect}
          />
        </div>
      </div>

      {/* Selected Location */}
      {value && (
        <div className="rounded-xl border border-[#B5D2C3] bg-[#E5F1E9] p-3">
          <div className="flex items-start gap-2">
            <MapPin
              size={18}
              className="mt-0.5 shrink-0 text-[#006B3C]"
            />

            <div className="min-w-0">
              <p className="text-xs font-bold text-[#123D2B]">
                Lokasi terpilih
              </p>

              <p className="mt-1 break-words text-xs leading-relaxed text-[#315344]">
                {value.address}
              </p>

              <p className="mt-2 text-[10px] text-[#61776A]">
                Longitude: {value.coordinates[0].toFixed(6)}
                <br />
                Latitude: {value.coordinates[1].toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      )}

      {!value && (
        <p className="text-xs text-amber-700">
          Pilih alamat dari hasil pencarian atau tentukan titik
          pada peta terlebih dahulu.
        </p>
      )}
    </section>
  );
}
