"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { getOfficerToken } from "@/features/auth/authToken";

export type DashboardSocketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

interface DashboardSocketCallbacks {
  onReportNew?: () => void;
  onClusterChanged?: () => void;
}

interface DashboardSocketState {
  status: DashboardSocketStatus;
  error: string | null;
}

export default function useDashboardSocket(
  callbacks: DashboardSocketCallbacks = {}
): DashboardSocketState {
  const callbacksRef = useRef(callbacks);
  const [state, setState] = useState<DashboardSocketState>({
    status: "connecting",
    error: null,
  });

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    let active = true;
    const setConnectionError = (error: string) => {
      Promise.resolve().then(() => {
        if (active) setState({ status: "error", error });
      });
    };
    const token = getOfficerToken();
    if (!token) {
      setConnectionError("Token petugas tidak ditemukan. Silakan masuk kembali.");
      return () => {
        active = false;
      };
    }

    const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!configuredApiUrl) {
      setConnectionError("NEXT_PUBLIC_API_URL belum dikonfigurasi.");
      return () => {
        active = false;
      };
    }

    let socketUrl: string;
    try {
      socketUrl = new URL(configuredApiUrl).origin;
    } catch {
      setConnectionError("NEXT_PUBLIC_API_URL bukan URL backend yang valid.");
      return () => {
        active = false;
      };
    }

    const socket: Socket = io(socketUrl, {
      auth: { token },
      autoConnect: false,
      transports: ["websocket", "polling"],
    });

    const handleConnect = () => {
      setState({ status: "connected", error: null });
    };
    const handleDisconnect = () => {
      setState((current) =>
        current.status === "error"
          ? current
          : { status: "disconnected", error: null }
      );
    };
    const handleConnectError = (error: Error) => {
      setState({ status: "error", error: error.message });
    };
    const handleReportNew = () => {
      callbacksRef.current.onReportNew?.();
    };
    const handleClusterChanged = () => {
      callbacksRef.current.onClusterChanged?.();
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("report:new", handleReportNew);
    socket.on("cluster:detected", handleClusterChanged);
    socket.on("cluster:updated", handleClusterChanged);
    socket.connect();

    return () => {
      active = false;
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("report:new", handleReportNew);
      socket.off("cluster:detected", handleClusterChanged);
      socket.off("cluster:updated", handleClusterChanged);
      socket.disconnect();
    };
  }, []);

  return state;
}
