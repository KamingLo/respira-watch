"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MapPin, Wind, Users } from "lucide-react";

import Button from "@/components/ui/Button/Button";
import { getAqiByCoordinates } from "@/services/aqi.service";
import type { AqiResult } from "@/types/aqi.types";
import type { ReportAgeGroup, ReportSeverity } from "@/types/report.types";

interface SubmittedReport {
  category: "ispa" | "diare";
  selectedSymptoms: string[];
  sickCount: number;
  age: number;
  ageGroups: ReportAgeGroup[];
  severity: ReportSeverity;
  isUpdated?: boolean;
  location: string;
  geom: {
    coordinates: [number, number];
  };
  description: string;
}

export default function ReportSuccessPage() {
  const [report, setReport] = useState<SubmittedReport | null>(null);
  const [aqiData, setAqiData] = useState<AqiResult | null>(null);
  const [aqiLoading, setAqiLoading] = useState(true);
  const [aqiError, setAqiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      const storedReport = sessionStorage.getItem("respirawatch-report-result");
      if (!storedReport) {
        setAqiLoading(false);
        setAqiError(
          "Detail laporan tidak tersedia. Laporan tetap dapat dilihat petugas."
        );
        return;
      }

      let savedReport: SubmittedReport;
      try {
        savedReport = JSON.parse(storedReport) as SubmittedReport;
      } catch {
        setAqiLoading(false);
        setAqiError("Detail laporan tidak dapat dibaca.");
        return;
      }

      setReport(savedReport);
      const [lng, lat] = savedReport.geom.coordinates;
      getAqiByCoordinates(lat, lng)
        .then((data) => {
          if (active) setAqiData(data);
        })
        .catch((error: unknown) => {
          if (active) {
            setAqiError(
              error instanceof Error
                ? error.message
                : "AQI sekitar belum tersedia."
            );
          }
        })
        .finally(() => {
          if (active) setAqiLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, []);

  const severeSymptoms =
    report?.severity === "berat" ||
    report?.severity === "kritis" ||
    report?.selectedSymptoms.some((symptom) =>
      /sesak|dehidras/i.test(symptom)
    ) ||
    (report?.category === "diare" &&
      /(?:[4-9]|\d{2,})\s*hari/i.test(report.description));

  const handleFindHospital = () => {
    if (!report) return;
    const [lng, lat] = report.geom.coordinates;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=Puskesmas+near+${lat},${lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <main className="min-h-screen bg-[#EDF2EE] px-4 pb-[20rem] pt-5 md:pb-48">
      <div className="mx-auto max-w-[520px] space-y-4">
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#078B50] via-[#006B3C] to-[#003D28] p-5 text-white shadow-lg shadow-green-900/20">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold">
                {report?.isUpdated ? "Laporan Diperbarui" : "Laporan Terkirim"}
              </h1>
              <p className="mt-1 text-xs text-green-100">
                {report
                  ? report.isUpdated
                    ? "Laporan perangkat ini diperbarui, jadi jumlah laporan tidak bertambah."
                    : `${report.location} · ${report.sickCount} orang terdampak`
                  : "Bukan alat diagnosis"}
              </p>
            </div>
            <div className="flex max-w-[55%] items-center gap-1.5 rounded-full border-2 border-white bg-[#FFB900] px-3 py-2 text-[#173B2B] shadow-md">
              <AlertTriangle size={17} className="shrink-0" />
              <span className="text-xs font-bold">
                {aqiData?.areaStatus.statusLabel ?? "Area dipantau"}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="text-[48px] font-bold leading-none tracking-tight">
              {aqiLoading ? "…" : aqiData?.weatherAqi.aqi ?? "—"}
            </span>
            <div>
              <p className="text-sm font-bold">
                {aqiData?.areaStatus.statusLabel ??
                  (aqiError ? "AQI belum tersedia" : "Memuat kualitas udara")}
              </p>
              <p className="mt-1 text-xs text-green-100">
                Indeks Kualitas Udara (AQI)
              </p>
            </div>
          </div>
          {aqiData && (
            <div
              className="mt-4 rounded-full px-3 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: aqiData.areaStatus.colorHex }}
            >
              PM2.5 {aqiData.weatherAqi.pm25} · PM10 {aqiData.weatherAqi.pm10}
            </div>
          )}
          {aqiError && (
            <p role="status" className="mt-3 text-xs text-green-100">
              {aqiError}
            </p>
          )}
        </section>

        <section className="rounded-[22px] border border-[#B9D9C8] bg-white p-5 shadow-md shadow-green-900/5">
          <h2 className="mb-4 text-base font-bold text-[#183D2D]">
            Saran untuk laporan ini
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#148650] bg-[#D9F1E4] text-[#087544]">
                <Wind size={23} />
              </div>
              <p className="text-sm leading-relaxed text-[#29483A]">
                {aqiData?.areaStatus.healthRecommendation ??
                  "Pantau kondisi dan hubungi tenaga kesehatan jika gejala memburuk."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#148650] bg-[#D9F1E4] text-[#087544]">
                <Users size={23} />
              </div>
              <p className="text-sm leading-relaxed text-[#29483A]">
                Gejala: {report?.selectedSymptoms.join(", ") ?? "belum tersedia"}.
                Kelompok usia pasien: {report?.ageGroups[0] ?? "belum tersedia"}.
              </p>
            </div>
            {aqiData?.areaStatus.sensitiveGroupWarning && (
              <p className="rounded-xl bg-[#E5F1E9] p-3 text-sm leading-relaxed text-[#29483A]">
                {aqiData.areaStatus.sensitiveGroupWarning}
              </p>
            )}
          </div>
        </section>

        {report && (
          <section className="rounded-[22px] border border-[#B9D9C8] bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#183D2D]">
              Ringkasan laporan
            </h2>
            <p className="mt-2 text-sm text-[#29483A]">
              {report.category.toUpperCase()} · usia {report.age} tahun ·{" "}
              {report.sickCount} penderita
            </p>
            <p className="mt-1 text-sm text-[#61776A]">
              Status laporan: menunggu verifikasi petugas.
            </p>
          </section>
        )}

        <p className="px-3 text-center text-[11px] leading-relaxed text-[#718579]">
          RespiraWatch bukan alat diagnosis. Informasi AQI dan saran kesehatan
          merupakan sinyal awal, bukan pengganti pemeriksaan tenaga kesehatan.
        </p>
      </div>

      <div className="fixed bottom-24 left-0 z-[1000] w-full bg-gradient-to-t from-[#EDF2EE] via-[#EDF2EE] to-transparent px-4 pb-5 pt-8 md:bottom-0">
        <div className="mx-auto max-w-[520px]">
          {severeSymptoms && (
            <Button
              fullWidth
              size="large"
              onClick={handleFindHospital}
              className="!rounded-full !bg-gradient-to-r !from-[#078B50] !to-[#003D28] !py-4 !text-base !font-bold !text-white shadow-lg shadow-green-900/20 hover:!shadow-xl"
            >
              <MapPin size={20} />
              Cari Puskesmas Terdekat
            </Button>
          )}
          <Link
            href="/"
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full border border-[#087546] bg-white px-4 py-3 text-sm font-bold text-[#164A32]"
          >
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
