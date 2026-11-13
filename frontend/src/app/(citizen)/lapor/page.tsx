"use client";

import { useState } from "react";
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
} from "lucide-react";

import Button from "@/components/ui/Button/Button";
import Card from "@/components/ui/Card/Card";
import Badge from "@/components/ui/Badge/Badge";

type Category = "ISPA" | "Diare";

interface Symptom {
  label: string;
  icon: string;
}

interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const symptoms: Record<Category, Symptom[]> = {
  ISPA: [
    { label: "Batuk", icon: "/images/symptoms/batuk.png" },
    { label: "Demam", icon: "/images/symptoms/demam.png" },
    { label: "Sesak", icon: "/images/symptoms/sesak.png" },
    { label: "Pilek", icon: "/images/symptoms/pilek.png" },
  ],
  Diare: [
    { label: "BAB Cair", icon: "/images/symptoms/babcair.png" },
    { label: "Muntah", icon: "/images/symptoms/muntah.png" },
    { label: "Demam", icon: "/images/symptoms/demam.png" },
  ],
};

export default function ReportPage() {
  const router = useRouter();

  const [category, setCategory] = useState<Category>("ISPA");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    "Batuk",
    "Demam",
    "Sesak",
  ]);

  const [ageGroup, setAgeGroup] = useState("Balita • 2 org");
  const [location] = useState("Kelayan Slt.");
  const [description, setDescription] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((previous) =>
      previous.includes(symptom)
        ? previous.filter((item) => item !== symptom)
        : [...previous, symptom]
    );
  };

  const handleCategoryChange = (value: Category) => {
    setCategory(value);
    setSelectedSymptoms([]);
  };

  // Voice-to-text
  const handleVoiceInput = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionAPI =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceError(
        "Browser kamu belum mendukung fitur pengenalan suara."
      );
      return;
    }

    const recognition = new SpeechRecognitionAPI();

    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = false;

    setVoiceError("");
    setIsRecording(true);

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
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

      if (transcript) {
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
    };

    recognition.start();
  };

  const handleSubmit = () => {
    if (selectedSymptoms.length === 0) {
      alert("Pilih minimal satu gejala.");
      return;
    }

    if (!description.trim()) {
      alert("Tuliskan keluhan atau gunakan fitur mikrofon.");
      return;
    }

    const reportData = {
      category,
      selectedSymptoms,
      ageGroup,
      location,
      description,
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
            onClick={() => router.back()}
            aria-label="Kembali"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B] shadow-sm transition hover:bg-green-50"
          >
            <ArrowLeft size={22} />
          </button>

          <h1 className="text-xl font-bold text-[#123D2B]">
            Lapor Gejala
          </h1>

          <button
            onClick={handleVoiceInput}
            aria-label="Input suara"
            className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#B5D2C3] shadow-sm transition hover:bg-green-50 ${
              isRecording
                ? "bg-red-100 text-red-600"
                : "bg-white text-[#123D2B]"
            }`}
          >
            {isRecording ? (
              <MicOff size={21} />
            ) : (
              <Mic size={21} />
            )}
          </button>
        </header>

        {/* Category and Information */}
        <Card className="!rounded-2xl !border-[#B5D2C3] !p-3">
          <div className="grid grid-cols-2 gap-2">

            <button
              onClick={() => handleCategoryChange("ISPA")}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border-2 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${
                category === "ISPA"
                  ? "border-green-700 bg-green-100 text-green-800"
                  : "border-[#B5D2C3] bg-[#EDF2EE] text-gray-700 hover:bg-green-50"
              }`}
            >
              <Activity size={19} />
              ISPA
            </button>

            <button
              onClick={() => handleCategoryChange("Diare")}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border-2 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${
                category === "Diare"
                  ? "border-green-700 bg-green-100 text-green-800"
                  : "border-[#B5D2C3] bg-[#EDF2EE] text-gray-700 hover:bg-green-50"
              }`}
            >
              <Activity size={19} />
              Diare
            </button>

            <button
              onClick={() => setAgeGroup("Balita • 2 org")}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-green-700 bg-green-100 px-2 py-3 text-xs font-semibold text-green-900 transition hover:bg-green-200"
            >
              <Users size={18} />
              {ageGroup}
            </button>

            <div className="flex items-center justify-center gap-2 rounded-xl border border-[#B5D2C3] bg-[#EDF2EE] px-2 py-3 text-xs font-semibold text-[#123D2B]">
              <MapPin size={18} />
              {location}
            </div>
          </div>
        </Card>

        {/* Symptom Selection */}
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
                    width={48}
                    height={48}
                    className="h-12 w-12 object-contain"
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

        {/* Description */}
        <Card className="!rounded-2xl !border-[#B5D2C3] !bg-[#E5F1E9] !p-4">
          <div className="flex items-start gap-2">
            <textarea
              id="description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Ceritakan keluhan yang dialami..."
              rows={4}
              className="min-h-[100px] w-full resize-none bg-transparent text-sm font-medium leading-relaxed text-[#123D2B] outline-none placeholder:text-gray-500"
            />

            <button
              type="button"
              onClick={handleVoiceInput}
              aria-label="Rekam keluhan"
              className={`mt-1 shrink-0 cursor-pointer rounded-full p-2 transition hover:bg-green-100 ${
                isRecording
                  ? "animate-pulse bg-red-100 text-red-600"
                  : "text-green-800"
              }`}
            >
              {isRecording ? (
                <MicOff size={21} />
              ) : (
                <Mic size={21} />
              )}
            </button>
          </div>

          {isRecording && (
            <p className="text-xs font-semibold text-red-600">
              Sedang mendengarkan... Tekan mikrofon untuk berhenti.
            </p>
          )}

          {voiceError && (
            <p className="text-xs text-red-600">
              {voiceError}
            </p>
          )}
        </Card>

        {/* Submit */}
        <Button
          fullWidth
          size="large"
          onClick={handleSubmit}
          className="!rounded-full !bg-gradient-to-r !from-green-600 !to-green-950 !py-4 !text-base shadow-lg hover:!shadow-xl"
        >
          Kirim Laporan
        </Button>

      </div>
    </main>
  );
}
