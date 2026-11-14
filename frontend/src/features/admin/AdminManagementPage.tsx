"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  Building2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { getOfficerToken } from "@/features/auth/authToken";
import { getMyProfile } from "@/services/auth.service";
import {
  assignOfficerKelurahan,
  createManagedKelurahan,
  createManagedOfficer,
  deleteManagedKelurahan,
  deleteManagedOfficer,
  getManagedKelurahans,
  getManagedOfficers,
  updateManagedKelurahan,
  updateManagedOfficer,
  type BaselineRiskLevel,
  type CreateKelurahanPayload,
  type GeoPolygon,
  type ManagedKelurahan,
  type ManagedOfficer,
  type OfficerRole,
  type UpdateKelurahanPayload,
} from "@/services/adminManagement.service";

type AccessState = "loading" | "ready" | "forbidden" | "error";
type Feedback = { type: "success" | "error"; message: string };

interface OfficerFormState {
  id?: string;
  name: string;
  nip: string;
  email: string;
  password: string;
  phone: string;
  role: OfficerRole;
  assignedKelurahan: string;
  isActive: boolean;
}

interface KelurahanFormState {
  id?: string;
  code: string;
  name: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  population: string;
  areaSqKm: string;
  baselineRiskLevel: BaselineRiskLevel;
  longitude: string;
  latitude: string;
  boundaryJson: string;
}

const fieldClassName =
  "w-full rounded-xl border border-[#D5E2D9] bg-white px-3 py-2.5 text-sm text-[#264536] outline-none focus:border-[#087546] focus:ring-2 focus:ring-[#087546]/10";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#006B3C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00552F] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#B5D2C3] bg-white px-3 py-2 text-sm font-semibold text-[#264536] transition hover:bg-[#F0F6F2] disabled:cursor-not-allowed disabled:opacity-50";

const emptyOfficerForm = (): OfficerFormState => ({
  name: "",
  nip: "",
  email: "",
  password: "",
  phone: "",
  role: "field_officer",
  assignedKelurahan: "",
  isActive: true,
});

const emptyKelurahanForm = (): KelurahanFormState => ({
  code: "",
  name: "",
  kecamatan: "",
  kota: "",
  provinsi: "",
  population: "0",
  areaSqKm: "",
  baselineRiskLevel: "low",
  longitude: "",
  latitude: "",
  boundaryJson: "",
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getRequestErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const responseData: unknown = error.response?.data;
    if (
      isRecord(responseData) &&
      typeof responseData.message === "string"
    ) {
      return responseData.message;
    }
  }
  return error instanceof Error ? error.message : fallback;
};

const getAssignedKelurahanId = (
  assignedKelurahan: ManagedOfficer["assignedKelurahan"]
): string =>
  typeof assignedKelurahan === "string"
    ? assignedKelurahan
    : assignedKelurahan?._id ?? "";

const getAssignedKelurahanName = (
  assignedKelurahan: ManagedOfficer["assignedKelurahan"]
): string =>
  typeof assignedKelurahan === "string"
    ? "Wilayah ditetapkan"
    : assignedKelurahan?.name ?? "Belum ditetapkan";

const parseNumber = (
  value: string,
  label: string,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY
): number => {
  const parsed = Number(value);
  if (
    value.trim() === "" ||
    !Number.isFinite(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw new Error(`${label} harus berupa angka antara ${minimum} dan ${maximum}.`);
  }
  return parsed;
};

const parseBoundary = (json: string): GeoPolygon => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error("Batas kelurahan harus berupa GeoJSON Polygon yang valid.");
  }

  if (
    !isRecord(parsed) ||
    parsed.type !== "Polygon" ||
    !Array.isArray(parsed.coordinates) ||
    parsed.coordinates.length === 0
  ) {
    throw new Error("GeoJSON batas kelurahan harus bertipe Polygon.");
  }

  const coordinates = parsed.coordinates.map((rawRing, ringIndex) => {
    if (!Array.isArray(rawRing) || rawRing.length < 4) {
      throw new Error(
        `Ring ke-${ringIndex + 1} harus memiliki sedikitnya empat titik.`
      );
    }

    const ring = rawRing.map((rawPoint, pointIndex) => {
      if (!Array.isArray(rawPoint) || rawPoint.length !== 2) {
        throw new Error(
          `Titik ke-${pointIndex + 1} pada ring ${ringIndex + 1} harus berformat [longitude, latitude].`
        );
      }

      const [longitude, latitude] = rawPoint;
      if (
        typeof longitude !== "number" ||
        typeof latitude !== "number" ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new Error(
          `Koordinat titik ke-${pointIndex + 1} pada ring ${ringIndex + 1} tidak valid.`
        );
      }

      return [longitude, latitude];
    });

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (
      !first ||
      !last ||
      first[0] !== last[0] ||
      first[1] !== last[1]
    ) {
      throw new Error(
        `Ring ke-${ringIndex + 1} harus tertutup dengan mengulang titik pertama di akhir.`
      );
    }

    return ring;
  });

  return { type: "Polygon", coordinates };
};

const roleLabels: Record<OfficerRole, string> = {
  admin: "Admin",
  field_officer: "Petugas lapangan",
  health_analyst: "Analis kesehatan",
};

const riskLabels: Record<BaselineRiskLevel, string> = {
  low: "Rendah",
  moderate: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

export default function AdminManagementPage() {
  const router = useRouter();
  const [access, setAccess] = useState<AccessState>("loading");
  const [accessError, setAccessError] = useState("");
  const [officers, setOfficers] = useState<ManagedOfficer[]>([]);
  const [kelurahans, setKelurahans] = useState<ManagedKelurahan[]>([]);
  const [currentOfficerEmail, setCurrentOfficerEmail] = useState("");
  const [officerForm, setOfficerForm] = useState<OfficerFormState | null>(null);
  const [kelurahanForm, setKelurahanForm] =
    useState<KelurahanFormState | null>(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, string>
  >({});
  const [officerSearch, setOfficerSearch] = useState("");
  const [kelurahanSearch, setKelurahanSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingAssignmentId, setSavingAssignmentId] = useState<string | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let active = true;
    const token = getOfficerToken();

    if (!token) {
      router.replace("/login");
      return () => {
        active = false;
      };
    }

    getMyProfile(token)
      .then(async (response) => {
        if (!response.success || !response.data) {
          throw new Error(response.message || "Profil petugas tidak ditemukan.");
        }
        if (response.data.role !== "admin") {
          if (active) setAccess("forbidden");
          return;
        }

        const [officerData, kelurahanData] = await Promise.all([
          getManagedOfficers(token),
          getManagedKelurahans(token),
        ]);
        if (!active) return;

        setCurrentOfficerEmail(response.data.email.toLowerCase());
        setOfficers(officerData);
        setKelurahans(kelurahanData);
        setAccess("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAccessError(
          getRequestErrorMessage(error, "Gagal memuat data administrasi.")
        );
        setAccess("error");
      });

    return () => {
      active = false;
    };
  }, [router]);

  const filteredOfficers = useMemo(() => {
    const query = officerSearch.trim().toLowerCase();
    if (!query) return officers;
    return officers.filter((officer) =>
      [
        officer.name,
        officer.nip,
        officer.email,
        getAssignedKelurahanName(officer.assignedKelurahan),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [officerSearch, officers]);

  const filteredKelurahans = useMemo(() => {
    const query = kelurahanSearch.trim().toLowerCase();
    if (!query) return kelurahans;
    return kelurahans.filter((kelurahan) =>
      [
        kelurahan.code,
        kelurahan.name,
        kelurahan.kecamatan,
        kelurahan.kota,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [kelurahanSearch, kelurahans]);

  const setOfficerField = <K extends keyof OfficerFormState>(
    field: K,
    value: OfficerFormState[K]
  ) => {
    setOfficerForm((current) =>
      current ? { ...current, [field]: value } : current
    );
  };

  const setKelurahanField = <K extends keyof KelurahanFormState>(
    field: K,
    value: KelurahanFormState[K]
  ) => {
    setKelurahanForm((current) =>
      current ? { ...current, [field]: value } : current
    );
  };

  const startEditingOfficer = (officer: ManagedOfficer) => {
    setFeedback(null);
    setOfficerForm({
      id: officer._id,
      name: officer.name,
      nip: officer.nip,
      email: officer.email,
      password: "",
      phone: officer.phone ?? "",
      role: officer.role,
      assignedKelurahan: "",
      isActive: officer.isActive,
    });
  };

  const startEditingKelurahan = (kelurahan: ManagedKelurahan) => {
    setFeedback(null);
    setKelurahanForm({
      id: kelurahan._id,
      code: kelurahan.code,
      name: kelurahan.name,
      kecamatan: kelurahan.kecamatan,
      kota: kelurahan.kota,
      provinsi: kelurahan.provinsi,
      population: String(kelurahan.population ?? 0),
      areaSqKm:
        kelurahan.areaSqKm === undefined ? "" : String(kelurahan.areaSqKm),
      baselineRiskLevel: kelurahan.baselineRiskLevel,
      longitude: String(kelurahan.centroid.coordinates[0]),
      latitude: String(kelurahan.centroid.coordinates[1]),
      boundaryJson: JSON.stringify(kelurahan.boundary, null, 2),
    });
  };

  const handleOfficerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!officerForm || saving) return;

    const token = getOfficerToken();
    if (!token) {
      setFeedback({ type: "error", message: "Sesi admin berakhir. Silakan masuk kembali." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      if (officerForm.id) {
        const updatedOfficer = await updateManagedOfficer(token, officerForm.id, {
          name: officerForm.name.trim(),
          nip: officerForm.nip.trim(),
          email: officerForm.email.trim(),
          ...(officerForm.password
            ? { password: officerForm.password }
            : {}),
          phone: officerForm.phone.trim() || null,
          role: officerForm.role,
          isActive: officerForm.isActive,
        });
        setOfficers((current) =>
          current.map((officer) =>
            officer._id === updatedOfficer._id ? updatedOfficer : officer
          )
        );
        setFeedback({ type: "success", message: "Data petugas berhasil diperbarui." });
      } else {
        if (!officerForm.password) {
          throw new Error("Kata sandi wajib diisi untuk petugas baru.");
        }
        const createdOfficer = await createManagedOfficer(token, {
          name: officerForm.name.trim(),
          nip: officerForm.nip.trim(),
          email: officerForm.email.trim(),
          password: officerForm.password,
          phone: officerForm.phone.trim() || undefined,
          role: officerForm.role,
          assignedKelurahan: officerForm.assignedKelurahan || undefined,
          isActive: officerForm.isActive,
        });
        setOfficers((current) => [createdOfficer, ...current]);
        setFeedback({ type: "success", message: "Petugas berhasil ditambahkan." });
      }
      setOfficerForm(null);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getRequestErrorMessage(error, "Gagal menyimpan data petugas."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignKelurahan = async (officer: ManagedOfficer) => {
    if (savingAssignmentId) return;
    const token = getOfficerToken();
    if (!token) {
      setFeedback({ type: "error", message: "Sesi admin berakhir. Silakan masuk kembali." });
      return;
    }

    const selectedId =
      assignmentDrafts[officer._id] ??
      getAssignedKelurahanId(officer.assignedKelurahan);
    setSavingAssignmentId(officer._id);
    setFeedback(null);
    try {
      const updatedOfficer = await assignOfficerKelurahan(
        token,
        officer._id,
        selectedId || null
      );
      setOfficers((current) =>
        current.map((item) =>
          item._id === updatedOfficer._id ? updatedOfficer : item
        )
      );
      setAssignmentDrafts((current) => {
        const next = { ...current };
        delete next[officer._id];
        return next;
      });
      setFeedback({
        type: "success",
        message: `Penempatan ${officer.name} berhasil diperbarui.`,
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getRequestErrorMessage(
          error,
          "Gagal memperbarui penempatan petugas."
        ),
      });
    } finally {
      setSavingAssignmentId(null);
    }
  };

  const handleDeleteOfficer = async (officer: ManagedOfficer) => {
    if (officer.email.toLowerCase() === currentOfficerEmail) return;
    if (
      !window.confirm(
        `Hapus akun ${officer.name}? Petugas ini tidak dapat masuk lagi.`
      )
    ) {
      return;
    }

    const token = getOfficerToken();
    if (!token) {
      setFeedback({ type: "error", message: "Sesi admin berakhir. Silakan masuk kembali." });
      return;
    }

    setDeletingId(officer._id);
    setFeedback(null);
    try {
      await deleteManagedOfficer(token, officer._id);
      setOfficers((current) =>
        current.filter((item) => item._id !== officer._id)
      );
      setFeedback({ type: "success", message: "Petugas berhasil dihapus." });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getRequestErrorMessage(error, "Gagal menghapus petugas."),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleKelurahanSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!kelurahanForm || saving) return;

    const token = getOfficerToken();
    if (!token) {
      setFeedback({ type: "error", message: "Sesi admin berakhir. Silakan masuk kembali." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const population = parseNumber(
        kelurahanForm.population,
        "Populasi",
        0
      );
      const areaSqKm =
        kelurahanForm.areaSqKm.trim() === ""
          ? undefined
          : parseNumber(kelurahanForm.areaSqKm, "Luas wilayah", 0);
      const payload = {
        code: kelurahanForm.code.trim(),
        name: kelurahanForm.name.trim(),
        kecamatan: kelurahanForm.kecamatan.trim(),
        kota: kelurahanForm.kota.trim(),
        provinsi: kelurahanForm.provinsi.trim(),
        population,
        baselineRiskLevel: kelurahanForm.baselineRiskLevel,
        centroid: {
          type: "Point" as const,
          coordinates: [
            parseNumber(kelurahanForm.longitude, "Longitude", -180, 180),
            parseNumber(kelurahanForm.latitude, "Latitude", -90, 90),
          ] as [number, number],
        },
        boundary: parseBoundary(kelurahanForm.boundaryJson),
      };

      if (kelurahanForm.id) {
        const updatePayload: UpdateKelurahanPayload = {
          ...payload,
          areaSqKm: areaSqKm ?? null,
        };
        const updatedKelurahan = await updateManagedKelurahan(
          token,
          kelurahanForm.id,
          updatePayload
        );
        setKelurahans((current) =>
          current.map((kelurahan) =>
            kelurahan._id === updatedKelurahan._id
              ? updatedKelurahan
              : kelurahan
          )
        );
        setFeedback({
          type: "success",
          message: "Data kelurahan berhasil diperbarui.",
        });
      } else {
        const createPayload: CreateKelurahanPayload = {
          ...payload,
          ...(areaSqKm === undefined ? {} : { areaSqKm }),
        };
        const createdKelurahan = await createManagedKelurahan(
          token,
          createPayload
        );
        setKelurahans((current) =>
          [...current, createdKelurahan].sort((a, b) =>
            a.name.localeCompare(b.name, "id")
          )
        );
        setFeedback({
          type: "success",
          message: "Kelurahan berhasil ditambahkan.",
        });
      }
      setKelurahanForm(null);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getRequestErrorMessage(error, "Gagal menyimpan data kelurahan."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKelurahan = async (kelurahan: ManagedKelurahan) => {
    const assignedCount = officers.filter(
      (officer) =>
        getAssignedKelurahanId(officer.assignedKelurahan) === kelurahan._id
    ).length;
    if (assignedCount > 0) return;
    if (
      !window.confirm(
        `Hapus kelurahan ${kelurahan.name}? Data yang sudah dihapus tidak dapat dipulihkan.`
      )
    ) {
      return;
    }

    const token = getOfficerToken();
    if (!token) {
      setFeedback({ type: "error", message: "Sesi admin berakhir. Silakan masuk kembali." });
      return;
    }

    setDeletingId(kelurahan._id);
    setFeedback(null);
    try {
      await deleteManagedKelurahan(token, kelurahan._id);
      setKelurahans((current) =>
        current.filter((item) => item._id !== kelurahan._id)
      );
      setFeedback({ type: "success", message: "Kelurahan berhasil dihapus." });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getRequestErrorMessage(error, "Gagal menghapus kelurahan."),
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (access === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F4ED] p-6">
        <p className="text-sm font-medium text-[#38614B]">
          Memeriksa hak akses admin...
        </p>
      </main>
    );
  }

  if (access === "forbidden") {
    return (
      <main className="min-h-screen bg-[#F5F4ED] p-6">
        <section className="mx-auto max-w-lg rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[#264536]">
            Akses khusus admin
          </h1>
          <p className="mt-2 text-sm text-[#536D60]">
            Hanya akun admin yang dapat mengelola petugas dan kelurahan.
          </p>
          <Link
            href="/dashboard"
            className={`${primaryButtonClassName} mt-5`}
          >
            Kembali ke dashboard
          </Link>
        </section>
      </main>
    );
  }

  if (access === "error") {
    return (
      <main className="min-h-screen bg-[#F5F4ED] p-6">
        <section className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-[#264536]">
            Data administrasi gagal dimuat
          </h1>
          <p role="alert" className="mt-2 text-sm text-red-700">
            {accessError}
          </p>
          <Link
            href="/dashboard"
            className={`${secondaryButtonClassName} mt-5`}
          >
            Kembali ke dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F4ED] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-center gap-3">
          <Link
            href="/dashboard/profile"
            aria-label="Kembali ke profil petugas"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#B5D2C3] bg-white text-[#123D2B]"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#123D2B]">
              Manajemen Petugas & Kelurahan
            </h1>
            <p className="mt-1 text-sm text-[#536D60]">
              Kelola akun petugas, penempatan, dan wilayah kerja.
            </p>
          </div>
        </header>

        {feedback && (
          <p
            role={feedback.type === "error" ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <section className="rounded-2xl border border-[#D5E2D9] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#164A32]">
                Data petugas
              </h2>
              <p className="mt-1 text-xs text-[#708477]">
                Tambahkan akun, perbarui role atau status, dan tetapkan kelurahan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setOfficerForm(emptyOfficerForm());
              }}
              className={primaryButtonClassName}
            >
              <Plus size={17} />
              Tambah petugas
            </button>
          </div>

          {officerForm && (
            <form
              onSubmit={handleOfficerSubmit}
              className="mt-4 rounded-2xl border border-[#D5E2D9] bg-[#F7FAF7] p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[#264536]">
                  {officerForm.id ? "Edit petugas" : "Tambah petugas"}
                </h3>
                <button
                  type="button"
                  aria-label="Tutup form petugas"
                  onClick={() => setOfficerForm(null)}
                  className="rounded-lg p-2 text-[#536D60] hover:bg-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Nama
                  <input
                    className={fieldClassName}
                    value={officerForm.name}
                    onChange={(event) =>
                      setOfficerField("name", event.target.value)
                    }
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  NIP
                  <input
                    className={fieldClassName}
                    value={officerForm.nip}
                    onChange={(event) =>
                      setOfficerField("nip", event.target.value)
                    }
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Email
                  <input
                    className={fieldClassName}
                    type="email"
                    value={officerForm.email}
                    onChange={(event) =>
                      setOfficerField("email", event.target.value)
                    }
                    autoComplete="email"
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  {officerForm.id
                    ? "Kata sandi baru (opsional)"
                    : "Kata sandi"}
                  <input
                    className={fieldClassName}
                    type="password"
                    value={officerForm.password}
                    onChange={(event) =>
                      setOfficerField("password", event.target.value)
                    }
                    autoComplete="new-password"
                    minLength={6}
                    required={!officerForm.id}
                    placeholder={
                      officerForm.id
                        ? "Kosongkan jika tidak diubah"
                        : "Minimal 6 karakter"
                    }
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Nomor telepon
                  <input
                    className={fieldClassName}
                    type="tel"
                    value={officerForm.phone}
                    onChange={(event) =>
                      setOfficerField("phone", event.target.value)
                    }
                    autoComplete="tel"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Role
                  <select
                    className={fieldClassName}
                    value={officerForm.role}
                    onChange={(event) =>
                      setOfficerField(
                        "role",
                        event.target.value as OfficerRole
                      )
                    }
                  >
                    {Object.entries(roleLabels).map(([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {!officerForm.id && (
                  <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                    Kelurahan tugas (opsional)
                    <select
                      className={fieldClassName}
                      value={officerForm.assignedKelurahan}
                      onChange={(event) =>
                        setOfficerField(
                          "assignedKelurahan",
                          event.target.value
                        )
                      }
                    >
                      <option value="">Belum ditetapkan</option>
                      {kelurahans.map((kelurahan) => (
                        <option key={kelurahan._id} value={kelurahan._id}>
                          {kelurahan.name} · {kelurahan.kecamatan}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 self-end rounded-xl border border-[#D5E2D9] bg-white px-3 py-3 text-sm font-medium text-[#264536]">
                  <input
                    type="checkbox"
                    checked={officerForm.isActive}
                    onChange={(event) =>
                      setOfficerField("isActive", event.target.checked)
                    }
                    className="h-4 w-4 accent-[#006B3C]"
                  />
                  Akun aktif
                </label>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOfficerForm(null)}
                  className={secondaryButtonClassName}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={primaryButtonClassName}
                >
                  <Save size={16} />
                  {saving ? "Menyimpan..." : "Simpan petugas"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#708477]">
              {filteredOfficers.length} dari {officers.length} petugas
            </p>
            <input
              className={`${fieldClassName} max-w-sm`}
              aria-label="Cari petugas"
              placeholder="Cari nama, NIP, email, kelurahan..."
              value={officerSearch}
              onChange={(event) => setOfficerSearch(event.target.value)}
            />
          </div>

          {filteredOfficers.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[#F7FAF7] p-4 text-sm text-[#708477]">
              {officers.length === 0
                ? "Belum ada data petugas."
                : "Tidak ada petugas yang cocok dengan pencarian."}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {filteredOfficers.map((officer) => {
                const assignedId = getAssignedKelurahanId(
                  officer.assignedKelurahan
                );
                const assignmentValue =
                  assignmentDrafts[officer._id] ?? assignedId;
                const isCurrentOfficer =
                  officer.email.toLowerCase() === currentOfficerEmail;

                return (
                  <article
                    key={officer._id}
                    className="rounded-2xl border border-[#E3ECE6] bg-[#FCFDFC] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F4ED] text-[#087546]">
                          <UserRound size={20} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-[#164A32]">
                            {officer.name}
                          </h3>
                          <p className="mt-1 break-all text-xs text-[#536D60]">
                            {officer.email} · NIP {officer.nip}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-[#E9F4ED] px-2.5 py-1 text-[10px] font-semibold text-[#426451]">
                              {roleLabels[officer.role]}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                officer.isActive
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {officer.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                            {isCurrentOfficer && (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                                Akun ini
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingOfficer(officer)}
                          className={secondaryButtonClassName}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteOfficer(officer)}
                          disabled={
                            isCurrentOfficer || deletingId === officer._id
                          }
                          title={
                            isCurrentOfficer
                              ? "Akun admin yang sedang digunakan tidak dapat dihapus."
                              : undefined
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          {deletingId === officer._id ? "Menghapus..." : "Hapus"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-[#E6ECE8] pt-3">
                      <p className="mb-2 text-xs font-semibold text-[#536D60]">
                        Penempatan: {getAssignedKelurahanName(officer.assignedKelurahan)}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select
                          className={`${fieldClassName} flex-1`}
                          aria-label={`Pilih kelurahan untuk ${officer.name}`}
                          value={assignmentValue}
                          onChange={(event) =>
                            setAssignmentDrafts((current) => ({
                              ...current,
                              [officer._id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Belum ditetapkan</option>
                          {kelurahans.map((kelurahan) => (
                            <option key={kelurahan._id} value={kelurahan._id}>
                              {kelurahan.name} · {kelurahan.kecamatan}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleAssignKelurahan(officer)}
                          disabled={
                            savingAssignmentId !== null ||
                            assignmentValue === assignedId
                          }
                          className={secondaryButtonClassName}
                        >
                          {savingAssignmentId === officer._id
                            ? "Menyimpan..."
                            : "Simpan penempatan"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#D5E2D9] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#164A32]">
                Data kelurahan
              </h2>
              <p className="mt-1 text-xs text-[#708477]">
                Tambahkan atau perbarui wilayah beserta geometri peta.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setKelurahanForm(emptyKelurahanForm());
              }}
              className={primaryButtonClassName}
            >
              <Plus size={17} />
              Tambah kelurahan
            </button>
          </div>

          {kelurahanForm && (
            <form
              onSubmit={handleKelurahanSubmit}
              className="mt-4 rounded-2xl border border-[#D5E2D9] bg-[#F7FAF7] p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[#264536]">
                  {kelurahanForm.id ? "Edit kelurahan" : "Tambah kelurahan"}
                </h3>
                <button
                  type="button"
                  aria-label="Tutup form kelurahan"
                  onClick={() => setKelurahanForm(null)}
                  className="rounded-lg p-2 text-[#536D60] hover:bg-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["code", "Kode kelurahan"],
                    ["name", "Nama kelurahan"],
                    ["kecamatan", "Kecamatan"],
                    ["kota", "Kota/Kabupaten"],
                    ["provinsi", "Provinsi"],
                  ] as const
                ).map(([field, label]) => (
                  <label
                    key={field}
                    className="space-y-1 text-xs font-semibold text-[#536D60]"
                  >
                    {label}
                    <input
                      className={fieldClassName}
                      value={kelurahanForm[field]}
                      onChange={(event) =>
                        setKelurahanField(field, event.target.value)
                      }
                      required
                    />
                  </label>
                ))}
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Populasi
                  <input
                    className={fieldClassName}
                    type="number"
                    min="0"
                    step="1"
                    value={kelurahanForm.population}
                    onChange={(event) =>
                      setKelurahanField("population", event.target.value)
                    }
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Luas (km², opsional)
                  <input
                    className={fieldClassName}
                    type="number"
                    min="0"
                    step="any"
                    value={kelurahanForm.areaSqKm}
                    onChange={(event) =>
                      setKelurahanField("areaSqKm", event.target.value)
                    }
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Risiko dasar
                  <select
                    className={fieldClassName}
                    value={kelurahanForm.baselineRiskLevel}
                    onChange={(event) =>
                      setKelurahanField(
                        "baselineRiskLevel",
                        event.target.value as BaselineRiskLevel
                      )
                    }
                  >
                    {Object.entries(riskLabels).map(([level, label]) => (
                      <option key={level} value={level}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Centroid longitude
                  <input
                    className={fieldClassName}
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={kelurahanForm.longitude}
                    onChange={(event) =>
                      setKelurahanField("longitude", event.target.value)
                    }
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-[#536D60]">
                  Centroid latitude
                  <input
                    className={fieldClassName}
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    value={kelurahanForm.latitude}
                    onChange={(event) =>
                      setKelurahanField("latitude", event.target.value)
                    }
                    required
                  />
                </label>
              </div>
              <label className="mt-3 block space-y-1 text-xs font-semibold text-[#536D60]">
                Batas kelurahan (GeoJSON Polygon)
                <textarea
                  className={`${fieldClassName} min-h-40 font-mono text-xs`}
                  value={kelurahanForm.boundaryJson}
                  onChange={(event) =>
                    setKelurahanField("boundaryJson", event.target.value)
                  }
                  placeholder='{"type":"Polygon","coordinates":[[[longitude,latitude],...,[longitude,latitude]]]}'
                  required
                  rows={7}
                />
              </label>
              <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-[#536D60]">
                Masukkan koordinat GeoJSON dalam urutan [longitude, latitude].
                Setiap ring minimal empat titik dan harus ditutup dengan
                mengulang titik pertama. Centroid juga memakai urutan longitude
                lalu latitude.
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setKelurahanForm(null)}
                  className={secondaryButtonClassName}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={primaryButtonClassName}
                >
                  <Save size={16} />
                  {saving ? "Menyimpan..." : "Simpan kelurahan"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#708477]">
              {filteredKelurahans.length} dari {kelurahans.length} kelurahan
            </p>
            <input
              className={`${fieldClassName} max-w-sm`}
              aria-label="Cari kelurahan"
              placeholder="Cari nama, kode, kecamatan..."
              value={kelurahanSearch}
              onChange={(event) => setKelurahanSearch(event.target.value)}
            />
          </div>

          {filteredKelurahans.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[#F7FAF7] p-4 text-sm text-[#708477]">
              {kelurahans.length === 0
                ? "Belum ada data kelurahan."
                : "Tidak ada kelurahan yang cocok dengan pencarian."}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {filteredKelurahans.map((kelurahan) => {
                const assignedOfficerCount = officers.filter(
                  (officer) =>
                    getAssignedKelurahanId(officer.assignedKelurahan) ===
                    kelurahan._id
                ).length;

                return (
                  <article
                    key={kelurahan._id}
                    className="rounded-2xl border border-[#E3ECE6] bg-[#FCFDFC] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F4ED] text-[#087546]">
                          <Building2 size={20} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-[#164A32]">
                            {kelurahan.name}
                          </h3>
                          <p className="mt-1 text-xs text-[#536D60]">
                            {kelurahan.code} · {kelurahan.kecamatan},{" "}
                            {kelurahan.kota}
                          </p>
                          <p className="mt-1 text-xs text-[#708477]">
                            Populasi {kelurahan.population.toLocaleString("id-ID")} ·{" "}
                            {assignedOfficerCount} petugas ditempatkan · Risiko{" "}
                            {riskLabels[kelurahan.baselineRiskLevel]}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingKelurahan(kelurahan)}
                          className={secondaryButtonClassName}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteKelurahan(kelurahan)}
                          disabled={
                            assignedOfficerCount > 0 ||
                            deletingId === kelurahan._id
                          }
                          title={
                            assignedOfficerCount > 0
                              ? "Pindahkan petugas sebelum menghapus kelurahan."
                              : undefined
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          {deletingId === kelurahan._id
                            ? "Menghapus..."
                            : "Hapus"}
                        </button>
                      </div>
                    </div>
                    {assignedOfficerCount > 0 && (
                      <p className="mt-3 text-xs text-amber-800">
                        Kelurahan tidak dapat dihapus selama masih memiliki
                        petugas yang ditugaskan.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
