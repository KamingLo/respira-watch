import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RespiraWatch",
  description: "WebGIS pemantauan kesehatan lingkungan",
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