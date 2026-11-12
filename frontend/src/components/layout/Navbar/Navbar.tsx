import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-700 text-xl text-white">
            R
          </div>

          <div>
            <h1 className="text-lg font-bold text-gray-900">
              RespiraWatch
            </h1>
            <p className="text-xs text-gray-500">
              Health Monitoring System
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
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

        {/* Officer Login */}
        <Link
          href="/login"
          className="hidden rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 md:block"
        >
          Login Petugas
        </Link>

      </div>
    </header>
  );
}
