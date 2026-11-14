"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, RefreshCw, X } from "lucide-react";

import {
  getOfficerReports,
  updateOfficerReportStatus,
  type OfficerReport,
  type OfficerReportStatus,
} from "@/services/officer-report.service";

type ReportListFilter = "all" | "pending" | "accepted" | "rejected";

const statusLabels: Record<OfficerReportStatus, string> = {
  pending: "Menunggu keputusan",
  verified: "Diterima",
  in_progress: "Diterima · Dipantau",
  resolved: "Diterima · Selesai",
  rejected: "Ditolak",
};

const decisionOptions: Array<{
  status: Extract<OfficerReportStatus, "verified" | "rejected">;
  label: string;
}> = [
  { status: "verified", label: "Terima" },
  { status: "rejected", label: "Tolak" },
];

export default function OfficerReportsPage() {
  const [reports, setReports] = useState<OfficerReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReportListFilter>("pending");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loadedVersion, setLoadedVersion] = useState(-1);
  const [loadedFilter, setLoadedFilter] = useState<ReportListFilter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const loading = loadedVersion !== refreshVersion || loadedFilter !== statusFilter;

  useEffect(() => {
    let active = true;
    const loadReports = async (): Promise<OfficerReport[]> => {
      if (statusFilter === "pending" || statusFilter === "rejected") {
        return getOfficerReports(statusFilter);
      }

      const currentReports = await getOfficerReports();
      if (statusFilter === "accepted") {
        return currentReports.filter((report) => report.status !== "pending");
      }

      const rejectedReports = await getOfficerReports("rejected");
      return [...currentReports, ...rejectedReports].sort(
        (left, right) =>
          Date.parse(right.reportedAt) - Date.parse(left.reportedAt)
      );
    };

    loadReports()
      .then((items) => {
        if (active) {
          setReports(items);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Gagal memuat laporan."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadedFilter(statusFilter);
          setLoadedVersion(refreshVersion);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshVersion, statusFilter]);

  const loadReports = useCallback(() => {
    setRefreshVersion((current) => current + 1);
  }, []);

  const handleDecision = async (
    report: OfficerReport,
    status: Extract<OfficerReportStatus, "verified" | "rejected">
  ) => {
    if (report.status === status || updatingId) return;
    setUpdatingId(report._id);
    setError(null);
    try {
      const updated = await updateOfficerReportStatus(report._id, status);
      setReports((current) =>
        statusFilter !== "all" && statusFilter !== status
          ? current.filter((item) => item._id !== report._id)
          : current.map((item) => (item._id === report._id ? updated : item))
      );
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memperbarui status laporan."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F4ED] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Kembali ke dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B]"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#123D2B]">
              Verifikasi Laporan
            </h1>
            <p className="mt-1 text-sm text-[#536D60]">
                Tinjau laporan masuk. Pilih Terima atau Tolak jika laporan tidak valid.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReports()}
            disabled={loading}
            aria-label="Muat ulang laporan"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B] disabled:opacity-60"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <label
            htmlFor="report-status-filter"
            className="block text-sm font-bold text-[#264536]"
          >
            Filter status
          </label>
          <select
            id="report-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ReportListFilter)
            }
            className="mt-2 min-h-12 w-full rounded-xl border border-[#B5D2C3] bg-white px-3 text-base text-[#123D2B] sm:max-w-xs"
          >
            <option value="pending">Menunggu keputusan</option>
            <option value="accepted">Diterima</option>
            <option value="rejected">Ditolak</option>
            <option value="all">Semua laporan</option>
          </select>
          <p className="mt-2 text-xs text-[#708477]">
            Data menyesuaikan hak akses wilayah akun petugas. Laporan ditolak
            tidak termasuk hitungan di peta warga.
          </p>
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-[#536D60]">
            Memuat laporan...
          </p>
        ) : reports.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-[#536D60]">
            Tidak ada laporan untuk filter ini di wilayah tugas Anda.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <article
                key={report._id}
                className="rounded-2xl border border-[#D5E2D9] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#164A32]">
                      {report.category.toUpperCase()} · {report.sickCount} orang
                    </h2>
                    <p className="mt-1 text-sm text-[#536D60]">
                      {report.kelurahanId?.name ?? report.address ?? "Wilayah tidak diketahui"}
                      {report.kelurahanId?.kecamatan
                        ? ` · ${report.kelurahanId.kecamatan}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#E9F4ED] px-3 py-1 text-xs font-bold text-[#176B45]">
                    {statusLabels[report.status]}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[#264536]">
                  Gejala: {report.symptoms.join(", ")} · Keparahan:{" "}
                  {report.severity}
                </p>
                <p className="mt-1 text-sm text-[#536D60]">
                  Usia: {report.age} tahun · Kelompok:{" "}
                  {report.ageGroups?.join(", ") || "belum dicatat"}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#536D60]">
                  {report.description}
                </p>
                <p className="mt-2 text-xs text-[#708477]">
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(report.reportedAt))}
                  {" · "}
                  {report.geom.coordinates[1].toFixed(5)},{" "}
                  {report.geom.coordinates[0].toFixed(5)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.status === "pending" &&
                    decisionOptions.map(({ status, label }) => (
                      <button
                        key={status}
                        type="button"
                        disabled={updatingId !== null}
                        onClick={() => void handleDecision(report, status)}
                        className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                          status === "verified"
                            ? "border-[#087546] bg-[#087546] hover:bg-[#065B3A]"
                            : "border-red-700 bg-red-700 hover:bg-red-800"
                        }`}
                      >
                        {updatingId === report._id ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : status === "verified" ? (
                          <Check size={15} />
                        ) : (
                          <X size={15} />
                        )}
                        {label}
                      </button>
                    ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
