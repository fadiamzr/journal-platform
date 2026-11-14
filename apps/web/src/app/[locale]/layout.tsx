import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { getFontVariables } from "@/styles/fonts";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/lib/auth/session-context";
import { brand } from "@/config/brand";
import "@/styles/globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === "ar";
  const isFr = locale === "fr";

  const title = isAr
    ? `${brand.name} | ${brand.tagline.ar}`
    : isFr
    ? `${brand.name} | ${brand.tagline.fr}`
    : `${brand.name} | ${brand.tagline.en}`;

  const description = isAr
    ? brand.description.ar
    : isFr
    ? brand.description.fr
    : brand.description.en;

  return {
    title: {
      default: title,
      template: `%s | ${brand.name}`,
    },
    description,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontClasses = getFontVariables(locale);

  return (
    <html lang={locale} dir={dir} className={fontClasses}>
      <body className="min-h-screen bg-paper text-ink flex flex-col font-body selection:bg-accent-bg selection:text-accent">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SessionProvider>
            {children}
            <Toaster position="bottom-right" />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
