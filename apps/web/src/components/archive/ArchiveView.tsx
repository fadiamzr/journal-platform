"use client";

import React, { useState } from "react";
import type { Issue } from "@/lib/domain/types";
import { Link } from "@/i18n/routing";
import { IssueCover } from "@/components/shared/IssueCover";
import { formatLocalizedDate, formatVolumeIssue } from "@/lib/utils";
import { BookOpen, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface ArchiveViewProps {
  issues: Issue[];
  locale: string;
}

export function ArchiveView({ issues, locale }: ArchiveViewProps) {
  const t = useTranslations("archive");
  const tCommon = useTranslations("common");

  // Group issues by year
  const issuesByYear: Record<number, Issue[]> = {};
  for (const issue of issues) {
    if (!issuesByYear[issue.year]) {
      issuesByYear[issue.year] = [];
    }
    issuesByYear[issue.year].push(issue);
  }

  const years = Object.keys(issuesByYear)
    .map(Number)
    .sort((a, b) => b - a);

  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  const displayedYears =
    selectedYear === "all" ? years : years.filter((y) => y === selectedYear);

  return (
    <div className="space-y-8">
      {/* Year Filter Buttons */}
      {years.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-rule">
          <button
            type="button"
            onClick={() => setSelectedYear("all")}
            className={`px-3 py-1.5 rounded-[3px] text-xs font-medium transition-all ${
              selectedYear === "all"
                ? "bg-accent text-white shadow-warm"
                : "border border-rule bg-paper text-ink hover:border-accent hover:text-accent hover:bg-paper-alt"
            }`}
          >
            {tCommon("all")}
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1.5 rounded-[3px] text-xs font-medium font-mono transition-all ${
                selectedYear === year
                  ? "bg-accent text-white shadow-warm"
                  : "border border-rule bg-paper text-ink hover:border-accent hover:text-accent hover:bg-paper-alt"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Issues Grouped by Year */}
      <div className="space-y-12">
        {displayedYears.map((year) => {
          const yearIssues = issuesByYear[year] || [];
          return (
            <section
              key={year}
              aria-labelledby={`year-heading-${year}`}
              className="space-y-6 transition-opacity duration-300 animate-in fade-in"
            >
              <h2
                id={`year-heading-${year}`}
                className="text-xl font-heading font-semibold text-ink border-b border-rule pb-2 flex items-center justify-between"
              >
                <span>{t("yearHeading", { year })}</span>
                <span className="text-xs font-mono font-normal text-muted">
                  {yearIssues.length} {yearIssues.length === 1 ? "issue" : "issues"}
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {yearIssues.map((issue) => {
                  const issueTitle =
                    (issue.title &&
                      (issue.title[locale as "en" | "fr" | "ar"] ||
                        issue.title.en ||
                        Object.values(issue.title)[0])) ||
                    "";
                  const volIssue = formatVolumeIssue(issue.volume, issue.number, locale);

                  return (
                    <article
                      key={issue.id}
                      className="group rounded-[3px] border border-rule border-t-2 border-t-accent bg-paper p-5 sm:p-6 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-warm hover:border-accent/40 flex flex-col sm:flex-row gap-5 justify-between"
                    >
                      {/* Left: IssueCover Thumbnail */}
                      <div className="shrink-0 flex justify-center sm:justify-start">
                        <Link href={`/issues/${issue.id}`} tabIndex={-1} aria-hidden="true">
                          <IssueCover issue={issue} size="card" locale={locale} />
                        </Link>
                      </div>

                      {/* Right: Metadata & Link */}
                      <div className="flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="inline-block px-2 py-0.5 rounded-[2px] border border-accent/20 bg-paper-alt text-accent font-mono text-[11px] font-medium">
                            {volIssue}
                          </div>

                          <h3 className="text-lg font-heading font-semibold text-ink group-hover:text-accent transition-colors leading-snug">
                            <Link href={`/issues/${issue.id}`}>
                              {issueTitle || volIssue}
                            </Link>
                          </h3>

                          {issue.publishedAt && (
                            <p className="text-xs text-muted font-body">
                              {t("publishedDate", {
                                date: formatLocalizedDate(issue.publishedAt, locale, {
                                  year: "numeric",
                                  month: "long",
                                }),
                              })}
                            </p>
                          )}
                        </div>

                        <div className="pt-4 border-t border-rule/50 flex items-center justify-between text-xs">
                          <span className="text-muted flex items-center gap-1.5 font-body">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>
                              {t("articlesCount", { count: issue.articles?.length || 4 })}
                            </span>
                          </span>

                          <Link
                            href={`/issues/${issue.id}`}
                            className="inline-flex items-center gap-1 text-accent font-medium hover:underline"
                          >
                            <span>{t("volumeIssue", { volume: issue.volume, number: issue.number })}</span>
                            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
