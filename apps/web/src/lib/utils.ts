import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format date in localized format with ASCII / Latin digits (0-9) even for Arabic.
 */
export function formatLocalizedDate(
  dateInput: string | number | Date,
  locale: string = "en",
  options?: Intl.DateTimeFormatOptions
): string {
  const d =
    typeof dateInput === "string" || typeof dateInput === "number"
      ? new Date(dateInput)
      : dateInput;
  if (isNaN(d.getTime())) return "";

  const defaultOptions: Intl.DateTimeFormatOptions = options || {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  // Ensure Latin numbering system 'latn' so Arabic numerals are 0-9
  const intlLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(d);
}

/**
 * Format numbers with Latin digits in all locales.
 */
export function formatLocalizedNumber(
  num: number,
  locale: string = "en",
  options?: Intl.NumberFormatOptions
): string {
  const intlLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  return new Intl.NumberFormat(intlLocale, options).format(num);
}

/**
 * Localized Volume and Issue formatter (e.g., "Vol. 2, No. 1", "Vol. 2, n° 1", "المجلد 2، العدد 1")
 */
export function formatVolumeIssue(
  volume: number | string,
  number: number | string,
  locale: string = "en"
): string {
  if (locale === "fr") {
    return `Vol. ${volume}, n° ${number}`;
  }
  if (locale === "ar") {
    return `المجلد ${volume}، العدد ${number}`;
  }
  return `Vol. ${volume}, No. ${number}`;
}

/**
 * Strips academic honorifics (Dr., Prof., etc.) from author bylines.
 */
export function cleanAuthorName(name: string): string {
  if (!name) return "";
  return name
    .replace(/^(Dr\.|Prof\.|Doctor|Professor|Dra\.|Pr\.)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const stripHonorifics = cleanAuthorName;

/**
 * Formats a list of authors with correct typographic punctuation and localized conjunctions:
 * - EN: "Alice Smith and Bob Jones" / "Alice Smith, Bob Jones, and Charlie Brown"
 * - FR: "Alice Smith et Bob Jones" / "Alice Smith, Bob Jones et Charlie Brown"
 * - AR: "Alice Smith وBob Jones" / "Alice Smith، Bob Jones وCharlie Brown"
 */
export function formatAuthorList(
  authors: Array<{ fullName: string }>,
  locale: string = "en"
): string {
  if (!authors || authors.length === 0) return "";
  const names = authors.map((a) => cleanAuthorName(a.fullName));

  if (names.length === 1) return names[0];

  if (names.length === 2) {
    if (locale === "fr") return `${names[0]} et ${names[1]}`;
    if (locale === "ar") return `${names[0]} و${names[1]}`;
    return `${names[0]} and ${names[1]}`;
  }

  // 3 or more authors
  if (locale === "fr") {
    const head = names.slice(0, -1).join(", ");
    return `${head} et ${names[names.length - 1]}`;
  }

  if (locale === "ar") {
    const head = names.slice(0, -1).join("، ");
    return `${head} و${names[names.length - 1]}`;
  }

  // English with Oxford comma
  const head = names.slice(0, -1).join(", ");
  return `${head}, and ${names[names.length - 1]}`;
}
