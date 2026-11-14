"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardList, MapPin, UserRound } from "lucide-react";

const items = [
  { href: "/dashboard#map", label: "Peta Klaster", icon: MapPin },
  { href: "/dashboard/reports", label: "Daftar Laporan", icon: ClipboardList },
  { href: "/dashboard/trends", label: "Tren Kualitas Udara", icon: Activity },
  { href: "/dashboard/profile", label: "Akun Petugas", icon: UserRound },
];

export default function DashboardBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi dashboard mobile"
      className="fixed bottom-3 left-1/2 z-[1100] w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 rounded-full border-2 border-[#B5D2C3] bg-white p-2 shadow-[0_8px_25px_rgba(0,80,45,0.12)] lg:hidden"
    >
      <div className="flex h-14 items-center gap-1">
        {items.map((item, index) => {
          const Icon = item.icon;
          const route = item.href.split("#")[0];
          const active =
            (index === 0 &&
              (pathname === "/dashboard" ||
                pathname.startsWith("/dashboard/clusters/"))) ||
            pathname === route;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 flex-1 items-center justify-center rounded-full transition ${
                active
                  ? "bg-[#006B3C] text-white"
                  : "text-[#0B2D1E] hover:bg-green-50"
              }`}
            >
              <Icon size={24} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
