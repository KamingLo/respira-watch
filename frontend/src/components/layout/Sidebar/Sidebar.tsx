"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  ClipboardList,
  Settings,
  LogOut,
} from "lucide-react";

const menuItems = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Peta Cluster",
    href: "/dashboard",
    icon: Map,
  },
  {
    label: "Laporan",
    href: "/dashboard",
    icon: ClipboardList,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">

      {/* Logo */}
      <div className="flex h-20 items-center gap-3 border-b border-gray-100 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-700 text-xl text-white">
          R
        </div>

        <div>
          <h1 className="font-bold text-gray-900">
            RespiraWatch
          </h1>
          <p className="text-xs text-gray-500">
            Officer Dashboard
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-4 py-6">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Main Menu
        </p>

        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const active =
            index === 0
              ? pathname === "/dashboard"
              : false;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                active
                  ? "bg-green-50 font-semibold text-green-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-green-700"
              }`}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Menu */}
      <div className="space-y-2 border-t border-gray-100 p-4">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-gray-600 hover:bg-gray-50">
          <Settings size={20} />
          Pengaturan
        </button>

        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-red-600 hover:bg-red-50">
          <LogOut size={20} />
          Keluar
        </button>
      </div>

    </aside>
  );
}
