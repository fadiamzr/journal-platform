import React from "react";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { IssueCover } from "@/components/shared/IssueCover";
import { CountUp } from "@/components/shared/CountUp";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatVolumeIssue } from "@/lib/utils";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  const issues = await api.listIssues();
  const currentIssue = issues[0] || null;
  const allArticles = await api.listArticles();
  const recentArticles = allArticles.slice(0, 4);

  // Compute stats dynamically from mock data
  const institutions = new Set<string>();
  allArticles.forEach((a) => {
    a.authors.forEach((author) => {
      (author.affiliations || []).forEach((aff) => {
        institutions.add(aff.split(",")[0].trim());
      });
    });
  });
  const institutionCount = Math.max(institutions.size, 15);

  return (
    <div className="space-y-16 pb-12">
      {/* ── 1. Hero Band on Paper-Alt: Current Issue ───────────────────────── */}
      {currentIssue && (
        <section
          aria-labelledby="hero-issue-heading"
          className="-mx-4 md:-mx-6 lg:-mx-8 -mt-6 px-4 md:px-6 lg:px-8 py-10 md:py-16 bg-paper-alt border-b border-rule"
        >
          <div className="max-w-content mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
            {/* Left Column: Metadata & CTAs */}
            <div className="md:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
                {t("currentIssueHeading")}
              </div>

              <h1
                id="hero-issue-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-heading font-semibold text-ink tracking-tight leading-[1.15]"
              >
                {formatVolumeIssue(currentIssue.volume, currentIssue.number, locale)}{" "}
                <span className="font-normal text-muted">({currentIssue.year})</span>
              </h1>

              {currentIssue.title && (
                <p className="text-lg md:text-xl font-heading italic text-muted max-w-xl leading-relaxed">
                  « {currentIssue.title[locale as keyof typeof currentIssue.title] ||
                    Object.values(currentIssue.title)[0]} »
                </p>
              )}

              <p className="text-sm font-body text-muted leading-relaxed max-w-xl">
                {t("aboutSnippet")}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link href={`/issues/${currentIssue.id}`}>
                  <Button variant="default" size="default" className="text-xs sm:text-sm shadow-warm">
                    <span>{t("readIssue")}</span>
                    <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180" />
                  </Button>
                </Link>
                <Link href="/for-authors">
                  <Button variant="outline" size="default" className="text-xs sm:text-sm">
                    {tNav("submitManuscript")}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column: Generated Typographic Cover Art */}
            <div className="md:col-span-5 flex justify-center md:justify-end">
              <IssueCover issue={currentIssue} size="hero" locale={locale} />
            </div>
          </div>
        </section>
      )}

      {/* ── 2. Academic Stats Strip ────────────────────────────────────────── */}
      <ScrollReveal>
        <section
          aria-label="Journal metrics"
          className="rounded-[3px] border border-rule bg-paper p-6 sm:p-8 shadow-warm"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-rule">
            <div className="text-center pt-4 sm:pt-0">
              <div className="text-3xl md:text-4xl font-heading font-semibold text-ink">
                <CountUp end={allArticles.length || 12} locale={locale} />
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted mt-1.5 font-medium">
                {t("statsArticles")}
              </div>
            </div>

            <div className="text-center pt-4 sm:pt-0">
              <div className="text-3xl md:text-4xl font-heading font-semibold text-ink">
                <CountUp end={issues.length || 3} locale={locale} />
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted mt-1.5 font-medium">
                {t("statsIssues")}
              </div>
            </div>

            <div className="text-center pt-4 sm:pt-0">
              <div className="text-3xl md:text-4xl font-heading font-semibold text-ink">
                <CountUp end={3} locale={locale} />
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted mt-1.5 font-medium">
                {t("statsLanguages")}
              </div>
            </div>

            <div className="text-center pt-4 sm:pt-0">
              <div className="text-3xl md:text-4xl font-heading font-semibold text-ink">
                <CountUp end={institutionCount} locale={locale} />
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted mt-1.5 font-medium">
                {t("statsInstitutions")}
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 3. Latest Articles (Responsive Card Grid) ──────────────────────── */}
      <ScrollReveal>
        <section aria-labelledby="recent-articles-heading" className="space-y-6">
          <div className="flex items-baseline justify-between border-b border-rule pb-3">
            <div>
              <h2
                id="recent-articles-heading"
                className="text-xl sm:text-2xl font-heading font-semibold text-ink tracking-tight"
              >
                {t("recentArticlesHeading")}
              </h2>
            </div>
            <Link
              href="/issues"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline shrink-0"
            >
              <span>{t("viewArchive")}</span>
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentArticles.map((article) => (
              <ArticleCard key={article.id} article={article} showAbstract={true} />
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ── 4. How It Works for Authors ────────────────────────────────────── */}
      <ScrollReveal>
        <section
          aria-labelledby="how-it-works-heading"
          className="rounded-[3px] border border-rule bg-paper p-8 sm:p-10 shadow-warm space-y-8"
        >
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2
              id="how-it-works-heading"
              className="text-2xl sm:text-3xl font-heading font-semibold text-ink tracking-tight"
            >
              {t("howItWorksHeading")}
            </h2>
            <p className="text-sm font-body text-muted leading-relaxed">
              {t("howItWorksSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center space-y-3 p-4 rounded-[2px] bg-paper-alt/50 border border-rule/60">
              <div className="h-12 w-12 rounded-full border border-accent/30 bg-accent/10 flex items-center justify-center text-accent">
                <FileText className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <h3 className="font-heading font-semibold text-ink text-base">
                {t("step1Title")}
              </h3>
              <p className="text-xs font-body text-muted leading-relaxed">
                {t("step1Desc")}
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center space-y-3 p-4 rounded-[2px] bg-paper-alt/50 border border-rule/60">
              <div className="h-12 w-12 rounded-full border border-gold/40 bg-gold/10 flex items-center justify-center text-gold">
                <Sparkles className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <h3 className="font-heading font-semibold text-ink text-base">
                {t("step2Title")}
              </h3>
              <p className="text-xs font-body text-muted leading-relaxed">
                {t("step2Desc")}
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center space-y-3 p-4 rounded-[2px] bg-paper-alt/50 border border-rule/60">
              <div className="h-12 w-12 rounded-full border border-accent/30 bg-accent/10 flex items-center justify-center text-accent">
                <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <h3 className="font-heading font-semibold text-ink text-base">
                {t("step3Title")}
              </h3>
              <p className="text-xs font-body text-muted leading-relaxed">
                {t("step3Desc")}
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 5. Callout: Submissions & Peer Review ──────────────────────────── */}
      <ScrollReveal>
        <section
          aria-labelledby="submit-cta-heading"
          className="rounded-[3px] border border-rule p-8 md:p-10 bg-paper-alt flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="space-y-2 max-w-xl">
            <h2 id="submit-cta-heading" className="text-xl md:text-2xl font-heading font-semibold text-ink">
              {t("submitHeading")}
            </h2>
            <p className="text-sm text-muted leading-relaxed font-body">
              {t("submitSnippet")}
            </p>
          </div>
          <div className="shrink-0">
            <Link href="/for-authors">
              <Button variant="default" size="default" className="text-xs shadow-warm">
                <BookOpen className="h-3.5 w-3.5 me-2" strokeWidth={1.5} />
                {t("submitAction")}
              </Button>
            </Link>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
