import React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { FaqAccordion } from "@/components/shared/FaqAccordion";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { CheckCircle2, ShieldCheck, HelpCircle, ArrowRight, FileCheck, Mail } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function ForAuthorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "forAuthors" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

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

  const checklist = [
    t("checkItem1"),
    t("checkItem2"),
    t("checkItem3"),
    t("checkItem4"),
  ];

  return (
    <div className="space-y-10 pb-16">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/login">
            <Button size="sm" className="shadow-warm">
              <span>{t("startSubmission")}</span>
              <ArrowRight className="h-3.5 w-3.5 ms-1.5 rtl:rotate-180" />
            </Button>
          </Link>
        }
      />

      {/* ── Desktop Two-Column Layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Main Guidance Column */}
        <div className="lg:col-span-8 space-y-12">
          {/* 1. Submission Guidelines */}
          <ScrollReveal>
            <section aria-labelledby="guidelines-heading" className="space-y-4">
              <h2
                id="guidelines-heading"
                className="text-xl sm:text-2xl font-heading font-semibold text-ink border-b border-rule pb-2.5"
              >
                {t("guidelinesHeading")}
              </h2>
              <p className="text-sm text-muted leading-relaxed font-body">
                {t("guidelinesIntro")}
              </p>
              <ul className="space-y-3 list-none p-0 text-sm text-ink/90 font-body">
                {guidelines.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </ScrollReveal>

          {/* 2. Anonymization Instructions (Double-Blind) */}
          <ScrollReveal>
            <section
              aria-labelledby="anonymization-heading"
              className="rounded-[3px] border border-rule bg-paper-alt p-6 md:p-8 space-y-4 shadow-warm"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <h2 id="anonymization-heading" className="text-lg font-heading font-semibold text-ink">
                  {t("anonymizationHeading")}
                </h2>
              </div>
              <p className="text-sm text-muted leading-relaxed font-body">
                {t("anonymizationIntro")}
              </p>
              <ul className="space-y-2.5 list-none p-0 text-xs text-ink/90 font-body">
                {anonItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-semibold text-accent">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </ScrollReveal>

          {/* 3. Review Process Stepper */}
          <ScrollReveal>
            <section aria-labelledby="review-process-heading" className="space-y-6">
              <h2
                id="review-process-heading"
                className="text-xl sm:text-2xl font-heading font-semibold text-ink border-b border-rule pb-2.5"
              >
                {t("reviewProcessHeading")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-[3px] border border-rule bg-paper space-y-2 hover:border-accent/30 transition-colors shadow-sm"
                  >
                    <span className="inline-block text-[10px] font-mono uppercase tracking-wider text-accent font-semibold px-2 py-0.5 rounded-[2px] bg-paper-alt">
                      Phase 0{idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold font-heading text-ink">
                      {st.title}
                    </h3>
                    <p className="text-xs text-muted leading-relaxed font-body">
                      {st.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </ScrollReveal>

          {/* 4. Frequently Asked Questions with Smooth Accordion */}
          <ScrollReveal>
            <section aria-labelledby="faq-heading" className="space-y-6">
              <div className="flex items-center gap-2.5 border-b border-rule pb-2.5">
                <HelpCircle className="h-5 w-5 text-accent" />
                <h2 id="faq-heading" className="text-xl sm:text-2xl font-heading font-semibold text-ink">
                  {t("faqHeading")}
                </h2>
              </div>
              <FaqAccordion items={faqs} />
            </section>
          </ScrollReveal>
        </div>

        {/* Sidebar Column: Sticky Action & Checklist */}
        <aside
          aria-label="Author tools and checklist"
          className="lg:col-span-4 space-y-6 lg:sticky lg:top-24"
        >
          {/* Quick Submit Card */}
          <div className="rounded-[3px] border border-rule border-t-2 border-t-accent bg-paper p-6 space-y-4 shadow-warm">
            <h3 className="font-heading font-semibold text-ink text-base">
              {t("startSubmission")}
            </h3>
            <p className="text-xs text-muted font-body leading-relaxed">
              {t("anonymizationIntro")}
            </p>
            <Link href="/login" className="block">
              <Button className="w-full text-xs shadow-warm">
                <span>{t("startSubmission")}</span>
                <ArrowRight className="h-3.5 w-3.5 ms-1.5 rtl:rotate-180" />
              </Button>
            </Link>
          </div>

          {/* Checklist Card */}
          <div className="rounded-[3px] border border-rule bg-paper-alt p-6 space-y-3.5">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-gold" />
              <h3 className="font-heading font-semibold text-ink text-sm">
                {t("checklistHeading")}
              </h3>
            </div>
            <ul className="space-y-2 text-xs text-ink/90 font-body list-none p-0">
              {checklist.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Editorial Support Contact */}
          <div className="rounded-[3px] border border-rule bg-paper p-5 space-y-2 text-xs font-body">
            <div className="flex items-center gap-2 text-ink font-semibold font-heading">
              <Mail className="h-4 w-4 text-muted" />
              <span>{t("quickHelpHeading")}</span>
            </div>
            <p className="text-muted leading-relaxed">
              {t("quickHelpText")}
            </p>
            <div className="pt-1">
              <Link
                href="/contact"
                className="text-accent hover:underline font-medium inline-flex items-center gap-1"
              >
                <span>{tNav("contact")}</span>
                <ArrowRight className="h-3 w-3 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
