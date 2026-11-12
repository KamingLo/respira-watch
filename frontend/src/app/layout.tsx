import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RespiraWatch",
  description: "WebGIS Health Monitoring System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
