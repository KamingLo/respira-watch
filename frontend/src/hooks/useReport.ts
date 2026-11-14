"use client";

import { useState } from "react";
import axios from "axios";

import { createReport } from "@/services/report.service";
import type {
  ReportPayload,
  CreatedReport,
} from "@/types/report.types";

const DEVICE_HASH_KEY = "respirawatch-device-hash";

const getDeviceHash = (): string => {
  let deviceHash = localStorage.getItem(DEVICE_HASH_KEY);

  if (!deviceHash) {
    deviceHash =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(DEVICE_HASH_KEY, deviceHash);
  }

  return deviceHash;
};

export default function useReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] =
    useState<CreatedReport | null>(null);

  const submitReport = async (
    reportData: Omit<ReportPayload, "deviceHash">
  ): Promise<CreatedReport | null> => {
    try {
      setLoading(true);
      setError(null);

      const deviceHash = getDeviceHash();

      const payload: ReportPayload = {
        ...reportData,
        deviceHash,
      };

      const response = await createReport(payload);

      if (!response.success) {
        throw new Error(response.message || "Gagal mengirim laporan.");
      }

      setSubmittedReport(response.data);
      return response.data;
    } catch (err: unknown) {
      let message = "Terjadi kesalahan saat mengirim laporan.";

      if (axios.isAxiosError(err)) {
        message =
          err.response?.data?.message ||
          err.message ||
          message;
      } else if (err instanceof Error) {
        message = err.message;
      }

      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    submittedReport,
    submitReport,
  };
}
