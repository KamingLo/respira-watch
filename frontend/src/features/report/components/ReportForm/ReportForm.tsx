"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Activity,
  MapPin,
  Users,
  Check,
  ChevronDown,
} from "lucide-react";

import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import ReportLocationPicker from "@/features/report/components/ReportLocationPicker/ReportLocationPicker";
import {
  symptoms,
  symptomCategoryIcons,
  type SymptomCategory,
} from "@/features/report/symptoms";

import type {
  ReportCategory,
  ReportSeverity,
  ReportLocation,
} from "@/types/report.types";

interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export default function ReportForm() {
  const router = useRouter();

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [category, setCategory] = useState<SymptomCategory>("ISPA");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    "Batuk",
    "Demam",
    "Sesak",
  ]);

  const [age, setAge] = useState("");
  const [severity, setSeverity] = useState<ReportSeverity>("ringan");

  const [location, setLocation] = useState<ReportLocation | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [description, setDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [formError, setFormError] = useState("");

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((previous) =>
      previous.includes(symptom)
        ? previous.filter((item) => item !== symptom)
        : [...previous, symptom]
    );
  };

  const handleCategoryChange = (value: SymptomCategory) => {
    setCategory(value);
    setSelectedSymptoms([]);
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognitionAPI =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceError("Browser kamu belum mendukung fitur pengenalan suara.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = false;

    setVoiceError("");
    setIsRecording(true);

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + " ";
        }
      }

      if (transcript.trim()) {
        setDescription((previous) =>
          previous
            ? `${previous.trim()} ${transcript.trim()}`
            : transcript.trim()
        );
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      setVoiceError("Gagal mengenali suara. Silakan coba lagi.");
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (selectedSymptoms.length === 0) {
      setFormError("Pilih minimal satu gejala.");
      return;
    }

    const parsedAge = Number(age);

    if (
      age.trim() === "" ||
      !Number.isInteger(parsedAge) ||
      parsedAge < 0 ||
      parsedAge > 120
    ) {
      setFormError("Masukkan usia pasien dengan benar (0–120 tahun).");
      return;
    }

    if (!location) {
      setFormError("Pilih lokasi pasien terlebih dahulu.");
      setShowLocationPicker(true);
      return;
    }

    if (!description.trim()) {
      setFormError("Tuliskan keluhan atau gunakan fitur mikrofon.");
      return;
    }

    const reportData = {
      category,
      selectedSymptoms,
      sickCount: 1,
      age: parsedAge,
      severity,
      location: location.address,
      geom: {
        type: "Point" as const,
        coordinates: location.coordinates,
      },
      description: description.trim(),
    };

    sessionStorage.setItem(
      "respirawatch-report",
      JSON.stringify(reportData)
    );

    router.push("/lapor/konfirmasi");
  };

  return (
    <main className="min-h-screen bg-[#EDF2EE] px-4 pb-28 pt-4 md:px-6">
      <div className="mx-auto max-w-[520px] space-y-5">

        {/* Header */}
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Kembali"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B] shadow-sm transition hover:bg-green-50"
          >
            <ArrowLeft size={22} />
          </button>

          <h1 className="text-xl font-bold text-[#123D2B]">
            Lapor Gejala
          </h1>

          <button
            type="button"
            onClick={handleVoiceInput}
            aria-label="Input suara"
            className={`flex h-10 w-10 items-center justify-center rounded-xl border border-[#B5D2C3] shadow-sm transition hover:bg-green-50 ${
              isRecording
                ? "bg-red-100 text-red-600"
                : "bg-white text-[#123D2B]"
            }`}
          >
            {isRecording ? <MicOff size={21} /> : <Mic size={21} />}
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Kategori, usia, dan lokasi */}
          <Card className="!rounded-2xl !border-[#B5D2C3] !p-3">
            <div className="grid grid-cols-2 gap-2">

              <button
                type="button"
                onClick={() => handleCategoryChange("ISPA")}
                className={`flex items-center justify-center gap-2 rounded-full border-2 py-2 text-sm font-bold transition hover:-translate-y-0.5 ${
                  category === "ISPA"
                    ? "border-green-700 bg-green-100 text-green-800"
                    : "border-[#B5D2C3] bg-[#EDF2EE] text-gray-700 hover:bg-green-50"
                }`}
              >
                <Image
                  src={symptomCategoryIcons.ISPA}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 object-cover"
                />
                ISPA
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("Diare")}
                className={`flex items-center justify-center gap-2 rounded-full border-2 py-2 text-sm font-bold transition hover:-translate-y-0.5 ${
                  category === "Diare"
                    ? "border-green-700 bg-green-100 text-green-800"
                    : "border-[#B5D2C3] bg-[#EDF2EE] text-gray-700 hover:bg-green-50"
                }`}
              >
                <Image
                  src={symptomCategoryIcons.Diare}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 object-cover"
                />
                Diare
              </button>

              {/* Usia pasien */}
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#B5D2C3] bg-[#EDF2EE] px-3 py-2.5">
                <Users size={18} className="shrink-0 text-green-800" />

                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="patient-age"
                    className="block text-[10px] font-semibold text-gray-500"
                  >
                    Usia pasien
                  </label>

                  <div className="flex items-center gap-1">
                    <input
                      id="patient-age"
                      type="number"
                      min="0"
                      max="120"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      placeholder="Usia"
                      className="w-full min-w-0 bg-transparent text-xs font-bold text-[#123D2B] outline-none placeholder:text-gray-400"
                    />
                    <span className="text-[10px] font-semibold text-[#123D2B]">
                      thn
                    </span>
                  </div>
                </div>
              </div>

              {/* Lokasi pasien */}
              <button
                type="button"
                onClick={() => setShowLocationPicker((previous) => !previous)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:bg-green-50 ${
                  location
                    ? "border-green-700 bg-green-100 text-green-900"
                    : "border-[#B5D2C3] bg-[#EDF2EE] text-[#123D2B]"
                }`}
              >
                <MapPin size={18} className="shrink-0" />

                <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                  {location ? location.address : "Pilih lokasi"}
                </span>

                <ChevronDown
                  size={15}
                  className={`shrink-0 transition ${
                    showLocationPicker ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* Location picker - tampil ketika tombol lokasi ditekan */}
          {showLocationPicker && (
            <Card className="!rounded-2xl !border-[#B5D2C3] !p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#123D2B]">
                  <MapPin size={16} className="mr-1 inline" />
                  Tentukan Lokasi
                </h2>

                <button
                  type="button"
                  onClick={() => setShowLocationPicker(false)}
                  className="text-xs font-semibold text-green-800"
                >
                  Tutup
                </button>
              </div>

              <ReportLocationPicker
                value={location}
                onChange={setLocation}
              />

              {location && (
                <p className="mt-3 rounded-lg bg-green-50 p-3 text-xs leading-relaxed text-green-900">
                  <span className="font-bold">Lokasi dipilih:</span>
                  <br />
                  {location.address}
                </p>
              )}
            </Card>
          )}

          {/* Gejala */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-[#123D2B]">
                Pilih Gejala
              </h2>

              <span className="text-xs text-gray-500">
                Pilih yang dialami
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {symptoms[category].map((symptom) => {
                const selected = selectedSymptoms.includes(symptom.label);

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

                    {selected && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-800">
                        <Check size={12} />
                        Dipilih
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Tingkat keparahan */}
          <Card className="!rounded-2xl !border-[#B5D2C3] !p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#123D2B]">
              <Activity size={18} />
              Tingkat Keparahan
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {(
                ["ringan", "sedang", "berat", "kritis"] as ReportSeverity[]
              ).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSeverity(item)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition ${
                    severity === item
                      ? "border-green-700 bg-green-100 text-green-900"
                      : "border-[#B5D2C3] bg-[#EDF2EE] text-[#123D2B]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </Card>

          {/* Deskripsi */}
          <Card className="!rounded-2xl !border-[#B5D2C3] !bg-[#E5F1E9] !p-4">
            <div className="flex items-start gap-2">
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ceritakan keluhan yang dialami..."
                rows={4}
                className="min-h-[100px] w-full resize-none bg-transparent text-sm font-medium leading-relaxed text-[#123D2B] outline-none placeholder:text-gray-500"
              />

              <button
                type="button"
                onClick={handleVoiceInput}
                aria-label="Rekam keluhan"
                className={`mt-1 shrink-0 rounded-full p-2 transition hover:bg-green-100 ${
                  isRecording
                    ? "animate-pulse bg-red-100 text-red-600"
                    : "text-green-800"
                }`}
              >
                {isRecording ? <MicOff size={21} /> : <Mic size={21} />}
              </button>
            </div>

            {isRecording && (
              <p className="text-xs font-semibold text-red-600">
                Sedang mendengarkan... Tekan mikrofon untuk berhenti.
              </p>
            )}

            {voiceError && (
              <p className="text-xs text-red-600">{voiceError}</p>
            )}
          </Card>

          {/* Error */}
          {formError && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-green-600 to-green-950 py-4 text-base font-bold text-white shadow-lg transition hover:shadow-xl"
            >
            Kirim Laporan
        </button>
        </form>
      </div>
    </main>
  );
}
