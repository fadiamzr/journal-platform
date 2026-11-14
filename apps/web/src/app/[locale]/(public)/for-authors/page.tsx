import React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, HelpCircle, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function ForAuthorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "forAuthors" });

  const guidelines = [t("guideline1"), t("guideline2"), t("guideline3"), t("guideline4")];

  const anonItems = [t("anonItem1"), t("anonItem2"), t("anonItem3")];

  const steps = [
    { title: t("step1Title"), desc: t("step1Desc") },
    { title: t("step2Title"), desc: t("step2Desc") },
    { title: t("step3Title"), desc: t("step3Desc") },
    { title: t("step4Title"), desc: t("step4Desc") },
  ];

  const faqs = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
  ];

  return (
    <div className="space-y-12 max-w-reading mx-auto">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/login">
            <Button size="sm">
              <span>{t("startSubmission")}</span>
              <ArrowRight className="h-3.5 w-3.5 ms-1.5 rtl:rotate-180" />
            </Button>
          </Link>
        }
      />

      {/* ── 1. Submission Guidelines ────────────────────────────────────────── */}
      <section aria-labelledby="guidelines-heading" className="space-y-4">
        <h2 id="guidelines-heading" className="text-xl font-heading font-semibold text-ink border-b border-rule pb-2">
          {t("guidelinesHeading")}
        </h2>
        <p className="text-sm text-muted leading-relaxed font-body">
          {t("guidelinesIntro")}
        </p>
        <ul className="space-y-2.5 list-none p-0 text-sm text-ink/90 font-body">
          {guidelines.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 2. Anonymization Instructions (Double-Blind) ─────────────────────── */}
      <section
        aria-labelledby="anonymization-heading"
        className="rounded-[3px] border border-rule bg-paper-alt p-6 md:p-8 space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h2 id="anonymization-heading" className="text-lg font-heading font-semibold text-ink">
            {t("anonymizationHeading")}
          </h2>
        </div>
        <p className="text-sm text-muted leading-relaxed font-body">
          {t("anonymizationIntro")}
        </p>
        <ul className="space-y-2 list-none p-0 text-xs text-ink/90 font-body">
          {anonItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="font-semibold text-accent">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 3. Review Process Stepper / List ─────────────────────────────────── */}
      <section aria-labelledby="review-process-heading" className="space-y-6">
        <h2 id="review-process-heading" className="text-xl font-heading font-semibold text-ink border-b border-rule pb-2">
          {t("reviewProcessHeading")}
        </h2>
        <div className="space-y-4">
          {steps.map((st, idx) => (
            <div key={idx} className="p-4 rounded-[3px] border border-rule bg-paper space-y-1">
              <h3 className="text-sm font-semibold font-body text-ink">
                {st.title}
              </h3>
              <p className="text-xs text-muted leading-relaxed font-body">
                {st.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Frequently Asked Questions (FAQ) ──────────────────────────────── */}
      <section aria-labelledby="faq-heading" className="space-y-6">
        <div className="flex items-center gap-2 border-b border-rule pb-2">
          <HelpCircle className="h-4 w-4 text-muted" />
          <h2 id="faq-heading" className="text-xl font-heading font-semibold text-ink">
            {t("faqHeading")}
          </h2>
        </div>
        <div className="divide-y divide-rule">
          {faqs.map((f, i) => (
            <div key={i} className="py-4 space-y-1.5">
              <h3 className="text-sm font-medium text-ink font-body">
                {f.q}
              </h3>
              <p className="text-xs text-muted leading-relaxed font-body">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="pt-6 border-t border-rule text-center">
        <Link href="/login">
          <Button size="default" className="text-sm px-6">
            {t("startSubmission")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
