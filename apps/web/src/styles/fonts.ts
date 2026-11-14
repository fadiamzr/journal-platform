import { Source_Serif_4, Inter, Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";

export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-serif",
});

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-amiri",
});

export const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-arabic",
});

export function getFontVariables(locale: string): string {
  if (locale === "ar") {
    // For Arabic, heading font is Amiri, UI/body font is IBM Plex Sans Arabic
    return `${amiri.variable} ${ibmPlexArabic.variable} font-ar-body`;
  }
  // For en / fr, heading is Source Serif 4, body is Inter
  return `${sourceSerif.variable} ${inter.variable} font-latin-body`;
}
