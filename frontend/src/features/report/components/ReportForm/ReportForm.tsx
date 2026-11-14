"use client";

import { useEffect, useRef, useState } from "react";
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
  RefreshCw,
  Sparkles,
} from "lucide-react";

import Card from "@/components/ui/Card/Card";
import ReportLocationPicker from "@/features/report/components/ReportLocationPicker/ReportLocationPicker";
import {
  symptoms,
  symptomCategoryIcons,
  type SymptomCategory,
} from "@/features/report/symptoms";
import { getAgeGroupForAge } from "@/features/report/utils/ageGroup";
import { classifyComplaint } from "@/services/ai.service";
import { getPublicKelurahans, type PublicKelurahan } from "@/services/kelurahan.service";

import type {
  ReportSeverity,
  ReportLocation,
} from "@/types/report.types";
import type { ComplaintClassification } from "@/types/ai.types";

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

interface AiSuggestion {
  result: ComplaintClassification;
  category: SymptomCategory;
  matchedSymptoms: string[];
}

const symptomAliases: Record<string, string[]> = {
  batuk: ["batuk", "batuk berdahak", "batuk kering"],
  demam: ["demam", "panas"],
  sesak: [
    "sesak",
    "sesak napas",
    "sesak nafas",
    "sulit bernapas",
    "sulit bernafas",
  ],
  pilek: ["pilek", "flu", "hidung tersumbat", "meler"],
  "bab cair": ["bab cair", "diare", "buang air besar cair"],
  muntah: ["muntah", "mual"],
};

const matchSuggestedSymptoms = (
  category: SymptomCategory,
  suggestedSymptoms: string[]
): string[] => {
  const normalizedSuggestions = suggestedSymptoms.map((symptom) =>
    symptom.trim().toLocaleLowerCase("id-ID")
  );

  return symptoms[category]
    .filter((symptom) => {
      const aliases = symptomAliases[symptom.label.toLocaleLowerCase("id-ID")] ?? [
        symptom.label.toLocaleLowerCase("id-ID"),
      ];

      return aliases.some((alias) =>
        normalizedSuggestions.includes(alias)
      );
    })
    .map((symptom) => symptom.label);
};

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
  const [kelurahans, setKelurahans] = useState<PublicKelurahan[]>([]);
  const [kelurahanError, setKelurahanError] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [description, setDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [formError, setFormError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  useEffect(() => {
    let active = true;
    getPublicKelurahans()
      .then((data) => {
        if (active) setKelurahans(data);
      })
      .catch((error: unknown) => {
        if (active) {
          setKelurahanError(
            error instanceof Error
              ? error.message
              : "Pilihan kelurahan belum dapat dimuat."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleSymptom = (symptom: string) => {
    setAiSuggestion(null);
    setSelectedSymptoms((previous) =>
      previous.includes(symptom)
        ? previous.filter((item) => item !== symptom)
        : [...previous, symptom]
    );
  };

  const handleCategoryChange = (value: SymptomCategory) => {
    setAiSuggestion(null);
    setCategory(value);
    setSelectedSymptoms([]);
  };

  const handleAiAssist = async () => {
    const complaint = description.trim();
    if (!complaint) return;

    const parsedAge = Number(age);
    const validAge =
      age.trim() !== "" &&
      Number.isInteger(parsedAge) &&
      parsedAge >= 0 &&
      parsedAge <= 120;

    setAiError("");
    setAiSuggestion(null);
    setAiLoading(true);

    try {
      const result = await classifyComplaint(
        complaint,
        validAge ? parsedAge : undefined
      );
      const suggestedCategory: SymptomCategory =
        result.category === "ispa" ? "ISPA" : "Diare";

      setAiSuggestion({
        result,
        category: suggestedCategory,
        matchedSymptoms: matchSuggestedSymptoms(
          suggestedCategory,
          result.symptoms
        ),
      });
    } catch (error: unknown) {
      setAiError(
        error instanceof Error
          ? error.message
          : "Saran AI belum bisa dimuat. Silakan coba lagi."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;

    setCategory(aiSuggestion.category);
    setSelectedSymptoms(aiSuggestion.matchedSymptoms);
    setSeverity(aiSuggestion.result.severity);
    if (!age.trim() && aiSuggestion.result.age !== undefined) {
      setAge(String(aiSuggestion.result.age));
    }
    setAiSuggestion(null);
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
        setAiSuggestion(null);
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
      ageGroups: [getAgeGroupForAge(parsedAge)],
      severity,
      location: location.address,
      ...(location.locationSuggestion
        ? { locationSuggestion: location.locationSuggestion }
        : {}),
      ...(location.kelurahanId ? { kelurahanId: location.kelurahanId } : {}),
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

              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#B5D2C3] bg-[#EDF2EE] px-3 py-2.5">
                <Users size={18} className="shrink-0 text-green-800" />

                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="patient-age"
                    className="block text-xs font-semibold text-gray-600"
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
                      onChange={(event) => {
                        setAge(event.target.value);
                        setAiSuggestion(null);
                      }}
                      placeholder="Usia"
                      className="h-8 w-full min-w-0 bg-transparent text-base font-bold text-[#123D2B] outline-none placeholder:text-gray-400"
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

              <label
                htmlFor="report-kelurahan"
                className="mt-4 block text-sm font-bold text-[#123D2B]"
              >
                Atau pilih kelurahan
              </label>
              <select
                id="report-kelurahan"
                value={location?.kelurahanId ?? ""}
                onChange={(event) => {
                  const kelurahan = kelurahans.find(
                    (item) => item.id === event.target.value
                  );
                  if (kelurahan) {
                    setLocation({
                      address: `${kelurahan.name}, ${kelurahan.kecamatan}`,
                      coordinates: kelurahan.centroid.coordinates,
                      kelurahanId: kelurahan.id,
                    });
                  }
                }}
                className="mt-2 min-h-12 w-full rounded-xl border border-[#B5D2C3] bg-white px-3 text-base text-[#123D2B]"
              >
                <option value="">Pilih kelurahan jika GPS tidak tersedia</option>
                {kelurahans.map((kelurahan) => (
                  <option key={kelurahan.id} value={kelurahan.id}>
                    {kelurahan.name} · {kelurahan.kecamatan}
                  </option>
                ))}
              </select>
              {kelurahanError && (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  {kelurahanError}
                </p>
              )}

              {location && (
                <p className="mt-3 rounded-lg bg-green-50 p-3 text-xs leading-relaxed text-green-900">
                  <span className="font-bold">Lokasi dipilih:</span>
                  <br />
                  {location.address}
                  {location.locationSuggestion && !location.kelurahanId && (
                    <>
                      <br />
                      <span className="mt-1 inline-block">
                        Perkiraan wilayah: {location.locationSuggestion.name}
                        {location.locationSuggestion.kecamatan
                          ? ` · ${location.locationSuggestion.kecamatan}`
                          : ""}
                      </span>
                    </>
                  )}
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
                  onClick={() => {
                    setSeverity(item);
                    setAiSuggestion(null);
                  }}
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
                onChange={(event) => {
                  setDescription(event.target.value);
                  setAiSuggestion(null);
                  setAiError("");
                }}
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

            <button
              type="button"
              onClick={handleAiAssist}
              disabled={aiLoading || !description.trim()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-green-800 bg-white px-4 py-2 text-sm font-semibold text-green-900 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {aiLoading ? "Menganalisis keluhan..." : "Bantu isi dengan AI"}
            </button>

            {aiError && (
              <p role="alert" className="text-sm text-red-700">
                {aiError}
              </p>
            )}

            {aiSuggestion && (
              <section
                aria-live="polite"
                className="mt-3 rounded-xl border border-green-200 bg-white p-3"
              >
                <h3 className="text-sm font-bold text-green-900">
                  Saran AI (bukan diagnosis)
                </h3>
                <p className="mt-2 text-xs text-gray-700">
                  Kategori: <strong>{aiSuggestion.category}</strong>
                  {" · "}
                  Keparahan:{" "}
                  <strong className="capitalize">
                    {aiSuggestion.result.severity}
                  </strong>
                </p>
                <p className="mt-1 text-xs text-gray-700">
                  Gejala:{" "}
                  {aiSuggestion.result.symptoms.length > 0
                    ? aiSuggestion.result.symptoms.join(", ")
                    : "Tidak ada gejala yang dikenali"}
                </p>
                {aiSuggestion.result.meta.usedFallback && (
                  <p className="mt-2 text-xs text-amber-700">
                    Analisis menggunakan saran dasar karena layanan AI utama
                    sedang tidak tersedia.
                  </p>
                )}
                <button
                  type="button"
                  onClick={applyAiSuggestion}
                  className="mt-3 rounded-full bg-green-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-green-900"
                >
                  Gunakan saran
                </button>
              </section>
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
