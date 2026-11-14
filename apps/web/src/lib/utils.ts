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
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
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
