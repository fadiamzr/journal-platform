"use client";

import React from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const LOCALES: Array<{ code: "en" | "fr" | "ar"; label: string }> = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

export function LanguageSwitcher({ variant = "dropdown" }: { variant?: "dropdown" | "links" }) {
  const currentLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleSelect = (nextLocale: "en" | "fr" | "ar") => {
    if (nextLocale === currentLocale) return;
    router.replace(pathname, { locale: nextLocale });
  };

  if (variant === "links") {
    return (
      <div className="flex items-center gap-3 text-xs text-muted" aria-label="Languages">
        {LOCALES.map((loc, idx) => (
          <React.Fragment key={loc.code}>
            <button
              type="button"
              onClick={() => handleSelect(loc.code)}
              className={`hover:text-ink transition-colors ${
                loc.code === currentLocale ? "font-semibold text-ink underline underline-offset-4" : ""
              }`}
            >
              {loc.label}
            </button>
            {idx < LOCALES.length - 1 && <span aria-hidden="true">•</span>}
          </React.Fragment>
        ))}
      </div>
    );
  }

  const currentLabel = LOCALES.find((l) => l.code === currentLocale)?.label || "Language";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted hover:text-ink gap-1.5 focus-visible:ring-1"
          aria-label="Change language"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        {LOCALES.map((loc) => (
          <DropdownMenuItem
            key={loc.code}
            onClick={() => handleSelect(loc.code)}
            className={`text-xs cursor-pointer ${
              loc.code === currentLocale ? "font-semibold text-accent bg-paper-alt" : ""
            }`}
          >
            {loc.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
