"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Sparkles,
  Check,
} from "lucide-react";

import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import { symptoms, type SymptomCategory } from "@/features/report/symptoms";
import useReport from "@/hooks/useReport";
import type {
  GeoPoint,
  ReportCategory,
  ReportSeverity,
} from "@/types/report.types";

interface ReportData {
  category: SymptomCategory;
  selectedSymptoms: string[];
  description: string;
  age: number;
  severity: ReportSeverity;
  location: string;
  geom: GeoPoint;
}

export default function ConfirmReportPage() {
  const router = useRouter();
  const {
    submitReport,
    loading: submitting,
    error: submissionError,
  } = useReport();

  const [report, setReport] = useState<ReportData | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedReport = sessionStorage.getItem(
      "respirawatch-report"
    );

    if (!savedReport) {
      router.replace("/lapor");
      return;
    }

    try {
      const parsedReport = JSON.parse(savedReport) as ReportData;

      startTransition(() => {
        setReport(parsedReport);
        setSelectedSymptoms(parsedReport.selectedSymptoms || []);
        setLoading(false);
      });
    } catch {
      router.replace("/lapor");
      return;
    }
  }, [router]);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((previous) =>
      previous.includes(symptom)
        ? previous.filter((item) => item !== symptom)
        : [...previous, symptom]
    );
  };

  const handleConfirm = async () => {
    if (!report || selectedSymptoms.length === 0 || submitting) return;

    const category: ReportCategory =
      report.category === "ISPA" ? "ispa" : "diare";
    const submitted = await submitReport({
      category,
      symptoms: selectedSymptoms,
      sickCount: 1,
      age: report.age,
      severity: report.severity,
      description: report.description,
      address: report.location,
      geom: report.geom,
    });

    if (!submitted) return;

    sessionStorage.removeItem("respirawatch-report");
    router.push("/lapor/konfirmasi/berhasil");
  };

  if (loading || !report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EDF2EE]">
        <p className="text-sm text-[#315344]">
          Memuat laporan...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#EDF2EE] px-4 pb-28 pt-4 md:px-6">
      <div className="mx-auto max-w-[520px] space-y-5">

        {/* Header */}
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/lapor")}
            aria-label="Kembali"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B] shadow-sm transition hover:bg-green-50"
          >
            <ArrowLeft size={22} />
          </button>

          <h1 className="text-xl font-bold text-[#123D2B]">
            Konfirmasi Gejala
          </h1>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#006B3C] shadow-sm">
            <Sparkles size={21} />
          </div>
        </header>

        {/* Complaint Summary */}
        <Card className="!rounded-2xl !border-[#B5D2C3] !p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#C9F0DC] text-[#006B3C]">
              <Sparkles size={22} />
            </div>

            <div>
              <h2 className="font-bold text-[#123D2B]">
                Ringkasan Keluhan
              </h2>

              <p className="mt-1 text-xs text-[#315344]">
                {report.category} • {report.age} thn • {report.location}
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#123D2B]">
            “{report.description}”
          </p>
        </Card>

        {/* Detected Symptoms */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-[#123D2B]">
              Gejala terdeteksi
            </h2>

            <span className="text-xs font-semibold text-[#315344]">
              Ketuk untuk ubah
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {symptoms[report.category].map((symptom) => {
              const selected = selectedSymptoms.includes(
                symptom.label
              );

              return (
                <button
                  key={symptom.label}
                  type="button"
                  onClick={() => toggleSymptom(symptom.label)}
                  aria-pressed={selected}
                  className={`flex min-h-[145px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[24px] border-2 p-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-md active:scale-95 ${
                    selected
                      ? "border-[#00703C] bg-[#C7EBD8] text-[#123D2B]"
                      : "border-[#B5D2C3] bg-white text-[#123D2B] hover:bg-green-50"
                  }`}
                >
                  <Image
                    src={symptom.icon}
                    alt={symptom.label}
                    width={80}
                    height={80}
                    className="h-20 w-20 object-cover"
                  />

                  <span className="text-base font-bold">
                    {symptom.label}
                  </span>

                  {selected ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-green-800">
                      <Check size={12} />
                      Terdeteksi AI
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-500">
                      Ketuk pilih
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* AI Information */}
        <div className="flex items-start gap-2 rounded-xl bg-[#E5F1E9] p-3">
          <Sparkles
            size={17}
            className="mt-0.5 shrink-0 text-green-800"
          />

          <p className="text-xs leading-relaxed text-[#315344]">
            Periksa kembali gejala yang terdeteksi. Kamu dapat
            menambahkan atau menghapus gejala sesuai kondisi
            yang dialami.
          </p>
        </div>

        {submissionError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            Gagal mengirim laporan: {submissionError}
          </p>
        )}

        {/* Confirmation Button */}
        <Button
          fullWidth
          size="large"
          onClick={handleConfirm}
          disabled={selectedSymptoms.length === 0 || submitting}
          className="!rounded-full !bg-gradient-to-r !from-green-600 !to-green-950 !py-4 !text-base shadow-lg hover:!shadow-xl"
        >
          {submitting ? (
            "Mengirim laporan..."
          ) : (
            <>
              <Check size={20} />
              Konfirmasi
            </>
          )}
        </Button>

      </div>
    </main>
  );
}
