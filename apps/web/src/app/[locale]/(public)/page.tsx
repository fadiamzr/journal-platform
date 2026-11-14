import React from "react";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { brand } from "@/config/brand";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });

  const issues = await api.listIssues();
  const currentIssue = issues[0] || null;
  const currentArticles = currentIssue ? await api.listArticles({ issueId: currentIssue.id }) : [];
  const allArticles = await api.listArticles();
  const recentArticles = allArticles.slice(0, 4);

  return (
    <div className="space-y-16">
      {/* ── 1. Featured Current Issue Section ─────────────────────────────────── */}
      {currentIssue && (
        <section aria-labelledby="current-issue-heading" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-baseline justify-between border-b border-rule pb-4 gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("currentIssueHeading")}
              </span>
              <h2
                id="current-issue-heading"
                className="text-2xl md:text-3xl font-heading font-semibold text-ink mt-1 tracking-tight"
              >
                {t("currentIssueSubtitle", {
                  volume: currentIssue.volume,
                  number: currentIssue.number,
                  year: currentIssue.year,
                })}
              </h2>
              {currentIssue.title && (
                <p className="text-sm font-heading italic text-muted mt-1">
                  {currentIssue.title[locale as keyof typeof currentIssue.title] ||
                    Object.values(currentIssue.title)[0]}
                </p>
              )}
            </div>

            <Link
              href={`/issues/${currentIssue.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline shrink-0"
            >
              <span>{t("browseArticles")}</span>
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>

          <div className="divide-y divide-rule">
            {currentArticles.map((article) => (
              <ArticleCard key={article.id} article={article} showAbstract={true} />
            ))}
          </div>
        </section>
      )}

      {/* ── 2. About the Journal Band (paper-alt warm band) ───────────────────── */}
      <section
        aria-labelledby="about-band-heading"
        className="-mx-4 md:-mx-6 px-4 md:px-6 py-10 bg-paper-alt border-y border-rule"
      >
        <div className="max-w-content mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("aboutHeading")}
            </span>
            <h3 id="about-band-heading" className="text-xl font-heading font-semibold text-ink">
              {brand.name}
            </h3>
            <p className="text-[15px] text-muted leading-relaxed font-body">
              {t("aboutSnippet")}
            </p>
            <div className="pt-2">
              <Link
                href="/about"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <span>{t("readMore")}</span>
                <ArrowRight className="h-3 w-3 rtl:rotate-180" />
              </Link>
            </div>
          </div>

          <div className="border-s border-rule/70 ps-6 space-y-4">
            <div>
              <div className="text-xs text-muted uppercase tracking-wider font-semibold">
                Publisher
              </div>
              <div className="text-sm font-medium text-ink mt-0.5">
                {brand.publisher.name}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider font-semibold">
                Frequency
              </div>
              <div className="text-sm font-medium text-ink mt-0.5">
                Biannual (April & October)
              </div>
            </div>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider font-semibold">
                Review Policy
              </div>
              <div className="text-sm font-medium text-ink mt-0.5">
                Double-Blind Peer Review
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Call to Action: Submit a Manuscript ────────────────────────────── */}
      <section
        aria-labelledby="submit-cta-heading"
        className="rounded-[3px] border border-rule p-8 md:p-10 bg-paper flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="space-y-2 max-w-xl">
          <h2 id="submit-cta-heading" className="text-xl md:text-2xl font-heading font-semibold text-ink">
            {t("submitHeading")}
          </h2>
          <p className="text-sm text-muted leading-relaxed font-body">
            {t("submitSnippet")}
          </p>
        </div>
        <div className="shrink-0 flex flex-col sm:flex-row gap-3">
          <Link href="/for-authors">
            <Button variant="default" size="default" className="text-xs">
              <BookOpen className="h-3.5 w-3.5 me-2" />
              {t("submitAction")}
            </Button>
          </Link>
        </div>
      </section>

      {/* ── 4. Recent Publications ────────────────────────────────────────────── */}
      <section aria-labelledby="recent-articles-heading" className="space-y-6">
        <div className="flex items-baseline justify-between border-b border-rule pb-3">
          <h2
            id="recent-articles-heading"
            className="text-xl font-heading font-semibold text-ink"
          >
            {t("recentArticlesHeading")}
          </h2>
          <Link
            href="/issues"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <span>{t("viewArchive")}</span>
            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>

        <div className="divide-y divide-rule">
          {recentArticles.map((article) => (
            <ArticleCard key={article.id} article={article} showAbstract={false} />
          ))}
        </div>
      </section>
    </div>
  );
}
