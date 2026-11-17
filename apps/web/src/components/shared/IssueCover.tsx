import React from "react";
import type { Issue } from "@/lib/domain/types";
import { brand } from "@/config/brand";
import { formatVolumeIssue, cn } from "@/lib/utils";

export interface IssueCoverProps {
  issue: Issue;
  size?: "hero" | "card" | "banner";
  locale?: string;
  className?: string;
}

export function IssueCover({
  issue,
  size = "card",
  locale = "en",
  className,
}: IssueCoverProps) {
  const isHero = size === "hero";
  const isBanner = size === "banner";

  const volumeLabel = formatVolumeIssue(issue.volume, issue.number, locale);
  const localizedTitle =
    (issue.title && (issue.title[locale as "en" | "fr" | "ar"] ||
      issue.title.en ||
      issue.title.fr)) ||
    "";

  // Aspect ratio is classic academic book ratio (3:4 or ~1:1.38)
  const sizeClasses = {
    hero: "w-full max-w-[310px] aspect-[1/1.38] p-6 text-center",
    card: "w-full max-w-[190px] aspect-[1/1.38] p-3 text-center",
    banner: "w-full max-w-[240px] aspect-[1/1.38] p-4 text-center",
  }[size];

  return (
    <div
      aria-label={`${brand.name} - ${volumeLabel} (${issue.year})`}
      className={cn(
        "relative rounded-[3px] border border-rule bg-paper shadow-warm overflow-hidden flex flex-col justify-between select-none group transition-all duration-200",
        sizeClasses,
        className
      )}
    >
      {/* Background Archival Geometric Pattern (deterministic thin lines in accent and gold) */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full pointer-events-none opacity-[0.14] stroke-accent"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={`cover-pat-${issue.id}-${size}`}
            width="36"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="18" cy="18" r="16" fill="none" strokeWidth="0.5" />
            <path d="M 0 18 L 36 18 M 18 0 L 18 36" strokeWidth="0.3" stroke="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#cover-pat-${issue.id}-${size})`} />
      </svg>

      {/* Subtle Spine Accent on Start Edge */}
      <div className="absolute top-0 start-0 bottom-0 w-1.5 bg-accent/90" />

      {/* Inner Decorative Framing with Gold Inset */}
      <div className="absolute inset-2 border border-gold/30 rounded-[2px] pointer-events-none" />
      <div className="absolute inset-2.5 border border-rule/60 rounded-[1px] pointer-events-none" />

      {/* Top Header: Wordmark & Monogram */}
      <header className="relative z-10 space-y-1 pt-1">
        <div className="flex items-center justify-center gap-1.5">
          <span className="h-4 w-4 rounded-full border border-gold/70 flex items-center justify-center text-[9px] font-serif font-bold text-accent">
            {brand.logo.monogram?.letter || "J"}
          </span>
          <span className="text-[10px] sm:text-[11px] font-heading font-bold tracking-[0.2em] text-ink uppercase">
            {brand.name}
          </span>
        </div>
        <div className="w-12 h-[1px] bg-gold/50 mx-auto" />
      </header>

      {/* Middle Body: Volume, Issue & Theme */}
      <div className="relative z-10 py-2 space-y-1.5 my-auto">
        <div className="inline-block px-2 py-0.5 rounded-[2px] border border-accent/20 bg-paper-alt/80 text-accent font-mono font-medium text-[10px] sm:text-xs">
          {volumeLabel}
        </div>

        <h3
          className={cn(
            "font-heading font-semibold text-ink line-clamp-3 leading-snug",
            isHero ? "text-base sm:text-lg" : isBanner ? "text-sm sm:text-base" : "text-xs"
          )}
        >
          {localizedTitle}
        </h3>

        <div className="text-[11px] font-serif italic text-muted">
          {issue.year}
        </div>
      </div>

      {/* Bottom Footer: Publisher Imprint & ISSN */}
      <footer className="relative z-10 space-y-1 pb-1">
        <div className="w-10 h-[1px] bg-rule mx-auto" />
        <div className="text-[9px] sm:text-[10px] text-muted font-body uppercase tracking-wider">
          {brand.publisher.name}
        </div>
        <div className="text-[8px] font-mono text-muted/80">
          ISSN {brand.issn.online}
        </div>
      </footer>
    </div>
  );
}
