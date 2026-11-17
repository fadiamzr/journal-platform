"use client";

import React, { useEffect, useState } from "react";
import { Palette, Check, ChevronUp } from "lucide-react";

export type ThemePreset = "press" | "atlas" | "ink";

interface PresetOption {
  id: ThemePreset;
  name: string;
  description: string;
  accent: string;
  paper: string;
  gold: string;
}

const PRESETS: PresetOption[] = [
  {
    id: "press",
    name: "Press (Default)",
    description: "Burgundy & Warm Parchment",
    accent: "#7A1F2B",
    paper: "#FBF8F1",
    gold: "#B08D3C",
  },
  {
    id: "atlas",
    name: "Atlas",
    description: "Deep Teal & Stone Paper",
    accent: "#0F4C4A",
    paper: "#FAF8F3",
    gold: "#B8893A",
  },
  {
    id: "ink",
    name: "Ink",
    description: "Academic Navy & Crisp White",
    accent: "#1B2A4A",
    paper: "#FFFFFF",
    gold: "#9C7A28",
  },
];

export function ThemeSwitcher() {
  const [current, setCurrent] = useState<ThemePreset>("press");
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("journal_theme_preset") as ThemePreset | null;
    if (saved && (saved === "press" || saved === "atlas" || saved === "ink")) {
      setCurrent(saved);
      document.documentElement.dataset.theme = saved;
    } else {
      document.documentElement.dataset.theme = "press";
    }
  }, []);

  const selectPreset = (preset: ThemePreset) => {
    setCurrent(preset);
    document.documentElement.dataset.theme = preset;
    try {
      localStorage.setItem("journal_theme_preset", preset);
    } catch {
      // Storage unavailable
    }
  };

  // Only show in mock preview mode
  const isMock = process.env.NEXT_PUBLIC_API_MODE === "mock" || !process.env.NEXT_PUBLIC_API_MODE;
  if (!isMock || !mounted) return null;

  return (
    <aside
      aria-label="Theme preset switcher"
      className="fixed bottom-4 start-4 z-50 no-print font-body"
    >
      <div className="relative">
        {isOpen && (
          <div
            role="dialog"
            aria-label="Select theme preset"
            className="absolute bottom-full start-0 mb-2 w-72 rounded-[3px] border border-rule bg-paper p-3 shadow-warm space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Theme Presets
              </span>
              <span className="text-[10px] text-muted font-mono">Preview Only</span>
            </div>

            <div className="space-y-1.5">
              {PRESETS.map((preset) => {
                const isActive = current === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      selectPreset(preset.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-start flex items-center justify-between p-2 rounded-[3px] border transition-colors text-xs ${
                      isActive
                        ? "border-accent bg-paper-alt"
                        : "border-transparent hover:border-rule hover:bg-paper-alt"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Swatch */}
                      <span
                        className="h-4 w-4 rounded-full border border-black/10 shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: preset.paper }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </span>
                      <div>
                        <div className="font-medium text-ink flex items-center gap-1.5">
                          <span>{preset.name}</span>
                          {preset.id === "press" && (
                            <span className="text-[10px] text-accent font-mono uppercase">
                              (Default)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted">
                          {preset.description}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-muted pt-1 border-t border-rule leading-relaxed">
              Persisted in localStorage. See docs/FRONTEND.md to make a preset permanent.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[3px] border border-rule bg-paper hover:bg-paper-alt shadow-warm text-xs text-ink transition-colors"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Palette className="h-3.5 w-3.5 text-accent" />
          <span className="font-medium capitalize">Theme: {current}</span>
          <ChevronUp
            className={`h-3 w-3 text-muted transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </aside>
  );
}
