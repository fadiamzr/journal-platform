import React from "react";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { IssueCover } from "@/components/shared/IssueCover";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { formatLocalizedDate, formatVolumeIssue } from "@/lib/utils";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen } from "lucide-react";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "issue" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  const issue = await api.getIssue(id);
  if (!issue) {
    notFound();
  }

  const issueTitle =
    (issue.title &&
      (issue.title[locale as keyof typeof issue.title] ||
        Object.values(issue.title)[0])) ||
    "";

  const volIssue = formatVolumeIssue(issue.volume, issue.number, locale);

  const breadcrumbs = [
    { label: tNav("home"), href: "/" },
    { label: tNav("archive"), href: "/issues" },
    {
      label: `${volIssue} (${issue.year})`,
    },
  ];

  return (
    <div className="space-y-10 pb-12">
      <Breadcrumbs items={breadcrumbs} />

      {/* Hero Issue Header with Cover Art */}
      <section
        aria-labelledby="issue-title-heading"
        className="rounded-[3px] border border-rule bg-paper-alt p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start justify-between"
      >
        <div className="space-y-3 flex-1 text-start">
          <div className="inline-block px-2.5 py-0.5 rounded-[2px] border border-accent/20 bg-paper text-accent font-mono text-xs font-medium">
            {volIssue} ({issue.year})
          </div>

          <h1
            id="issue-title-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-heading font-semibold text-ink tracking-tight"
          >
            {issueTitle ||
              t("volumeIssue", {
                volume: issue.volume,
                number: issue.number,
                year: issue.year,
              })}
          </h1>

          {issue.publishedAt && (
            <p className="text-xs sm:text-sm text-muted font-body">
              {t("publishedOn", {
                date: formatLocalizedDate(issue.publishedAt, locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
              })}
            </p>
          )}

          <div className="pt-2 text-xs text-muted flex items-center gap-1.5 font-body">
            <BookOpen className="h-4 w-4 text-accent" />
            <span>{t("articlesCount", { count: issue.articles?.length || 0 })}</span>
          </div>
        </div>

        <div className="shrink-0">
          <IssueCover issue={issue} size="banner" locale={locale} />
        </div>
      </section>

      {/* Table of Contents */}
      <ScrollReveal>
        <section aria-labelledby="toc-heading" className="space-y-6">
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <h2
              id="toc-heading"
              className="text-lg sm:text-xl font-heading font-semibold text-ink flex items-center gap-2"
            >
              <span>{t("tableOfContents")}</span>
            </h2>
            <span className="text-xs font-mono text-muted">
              {t("articlesCount", { count: issue.articles?.length || 0 })}
            </span>
          </div>

          {issue.articles && issue.articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {issue.articles.map((article) => (
                <ArticleCard key={article.id} article={article} showAbstract={true} />
              ))}
            </div>
          ) : (
            <EmptyState description={t("emptyIssue")} />
          )}
        </section>
      </ScrollReveal>
    </div>
  );
}
