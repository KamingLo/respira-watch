"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  FileText,
  House,
  UserRound,
} from "lucide-react";

const navigationItems = [
  {
    label: "Peta",
    href: "/",
    icon: MapPin,
  },
  {
    label: "Laporan",
    href: "/lapor",
    icon: FileText,
  },
  {
    label: "Beranda",
    href: "/",
    icon: House,
  },
  {
    label: "Profil",
    href: "/profil",
    icon: UserRound,
  },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 rounded-full border-2 border-[#B5D2C3] bg-white p-2 shadow-[0_8px_25px_rgba(0,80,45,0.12)] md:bottom-6 md:max-w-[560px] md:p-2.5">

      <div className="flex h-14 items-center gap-1 md:h-[68px] md:gap-2">

        {navigationItems.map((item) => {
          const Icon = item.icon;

          const active =
            item.label === "Peta"
              ? pathname === "/"
              : item.label !== "Beranda" &&
                pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              className={`flex h-12 min-w-0 items-center justify-center rounded-full transition-all duration-200 md:h-[58px] ${
                active
                  ? "flex-[1.35] gap-2 bg-[#006B3C] text-white"
                  : "flex-1 text-[#0B2D1E] hover:bg-green-50"
              }`}
            >
              <Icon
                size={26}
                strokeWidth={2.5}
                className="shrink-0 md:size-8"
              />

              {active && (
                <span className="whitespace-nowrap text-base font-bold md:text-lg">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}

      </div>
    </nav>
  );
}
