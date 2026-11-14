import React from "react";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatLocalizedDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookOpen, ArrowRight } from "lucide-react";
import type { Issue } from "@/lib/domain/types";

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "archive" });
  const issues = await api.listIssues();

  // Group issues by year
  const issuesByYear: Record<number, Issue[]> = {};
  for (const issue of issues) {
    if (!issuesByYear[issue.year]) {
      issuesByYear[issue.year] = [];
    }
    issuesByYear[issue.year].push(issue);
  }

  const sortedYears = Object.keys(issuesByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-12">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {sortedYears.length === 0 ? (
        <EmptyState description={t("emptyState")} />
      ) : (
        <div className="space-y-12">
          {sortedYears.map((year) => {
            const yearIssues = issuesByYear[year];
            return (
              <section key={year} aria-labelledby={`year-${year}`}>
                <h2
                  id={`year-${year}`}
                  className="text-xl font-heading font-semibold text-ink border-b border-rule pb-2 mb-6"
                >
                  {t("yearHeading", { year })}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {yearIssues.map((issue) => {
                    const issueTitle =
                      issue.title?.[locale as keyof typeof issue.title] ||
                      (issue.title ? Object.values(issue.title)[0] : "");

                    return (
                      <div
                        key={issue.id}
                        className="rounded-[3px] border border-rule p-6 bg-paper hover:border-muted/50 transition-colors flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <span className="text-xs font-mono text-muted uppercase tracking-wider">
                            {t("volumeIssue", {
                              volume: issue.volume,
                              number: issue.number,
                            })}
                          </span>

                          <h3 className="text-lg font-heading font-semibold text-ink">
                            <Link
                              href={`/issues/${issue.id}`}
                              className="hover:text-accent hover:underline"
                            >
                              {issueTitle ||
                                t("volumeIssue", {
                                  volume: issue.volume,
                                  number: issue.number,
                                })}
                            </Link>
                          </h3>

                          {issue.publishedAt && (
                            <p className="text-xs text-muted">
                              {t("publishedDate", {
                                date: formatLocalizedDate(issue.publishedAt, locale, {
                                  year: "numeric",
                                  month: "long",
                                }),
                              })}
                            </p>
                          )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-rule/50 flex items-center justify-between text-xs">
                          <span className="text-muted flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>
                              {t("articlesCount", { count: issue.articles?.length || 4 })}
                            </span>
                          </span>

                          <Link
                            href={`/issues/${issue.id}`}
                            className="font-medium text-accent hover:underline inline-flex items-center gap-1"
                          >
                            <span>Table of Contents</span>
                            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
