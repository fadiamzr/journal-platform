import React from "react";
import { Link } from "@/i18n/routing";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-alt flex flex-col justify-between p-4 md:p-8">
      {/* Top bar with back to journal & language */}
      <header className="flex items-center justify-between max-w-lg mx-auto w-full">
        <Link
          href="/"
          className="font-heading font-bold text-2xl tracking-tight text-ink hover:text-accent transition-colors"
        >
          {brand.name}
        </Link>
        <LanguageSwitcher variant="dropdown" />
      </header>

      {/* Centered card */}
      <main id="main-content" className="w-full max-w-md mx-auto my-8">
        <div className="bg-paper border border-rule rounded-[3px] p-6 md:p-8 shadow-sm">
          {children}
        </div>
      </main>

      {/* Subtle footer */}
      <footer className="text-center text-xs text-muted max-w-md mx-auto">
        <p>{brand.publisher.name} • {brand.name}</p>
      </footer>
    </div>
  );
}
