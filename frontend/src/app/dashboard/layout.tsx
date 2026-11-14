"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/features/auth/components/AuthGuard/AuthGuard";
import Sidebar from "@/components/layout/Sidebar/Sidebar";
import DashboardBottomNavigation from "@/components/layout/DashboardBottomNavigation/DashboardBottomNavigation";
import { getClusters } from "@/services/cluster.service";
import type { ClusterRecord } from "@/types/cluster.types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [clusters, setClusters] = useState<ClusterRecord[]>([]);
  const [clustersLoading, setClustersLoading] = useState(true);
  const [clustersError, setClustersError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getClusters()
      .then((items) => {
        if (active) setClusters(items);
      })
      .catch((error: unknown) => {
        if (active) {
          setClustersError(
            error instanceof Error ? error.message : "Gagal memuat klaster."
          );
        }
      })
      .finally(() => {
        if (active) setClustersLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#F5F4ED]">
        <div className="grid min-h-screen lg:grid-cols-[208px_minmax(0,1fr)]">
          <Sidebar>
            {clustersLoading ? (
              <p className="rounded-xl bg-white px-2.5 py-3 text-[11px] leading-relaxed text-[#708477]">
                Memuat klaster aktif...
              </p>
            ) : clustersError ? (
              <p className="rounded-xl bg-white px-2.5 py-3 text-[11px] leading-relaxed text-red-700">
                Gagal memuat klaster aktif.
              </p>
            ) : clusters.length === 0 ? (
              <p className="rounded-xl bg-white px-2.5 py-3 text-[11px] leading-relaxed text-[#708477]">
                Belum ada klaster aktif.
              </p>
            ) : (
              clusters.slice(0, 3).map((cluster) => {
                const location =
                  cluster.kelurahanId &&
                  typeof cluster.kelurahanId === "object" &&
                  cluster.kelurahanId.name
                    ? cluster.kelurahanId.name
                    : cluster.clusterCode;

                return (
                  <Link
                    key={cluster._id}
                    href={`/dashboard/clusters/${encodeURIComponent(cluster._id)}`}
                    className="block rounded-xl bg-white px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-bold text-[#264536]">
                        {location}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          cluster.riskStatus === "Prioritas"
                            ? "bg-red-50 text-red-600"
                            : "bg-[#EAF5EE] text-[#176B45]"
                        }`}
                      >
                        {cluster.riskStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#708477]">
                      {cluster.reportCount} laporan ·{" "}
                      {cluster.category.toUpperCase()}
                    </p>
                  </Link>
                );
              })
            )}
          </Sidebar>
          <div className="min-w-0 pb-24 lg:pb-0">{children}</div>
        </div>
        <DashboardBottomNavigation />
      </div>
    </AuthGuard>
  );
}
