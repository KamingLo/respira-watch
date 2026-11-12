import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RespiraWatch",
  description: "Sistem pemantauan kesehatan berbasis WebGIS",
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
