import React from "react";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatLocalizedDate } from "@/lib/utils";
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
    issue.title?.[locale as keyof typeof issue.title] ||
    (issue.title ? Object.values(issue.title)[0] : "");

  const breadcrumbs = [
    { label: tNav("home"), href: "/" },
    { label: tNav("archive"), href: "/issues" },
    {
      label: `Vol. ${issue.volume}, No. ${issue.number} (${issue.year})`,
    },
  ];

  return (
    <div className="space-y-8">
      <Breadcrumbs items={breadcrumbs} />

      <PageHeader
        title={
          issueTitle ||
          t("volumeIssue", {
            volume: issue.volume,
            number: issue.number,
            year: issue.year,
          })
        }
        subtitle={
          issue.publishedAt
            ? t("publishedOn", {
                date: formatLocalizedDate(issue.publishedAt, locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
              })
            : undefined
        }
      />

      <section aria-labelledby="toc-heading" className="space-y-6">
        <div className="flex items-center justify-between border-b border-rule pb-2">
          <h2
            id="toc-heading"
            className="text-base font-semibold font-body text-ink uppercase tracking-wider flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4 text-muted" />
            <span>{t("tableOfContents")}</span>
          </h2>
          <span className="text-xs text-muted">
            {t("articlesCount", { count: issue.articles?.length || 0 })}
          </span>
        </div>

        {issue.articles && issue.articles.length > 0 ? (
          <div className="divide-y divide-rule">
            {issue.articles.map((article) => (
              <ArticleCard key={article.id} article={article} showAbstract={true} />
            ))}
          </div>
        ) : (
          <EmptyState description={t("emptyIssue")} />
        )}
      </section>
    </div>
  );
}
