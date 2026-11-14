"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  Mail,
  Lock,
} from "lucide-react";

import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/Input";
import Card from "@/components/ui/Card/Card";
import useAuth from "@/features/auth/hooks/useAuth";
import { getOfficerToken } from "@/features/auth/authToken";

export default function LoginForm() {
  const router = useRouter();

  const { login, loading, error } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showError, setShowError] = useState("");

  useEffect(() => {
    if (getOfficerToken()) {
      router.replace("/dashboard/profile");
    }
  }, [router]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setShowError("");

    try {
      const data = await login(email, password);


      console.log("Login berhasil:", data.officer);

      router.push("/dashboard");
    } catch (err) {
      console.error("Login gagal:", err);
      setShowError(error || "Email atau kata sandi tidak sesuai.");
    }
  };

  return (
    <main className="min-h-screen bg-[#edf4ef] px-5 py-5 pb-28 md:min-h-[calc(100svh-4rem)] md:pb-5">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[390px] flex-col md:min-h-[calc(100svh-6.5rem)]">

        {/* Header */}
        <header className="mb-5 flex items-center justify-between">
          <button
            type="button"
            aria-label="Kembali"
            onClick={() => window.history.back()}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#b8d9c9] bg-white text-[#244c3b] shadow-sm transition hover:bg-green-50"
          >
            <ArrowLeft size={21} />
          </button>

          <h1 className="text-xl font-extrabold tracking-tight text-[#173d2d]">
            Login Petugas
          </h1>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#b8d9c9] bg-white text-[#244c3b] shadow-sm">
            <ShieldCheck size={23} />
          </div>
        </header>

        {/* Hero Card */}
        <section className="mb-5 rounded-[24px] bg-gradient-to-br from-[#119b59] via-[#006b3b] to-[#003c24] px-5 py-7 text-white shadow-[0_10px_18px_rgba(0,80,45,0.25)]">
          <h2 className="mb-3 text-xl font-extrabold tracking-tight">
            Surveilans Puskesmas
          </h2>

          <p className="text-sm leading-[1.55] text-green-100">
            Pantau klaster laporan ISPA & diare warga
            di wilayah kerja Puskesmas secara real-time.
          </p>
        </section>

        {/* Login Form */}
        <Card className="rounded-[23px] border-[#c0ddce] px-5 py-6 shadow-[0_5px_12px_rgba(30,90,60,0.12)]">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <Input
              label="Email Puskesmas"
              name="email"
              type="email"
              placeholder="dodi.pkm@banjarmasin.go.id"
              value={email}
              onChange={setEmail}
              icon={<Mail size={19} strokeWidth={2.5} />}
              required
              disabled={loading}
            />

            {/* Password */}
            <Input
              label="Kata Sandi"
              name="password"
              type="password"
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={setPassword}
              icon={<Lock size={19} />}
              required
              disabled={loading}
            />

            {/* Information */}
            <div className="rounded-2xl border-[1.5px] border-[#16824d] bg-[#c8ead8] px-3.5 py-3">
              <h3 className="mb-1 text-xs font-bold text-[#174b32]">
                Khusus Tim Surveilans Puskesmas
              </h3>

              <p className="text-xs leading-relaxed text-[#315b45]">
                Kendala akun? Hubungi Admin Dinkes Kota Banjarmasin.
              </p>
            </div>

            {/* Error Message */}
            {(showError || error) && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">
                  {showError || error}
                </p>
              </div>
            )}

            {/* Login Button */}
            <Button
              type="submit"
              variant="primary"
              size="large"
              fullWidth
              disabled={loading || !email || !password}
              className="rounded-full bg-gradient-to-r from-[#119b59] to-[#00472b] py-4 text-sm font-bold shadow-[0_5px_12px_rgba(0,90,50,0.25)] hover:from-[#0b884d] hover:to-[#003c24]"
            >
              {loading ? "Memproses..." : "Masuk Dasbor"}
            </Button>

          </form>
        </Card>

      </div>
    </main>
  );
}
