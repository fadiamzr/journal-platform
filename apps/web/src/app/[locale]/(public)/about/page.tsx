import React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { brand } from "@/config/brand";
import { BookOpen, ShieldCheck, Globe, Archive } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScrollReveal } from "@/components/shared/ScrollReveal";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "about" });
  const aims =
    brand.aimsAndScope[locale as keyof typeof brand.aimsAndScope] ||
    brand.aimsAndScope.en;

  return (
    <div className="space-y-12 max-w-reading mx-auto pb-16">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* ── 1. Aims & Scope ─────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section aria-labelledby="aims-heading" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rule pb-2">
            <BookOpen className="h-5 w-5 text-accent" />
            <h2 id="aims-heading" className="text-xl font-heading font-semibold text-ink">
              {t("aimsHeading")}
            </h2>
          </div>
          <div className="space-y-3 font-body text-sm text-ink/90 leading-relaxed">
            {aims.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ── 2. Rigorous Double-Blind Peer Review ────────────────────────────── */}
      <ScrollReveal>
        <section aria-labelledby="peer-review-heading" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rule pb-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h2 id="peer-review-heading" className="text-xl font-heading font-semibold text-ink">
              {t("peerReviewHeading")}
            </h2>
          </div>
          <p className="font-body text-sm text-ink/90 leading-relaxed">
            {t("peerReviewBody")}
          </p>
          <div className="rounded-[3px] border border-rule bg-paper-alt p-5 text-xs text-muted font-body leading-relaxed space-y-2 shadow-sm">
            <p>{t("peerReviewNote")}</p>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 3. Open Access Policy ───────────────────────────────────────────── */}
      <ScrollReveal>
        <section aria-labelledby="open-access-heading" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rule pb-2">
            <Globe className="h-5 w-5 text-accent" />
            <h2 id="open-access-heading" className="text-xl font-heading font-semibold text-ink">
              {t("openAccessHeading")}
            </h2>
          </div>
          <p className="font-body text-sm text-ink/90 leading-relaxed">
            {t("openAccessBody")}
          </p>
          <div className="rounded-[3px] border border-rule bg-paper-alt p-5 text-xs text-muted font-body leading-relaxed space-y-2 shadow-sm">
            <p>{t("openAccessNote")}</p>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 4. Publisher, ISSN & Digital Archiving ───────────────────────────── */}
      <ScrollReveal>
        <section aria-labelledby="publishing-heading" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rule pb-2">
            <Archive className="h-5 w-5 text-accent" />
            <h2 id="publishing-heading" className="text-xl font-heading font-semibold text-ink">
              {t("publishingHeading")}
            </h2>
          </div>
          <p className="font-body text-sm text-ink/90 leading-relaxed">
            {t("publishingBody")}
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-[3px] border border-rule p-4 bg-paper font-body text-xs shadow-warm">
            <div>
              <dt className="text-muted uppercase tracking-wider text-[11px] font-mono">{t("publisher")}</dt>
              <dd className="font-medium text-ink mt-0.5">{brand.publisher.name}</dd>
            </div>
            <div>
              <dt className="text-muted uppercase tracking-wider text-[11px] font-mono">{t("location")}</dt>
              <dd className="font-medium text-ink mt-0.5">{brand.publisher.location}</dd>
            </div>
            <div>
              <dt className="text-muted uppercase tracking-wider text-[11px] font-mono">{t("printIssn")}</dt>
              <dd className="font-mono text-ink mt-0.5">{brand.issn.print}</dd>
            </div>
            <div>
              <dt className="text-muted uppercase tracking-wider text-[11px] font-mono">{t("onlineIssn")}</dt>
              <dd className="font-mono text-ink mt-0.5">{brand.issn.online}</dd>
            </div>
          </dl>
        </section>
      </ScrollReveal>
    </div>
  );
}
