"use client";

import {
  AlertTriangle,
  MapPin,
  Wind,
  Thermometer,
  Stethoscope,
  Plus,
} from "lucide-react";

import Button from "@/components/ui/Button/Button";

export default function ReportSuccessPage() {
  const handleFindHospital = () => {
    window.open(
      "https://www.google.com/maps/search/?api=1&query=Puskesmas+Kelayan+Timur",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <main className="min-h-screen bg-[#EDF2EE] px-4 pb-32 pt-5">
      <div className="mx-auto max-w-[520px] space-y-4">

        {/* Status Laporan dan AQI */}
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#078B50] via-[#006B3C] to-[#003D28] p-5 text-white shadow-lg shadow-green-900/20">

          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold">
                Laporan Terkirim
              </h1>
              <p className="mt-1 text-xs text-green-100">
                RW 04 • Bukan alat diagnosis
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-white bg-[#FFB900] px-3 py-2 text-[#173B2B] shadow-md">
              <AlertTriangle size={17} />
              <span className="text-xs font-bold">
                Waspada
              </span>
            </div>
          </div>

          {/* AQI */}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[48px] font-bold leading-none tracking-tight">
              118
            </span>

            <div>
              <p className="text-sm font-bold">
                Udara Tidak Sehat
              </p>
              <p className="mt-1 text-xs text-green-100">
                Indeks Kualitas Udara (AQI)
              </p>
            </div>
          </div>

          {/* AQI Indicator */}
          <div className="mt-4 flex h-6 items-center gap-1 rounded-full bg-white p-1.5">
            <div className="h-full flex-1 rounded-full bg-[#05B878]" />
            <div className="h-full flex-1 rounded-full bg-[#FFB900]" />
            <div className="h-full flex-1 rounded-full border-2 border-[#003D28] bg-[#FF7417]" />
            <div className="h-full flex-1 rounded-full bg-[#E91E50]" />
            <div className="h-full flex-1 rounded-full bg-[#C69AD0]" />
          </div>
        </section>

        {/* Saran Kesehatan */}
        <section className="rounded-[22px] border border-[#B9D9C8] bg-white p-5 shadow-md shadow-green-900/5">

          <h2 className="mb-4 text-base font-bold text-[#183D2D]">
            3 Saran Hari Ini
          </h2>

          <div className="space-y-3">
            {/* Saran 1 */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#148650] bg-[#D9F1E4] text-[#087544]">
                <Wind size={23} />
              </div>

              <p className="text-sm leading-relaxed text-[#29483A]">
                Pakai masker saat beraktivitas di luar
              </p>
            </div>

            {/* Saran 2 */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#148650] bg-[#D9F1E4] text-[#087544]">
                <Thermometer size={23} />
              </div>

              <p className="text-sm leading-relaxed text-[#29483A]">
                Beri anak air hangat & istirahat cukup
              </p>
            </div>

            {/* Saran 3 */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#148650] bg-[#D9F1E4] text-[#087544]">
                <Stethoscope size={23} />
              </div>

              <p className="text-sm font-semibold leading-relaxed text-[#29483A]">
                Segera ke Puskesmas bila napas cepat
              </p>
            </div>
          </div>
        </section>

        {/* Rekomendasi Puskesmas */}
        <section className="overflow-hidden rounded-[22px] border border-[#B9D9C8] bg-white p-4 shadow-md shadow-green-900/5">

          {/* Ilustrasi Puskesmas */}
          <div className="relative flex h-[112px] items-end justify-center overflow-hidden rounded-[15px] border border-[#B9D9C8] bg-[#E0F1E8]">

            {/* Background landscape */}
            <div className="absolute -bottom-9 left-[-15px] h-16 w-[115%] rounded-[50%] bg-[#C7E7D6]" />

            {/* Pohon kiri */}
            <div className="absolute bottom-5 left-[18%] h-6 w-6 rounded-full bg-[#7BC69F]" />

            {/* Pohon kanan */}
            <div className="absolute bottom-5 right-[18%] h-6 w-6 rounded-full bg-[#7BC69F]" />

            {/* Gedung Puskesmas */}
            <div className="relative z-10 mb-2 flex h-[65px] w-24 flex-col items-center rounded-t-md bg-white shadow-sm">

              {/* Atap */}
              <div className="absolute -top-1 h-2 w-[112%] rounded-full bg-[#006B3C]" />

              {/* Jendela dan pintu */}
              <div className="mt-4 flex w-full items-center justify-around px-2">
                <div className="h-4 w-4 rounded-sm bg-[#C5EBD7]" />

                <div className="flex flex-col items-center">
                  <Plus size={20} strokeWidth={2.5} className="text-[#174B35]" />
                </div>

                <div className="h-4 w-4 rounded-sm bg-[#C5EBD7]" />
              </div>

              <div className="mt-1 h-8 w-7 rounded-t-sm bg-[#C5EBD7]" />
            </div>
          </div>

          {/* Informasi Puskesmas */}
          <div className="mt-3">
            <h2 className="text-base font-bold text-[#183D2D]">
              Puskesmas Kelayan Timur
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#61776A]">
              <span>1.2 km</span>
              <span>•</span>
              <span>Buka 24 Jam (UGD)</span>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <p className="px-3 text-center text-[11px] leading-relaxed text-[#718579]">
          Informasi AQI dan saran kesehatan merupakan informasi awal,
          bukan diagnosis medis. Hubungi tenaga kesehatan untuk
          pemeriksaan lebih lanjut.
        </p>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 z-[1000] w-full bg-gradient-to-t from-[#EDF2EE] via-[#EDF2EE] to-transparent px-4 pb-5 pt-8">
        <div className="mx-auto max-w-[520px]">
          <Button
            fullWidth
            size="large"
            onClick={handleFindHospital}
            className="!rounded-full !bg-gradient-to-r !from-[#078B50] !to-[#003D28] !py-4 !text-base !font-bold !text-white shadow-lg shadow-green-900/20 hover:!shadow-xl"
          >
            <MapPin size={20} />
            Cari Puskesmas Terdekat
          </Button>
        </div>
      </div>
    </main>
  );
}
