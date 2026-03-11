"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full bg-icpac-dark text-white shadow-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
          CRMA — Flood & Drought Events
        </Link>
        <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
          ICPAC / IGAD
        </span>
      </div>
    </nav>
  );
}
