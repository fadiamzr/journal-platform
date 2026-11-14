import React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { brand } from "@/config/brand";
import { CheckCircle2, Eye, Keyboard, Contrast, MoveHorizontal, Mail } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "accessibility" });

  const features = [
    { text: t("feature1"), icon: Keyboard },
    { text: t("feature2"), icon: Contrast },
    { text: t("feature3"), icon: MoveHorizontal },
    { text: t("feature4"), icon: Eye },
  ];

  return (
    <div className="space-y-12 max-w-reading mx-auto">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* ── 1. Statement ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <p className="font-body text-base text-ink leading-relaxed">
          {t("body1")}
        </p>
        <p className="font-body text-sm text-muted leading-relaxed">
          We believe scholarly literature should be accessible to all researchers, practitioners,
          and students. This platform is designed and continuously tested according to the World
          Wide Web Consortium (W3C) Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.
        </p>
      </section>

      {/* ── 2. Key Features ─────────────────────────────────────────────────── */}
      <section aria-labelledby="features-heading" className="space-y-4">
        <h2 id="features-heading" className="text-xl font-heading font-semibold text-ink border-b border-rule pb-2">
          {t("featuresHeading")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-[3px] border border-rule bg-paper p-4 space-y-2"
              >
                <div className="flex items-center gap-2 text-accent">
                  <Icon className="h-4 w-4" />
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent ms-auto" />
                </div>
                <p className="text-xs font-body text-ink/90 leading-relaxed">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 3. Feedback & Contact ───────────────────────────────────────────── */}
      <section aria-labelledby="feedback-heading" className="space-y-4">
        <h2 id="feedback-heading" className="text-xl font-heading font-semibold text-ink border-b border-rule pb-2">
          {t("feedbackHeading")}
        </h2>
        <div className="rounded-[3px] border border-rule bg-paper-alt p-6 space-y-3 font-body text-sm">
          <p className="text-muted leading-relaxed">{t("feedbackBody")}</p>
          <div className="pt-2 flex items-center gap-2 text-xs font-medium text-ink">
            <Mail className="h-4 w-4 text-accent shrink-0" />
            <span>Editorial support:</span>
            <a
              href={`mailto:${brand.contact.email}`}
              className="text-accent underline hover:text-ink font-mono"
            >
              {brand.contact.email}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
