"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";

import { getOfficerToken } from "@/features/auth/authToken";
import {
  getUnmappedReports,
  type UnmappedReport,
} from "@/services/adminManagement.service";

interface AreaCandidate {
  id: string;
  reports: UnmappedReport[];
  center: {
    longitude: number;
    latitude: number;
  };
}

const GROUP_RADIUS_METERS = 500;
const MIN_REPORTS = 3;

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistance = (
  pointA: [number, number],
  pointB: [number, number]
): number => {
  const earthRadius = 6371000;

  const [lngA, latA] = pointA;
  const [lngB, latB] = pointB;

  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latA)) *
      Math.cos(toRadians(latB)) *
      Math.sin(deltaLng / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getValidCoordinates = (
  report: UnmappedReport
): [number, number] | null => {
  const coordinates = report.geom?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    return null;
  }

  const [longitude, latitude] = coordinates;

  if (
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return [longitude, latitude];
};

const groupReports = (reports: UnmappedReport[]): AreaCandidate[] => {
  const validReports = reports
    .filter((report) => report.status !== "rejected")
    .filter((report) => getValidCoordinates(report) !== null)
    .sort(
      (a, b) =>
        new Date(a.reportedAt).getTime() -
        new Date(b.reportedAt).getTime()
    );

  const groups: AreaCandidate[] = [];

  for (const report of validReports) {
    const coordinates = getValidCoordinates(report);

    if (!coordinates) continue;

    let nearestGroup: AreaCandidate | null = null;
    let nearestDistance = GROUP_RADIUS_METERS;

    for (const group of groups) {
      const distance = calculateDistance(coordinates, [
        group.center.longitude,
        group.center.latitude,
      ]);

      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearestGroup = group;
      }
    }

    if (nearestGroup) {
      nearestGroup.reports.push(report);

      const total = nearestGroup.reports.length;

      const longitudeTotal = nearestGroup.reports.reduce(
        (sum, item) => sum + (getValidCoordinates(item)?.[0] ?? 0),
        0
      );

      const latitudeTotal = nearestGroup.reports.reduce(
        (sum, item) => sum + (getValidCoordinates(item)?.[1] ?? 0),
        0
      );

      nearestGroup.center = {
        longitude: longitudeTotal / total,
        latitude: latitudeTotal / total,
      };
    } else {
      groups.push({
        id: report._id,
        reports: [report],
        center: {
          longitude: coordinates[0],
          latitude: coordinates[1],
        },
      });
    }
  }

  return groups
    .filter((group) => group.reports.length >= MIN_REPORTS)
    .sort((a, b) => b.reports.length - a.reports.length);
};

const getLocationHint = (reports: UnmappedReport[]): string => {
  const suggestions = reports
    .map((report) => report.locationSuggestion)
    .filter(
      (suggestion): suggestion is NonNullable<
        UnmappedReport["locationSuggestion"]
      > => Boolean(suggestion?.name)
    );

  if (suggestions.length === 0) {
    return "Belum ada informasi nama wilayah";
  }

  const counts = new Map<string, number>();

  for (const suggestion of suggestions) {
    const name = suggestion.name.trim();

    if (name) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  const mostCommon = [...counts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];

  const kecamatan = suggestions.find(
    (item) => item.kecamatan
  )?.kecamatan;

  if (!mostCommon) {
    return "Belum ada informasi nama wilayah";
  }

  return kecamatan
    ? `${mostCommon[0]} · ${kecamatan}`
    : mostCommon[0];
};

const formatDate = (value: string | Date): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tanggal tidak tersedia";
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function UnmappedAreaRecommendations() {
  const [reports, setReports] = useState<UnmappedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadReports = useCallback(async (isRefresh = false) => {
    const token = getOfficerToken();

    if (!token) {
      setError("Sesi admin berakhir. Silakan masuk kembali.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const data = await getUnmappedReports(token);
      setReports(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat laporan yang belum terpetakan."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const candidates = useMemo(
    () => groupReports(reports),
    [reports]
  );

  const candidateReportCount = useMemo(
    () =>
      candidates.reduce(
        (total, candidate) => total + candidate.reports.length,
        0
      ),
    [candidates]
  );

  if (loading) {
    return (
      <section className="rounded-2xl border border-[#D5E2D9] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#536D60]">
          Memuat rekomendasi area laporan...
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#D5E2D9] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9F4ED] text-[#087546]">
              <MapPin size={20} />
            </span>

            <div>
              <h2 className="text-base font-bold text-[#164A32]">
                Rekomendasi Area untuk Ditinjau
              </h2>

              <p className="mt-1 text-xs text-[#708477]">
                Kelompok laporan warga yang belum terhubung dengan data kelurahan.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadReports(true)}
          disabled={refreshing}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#B5D2C3] bg-white px-3 py-2 text-sm font-semibold text-[#264536] transition hover:bg-[#F0F6F2] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={refreshing ? "animate-spin" : ""}
          />
          {refreshing ? "Memuat..." : "Perbarui"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#F7FAF7] p-3">
              <p className="text-xs text-[#708477]">
                Laporan belum terpetakan
              </p>
              <p className="mt-1 text-xl font-bold text-[#164A32]">
                {reports.length}
              </p>
            </div>

            <div className="rounded-xl bg-[#F7FAF7] p-3">
              <p className="text-xs text-[#708477]">
                Kandidat area
              </p>
              <p className="mt-1 text-xl font-bold text-[#164A32]">
                {candidates.length}
              </p>
            </div>

            <div className="rounded-xl bg-[#F7FAF7] p-3">
              <p className="text-xs text-[#708477]">
                Laporan dalam kandidat
              </p>
              <p className="mt-1 text-xl font-bold text-[#164A32]">
                {candidateReportCount}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs leading-relaxed text-amber-900">
              <strong>Perlu verifikasi admin:</strong> Kandidat dibentuk
              berdasarkan kedekatan koordinat laporan dalam radius sekitar
              500 meter, dengan minimal 3 laporan. Kelompok ini bukan batas
              atau nama kelurahan resmi. Verifikasi nama, kode, kecamatan,
              dan batas administrasi sebelum menambahkan data kelurahan.
            </p>
          </div>

          {reports.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#F7FAF7] p-5 text-center">
              <MapPin
                size={26}
                className="mx-auto text-[#8BA695]"
              />
              <p className="mt-2 text-sm font-semibold text-[#264536]">
                Tidak ada laporan yang belum terpetakan
              </p>
              <p className="mt-1 text-xs text-[#708477]">
                Semua laporan yang tersedia sudah memiliki kelurahan atau
                belum ada laporan baru.
              </p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#F7FAF7] p-5 text-center">
              <Users
                size={26}
                className="mx-auto text-[#8BA695]"
              />
              <p className="mt-2 text-sm font-semibold text-[#264536]">
                Belum ditemukan kandidat area
              </p>
              <p className="mt-1 text-xs text-[#708477]">
                Belum ada kelompok dengan minimal {MIN_REPORTS} laporan
                dalam radius sekitar {GROUP_RADIUS_METERS} meter.
                Laporan tetap tersimpan dan tidak dihapus.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {candidates.map((candidate, index) => {
                const ispaCount = candidate.reports.filter(
                  (report) => report.category.toLowerCase() === "ispa"
                ).length;

                const diarrheaCount = candidate.reports.filter(
                  (report) => report.category.toLowerCase() === "diare"
                ).length;

                const latestReport = candidate.reports.reduce(
                  (latest, report) =>
                    new Date(report.reportedAt).getTime() >
                    new Date(latest.reportedAt).getTime()
                      ? report
                      : latest,
                  candidate.reports[0]
                );

                return (
                  <article
                    key={candidate.id}
                    className="rounded-2xl border border-[#E3ECE6] bg-[#FCFDFC] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-[#708477]">
                          Kandidat area #{index + 1}
                        </p>

                        <h3 className="mt-1 text-sm font-bold text-[#164A32]">
                          {getLocationHint(candidate.reports)}
                        </h3>
                      </div>

                      <span className="rounded-full bg-[#E9F4ED] px-3 py-1 text-xs font-semibold text-[#087546]">
                        {candidate.reports.length} laporan
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-[#708477]">
                          Perkiraan titik tengah
                        </p>
                        <p className="mt-1 break-all text-xs font-medium text-[#264536]">
                          {candidate.center.latitude.toFixed(6)},{" "}
                          {candidate.center.longitude.toFixed(6)}
                        </p>
                        <p className="mt-1 text-[10px] text-[#8A9B90]">
                          Latitude, Longitude
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-[#708477]">
                          Distribusi kategori
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            ISPA: {ispaCount}
                          </span>
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                            Diare: {diarrheaCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[#E6ECE8] pt-3">
                      <p className="text-xs text-[#708477]">
                        Laporan terbaru
                      </p>
                      <p className="mt-1 text-xs font-medium text-[#536D60]">
                        {latestReport
                          ? formatDate(latestReport.reportedAt)
                          : "Tidak tersedia"}
                      </p>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-[#708477]">
                      Area ini perlu diperiksa pada peta dan dibandingkan
                      dengan sumber batas administrasi resmi sebelum
                      didaftarkan sebagai kelurahan.
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-[#8A9B90]">
            Catatan: Pengelompokan dilakukan di frontend dan hanya merupakan
            alat bantu peninjauan. Koordinat titik tengah bukan centroid resmi
            kelurahan. Maksimal 200 laporan mengikuti batas endpoint backend.
          </p>
        </>
      )}
    </section>
  );
}
