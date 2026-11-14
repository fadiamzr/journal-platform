"use client";

import React from "react";
import type { Locale, MultilingualText } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface LanguageTabsProps {
  content: MultilingualText;
  activeLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
  className?: string;
}

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export function LanguageTabs({
  content,
  activeLocale,
  onLocaleChange,
  className,
}: LanguageTabsProps) {
  const availableLocales = (["en", "fr", "ar"] as Locale[]).filter(
    (loc) => Boolean(content[loc])
  );

  if (availableLocales.length <= 1) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Content language selection"
      className={cn(
        "inline-flex items-center gap-1 rounded-[3px] border border-rule bg-paper-alt p-0.5",
        className
      )}
    >
      {availableLocales.map((loc) => {
        const isActive = loc === activeLocale;
        return (
          <button
            key={loc}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onLocaleChange(loc)}
            className={cn(
              "rounded-[2px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
              isActive
                ? "bg-paper text-ink shadow-none border border-rule"
                : "text-muted hover:text-ink hover:bg-paper/50"
            )}
          >
            {LOCALE_LABELS[loc]}
          </button>
        );
      })}
    </div>
  );
}
