"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Map,
  UserRound,
  Wind,
} from "lucide-react";

const menuItems = [
  {
    label: "Peta Klaster",
    href: "/dashboard#map",
    icon: Map,
  },
  {
    label: "Daftar Laporan",
    href: "/dashboard#clusters",
    icon: ClipboardList,
  },
  {
    label: "Tren Kualitas Udara",
    href: "/dashboard#trend",
    icon: Wind,
  },
  {
    label: "Akun Petugas",
    href: "/login",
    icon: UserRound,
  },
];

export default function Sidebar({
  children,
}: {
  children?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen min-h-[620px] w-[208px] shrink-0 flex-col border-r border-[#E6ECE8] bg-white p-4 lg:flex">
      <Link
        href="/dashboard"
        aria-label="RespiraWatch - Dashboard"
        className="mb-7 block"
      >
        <div className="relative h-10 w-full overflow-hidden">
          <Image
            src="/images/repirawatchlogo.png"
            alt="RespiraWatch"
            width={1920}
            height={1080}
            className="absolute left-1/2 top-1/2 h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2 scale-[1.6]"
            priority
          />
        </div>
        <p className="mt-1 truncate text-xs text-[#708477]">
          PKM Kelayan Timur
        </p>
      </Link>

      <nav aria-label="Navigasi dashboard" className="space-y-1.5">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const active = pathname === "/dashboard" && index === 0;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                active
                  ? "bg-[#006B3C] text-white shadow-sm"
                  : "text-[#536D60] hover:bg-[#EDF5F0] hover:text-[#006B3C]"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <section
        id="clusters"
        className="mt-auto rounded-2xl bg-[#F7F6F0] p-3"
      >
        <h2 className="mb-2 text-[11px] font-bold text-[#264536]">
          Klaster Aktif (72 Jam)
        </h2>
        <div className="space-y-2">{children}</div>
      </section>
    </aside>
  );
}
