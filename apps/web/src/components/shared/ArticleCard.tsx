"use client";

import React from "react";
import type { Article, Locale } from "@/lib/domain/types";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { FileText, ArrowUpRight } from "lucide-react";
import { AuthorList } from "./AuthorList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLocalizedDate, formatVolumeIssue } from "@/lib/utils";

interface ArticleCardProps {
  article: Article;
  showAbstract?: boolean;
}

export function ArticleCard({ article, showAbstract = true }: ArticleCardProps) {
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("common");

  // Title in user's locale or fallback to manuscript language
  const title =
    article.title[currentLocale] ||
    article.title[article.manuscriptLanguage] ||
    Object.values(article.title)[0] ||
    "Untitled Article";

  // Abstract in user's locale or fallback
  const abstract =
    article.abstract[currentLocale] ||
    article.abstract[article.manuscriptLanguage] ||
    Object.values(article.abstract)[0] ||
    "";

  // First keyword or manuscript discipline as subject chip
  const subjectChip =
    article.keywords[currentLocale]?.[0] ||
    article.keywords[article.manuscriptLanguage]?.[0] ||
    (article.manuscriptLanguage === "ar"
      ? "دراسات متوسطية"
      : article.manuscriptLanguage === "fr"
      ? "Sciences sociales"
      : "Humanities");

  const volIssue = formatVolumeIssue(article.volume ?? 1, article.number ?? 1, currentLocale);

  return (
    <article className="group rounded-[3px] border border-rule border-t-2 border-t-accent bg-paper p-5 sm:p-6 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-warm hover:border-accent/40 flex flex-col justify-between">
      <div>
        {/* Top meta strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted mb-2.5 font-body">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-accent font-medium">
              {volIssue} ({article.year})
            </span>
            {article.publishedAt && (
              <>
                <span aria-hidden="true" className="text-rule">•</span>
                <time dateTime={article.publishedAt} className="text-[11px]">
                  {formatLocalizedDate(article.publishedAt, currentLocale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="text-[10px] font-normal py-0 px-1.5 bg-paper-alt border-rule text-muted"
            >
              {subjectChip}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] font-mono uppercase py-0 px-1.5 border-accent/20 text-accent"
            >
              {article.manuscriptLanguage}
            </Badge>
          </div>
        </div>

        {/* Article Title */}
        <h3 className="text-base sm:text-lg font-heading font-semibold text-ink group-hover:text-accent transition-colors leading-snug">
          <Link
            href={`/articles/${article.id}`}
            className="flex items-start justify-between gap-1.5"
          >
            <span>{title}</span>
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1 rtl:rotate-90" />
          </Link>
        </h3>

        {/* Authors */}
        <div className="mt-2.5">
          <AuthorList
            authors={article.authors}
            showAffiliations={false}
            locale={currentLocale}
          />
        </div>

        {/* Abstract */}
        {showAbstract && abstract && (
          <p className="mt-3 text-xs sm:text-sm text-muted line-clamp-3 leading-relaxed font-body">
            {abstract}
          </p>
        )}
      </div>

      {/* Bottom Actions & DOI */}
      <div className="mt-5 pt-3 border-t border-rule/70 flex flex-wrap items-center justify-between gap-3 text-xs font-body">
        {article.doi ? (
          <span className="text-[11px] text-muted font-mono truncate max-w-[200px] sm:max-w-none">
            DOI: {article.doi}
          </span>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          <Link href={`/articles/${article.id}#citation`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
              {t("cite")}
            </Button>
          </Link>

          <a
            href={article.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-accent hover:bg-accent/10 px-2 py-1 rounded-[2px] border border-accent/30 text-[11px] transition-colors"
          >
            <FileText className="h-3 w-3" />
            <span>{t("downloadPdf")}</span>
          </a>
        </div>
      </div>
    </article>
  );
}
