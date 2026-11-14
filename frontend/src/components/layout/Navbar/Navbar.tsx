import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-[1200] hidden w-full border-b border-gray-200 bg-white md:block">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-8">
        <Link href="/" aria-label="RespiraWatch - Beranda">
          <div className="relative h-12 w-48 overflow-hidden">
            <Image
              src="/images/repirawatchlogo.png"
              alt="RespiraWatch"
              width={1920}
              height={1080}
              className="absolute left-1/2 top-1/2 h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2 scale-[1.6]"
              priority
            />
          </div>
        </Link>

        <nav aria-label="Navigasi utama" className="flex items-center gap-8">
          <Link href="/" className="text-sm font-medium text-green-700">
            Beranda
          </Link>

          <Link href="/lapor" className="text-sm text-gray-600 hover:text-green-700">
            Lapor Gejala
          </Link>

          <a href="#tentang" className="text-sm text-gray-600 hover:text-green-700">
            Tentang
          </a>
        </nav>

        <Link
          href="/login"
          className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
        >
          Login Petugas
        </Link>
      </div>
    </header>
  );
}
