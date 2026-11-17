"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import { brand } from "@/config/brand";
import { Monogram } from "@/components/shared/Monogram";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLocale } from "next-intl";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();

  const localizedTagline =
    brand.tagline[locale as "en" | "fr" | "ar"] || brand.tagline.en;

  const localizedDescription =
    brand.description[locale as "en" | "fr" | "ar"] || brand.description.en;

  return (
    <div className="min-h-screen bg-paper-alt flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Header Strip */}
      <header className="flex items-center justify-between max-w-4xl mx-auto w-full pb-4">
        <Link
          href="/"
          className="flex items-center gap-2 group transition-opacity hover:opacity-90"
        >
          <Monogram size="sm" />
          <span className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-ink group-hover:text-accent transition-colors">
            {brand.name}
          </span>
        </Link>
        <LanguageSwitcher variant="dropdown" />
      </header>

      {/* Main Container: Two-column card on large screens */}
      <main id="main-content" className="w-full max-w-4xl mx-auto my-auto py-4">
        <div className="bg-paper border border-rule rounded-[3px] shadow-warm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Decorative Side Panel (Desktop only, archival geometric pattern, no images) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 bg-paper-alt border-e border-rule relative overflow-hidden select-none">
            {/* Archival Geometric SVG Pattern */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 h-full w-full pointer-events-none opacity-[0.14] stroke-accent"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="auth-pat"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="20" cy="20" r="18" fill="none" strokeWidth="0.5" />
                  <path d="M 0 20 L 40 20 M 20 0 L 20 40" strokeWidth="0.3" stroke="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#auth-pat)" />
            </svg>

            {/* Inner Gold Framing */}
            <div className="absolute inset-3 border border-gold/30 rounded-[2px] pointer-events-none" />

            {/* Panel Top */}
            <div className="relative z-10 space-y-3">
              <Monogram size="md" />
              <div className="w-10 h-[1.5px] bg-gold" />
              <h2 className="font-heading font-bold text-lg text-ink">
                {brand.name}
              </h2>
              <p className="text-xs font-heading italic text-muted leading-relaxed">
                {localizedTagline}
              </p>
            </div>

            {/* Panel Middle: Academic Statement */}
            <div className="relative z-10 my-8 space-y-2">
              <blockquote className="text-xs font-body text-ink/80 leading-relaxed border-s-2 border-accent ps-3">
                {localizedDescription}
              </blockquote>
            </div>

            {/* Panel Bottom: Publisher & ISSN */}
            <div className="relative z-10 space-y-1 text-[11px] font-mono text-muted border-t border-rule/60 pt-4">
              <div>{brand.publisher.name}</div>
              <div>ISSN {brand.issn.print} (Print) • {brand.issn.online} (Online)</div>
            </div>
          </div>

          {/* Form Content Column */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
            {children}
          </div>
        </div>
      </main>

      {/* Subtle Academic Footer */}
      <footer className="text-center text-xs text-muted max-w-4xl mx-auto w-full pt-4 font-body">
        <p>
          {brand.publisher.name} • {brand.name} • Open Access (CC BY-NC 4.0)
        </p>
      </footer>
    </div>
  );
}
