import { describe, it, expect } from "vitest";

// WCAG 2.1 relative luminance calculation
function sRGBtoLin(colorChannel: number): number {
  const c = colorChannel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export const THEME_PRESETS = {
  press: {
    name: "Press (Default)",
    paper: "#FBF8F1",
    paperAlt: "#F3EDE0",
    ink: "#1F1B16",
    muted: "#6B6256",
    rule: "#DDD3C0",
    accent: "#7A1F2B",
    accentHover: "#5E1722",
    gold: "#B08D3C",
    success: "#2F5D3A",
    warning: "#8A5A00",
    danger: "#8B1E2D",
    white: "#FFFFFF",
  },
  atlas: {
    name: "Atlas",
    paper: "#FAF8F3",
    paperAlt: "#EFEDE4",
    ink: "#17211F",
    muted: "#5B6661",
    rule: "#D8D6CA",
    accent: "#0F4C4A",
    accentHover: "#0A3836",
    gold: "#B8893A",
    success: "#2F5D3A",
    warning: "#8A5A00",
    danger: "#8B1E2D",
    white: "#FFFFFF",
  },
  ink: {
    name: "Ink",
    paper: "#FFFFFF",
    paperAlt: "#F7F6F2",
    ink: "#111111",
    muted: "#5B5B57",
    rule: "#D9D7D0",
    accent: "#1B2A4A",
    accentHover: "#121C33",
    gold: "#9C7A28",
    success: "#2F5D3A",
    warning: "#8A5A00",
    danger: "#8B1E2D",
    white: "#FFFFFF",
  },
};

describe("Theme Presets WCAG AA Contrast Ratios", () => {
  for (const [, preset] of Object.entries(THEME_PRESETS)) {
    describe(`Preset: ${preset.name}`, () => {
      it("ink on paper exceeds 4.5:1 (WCAG AA text)", () => {
        const ratio = getContrastRatio(preset.ink, preset.paper);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("ink on paper-alt exceeds 4.5:1 (WCAG AA text)", () => {
        const ratio = getContrastRatio(preset.ink, preset.paperAlt);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("muted on paper exceeds 4.5:1 (WCAG AA text)", () => {
        const ratio = getContrastRatio(preset.muted, preset.paper);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("muted on paper-alt exceeds 4.5:1 (WCAG AA text)", () => {
        const ratio = getContrastRatio(preset.muted, preset.paperAlt);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("accent on paper exceeds 4.5:1 (WCAG AA links/headings)", () => {
        const ratio = getContrastRatio(preset.accent, preset.paper);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("white on accent exceeds 4.5:1 (WCAG AA primary button text)", () => {
        const ratio = getContrastRatio(preset.white, preset.accent);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("white on accentHover exceeds 4.5:1 (WCAG AA button hover)", () => {
        const ratio = getContrastRatio(preset.white, preset.accentHover);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});
