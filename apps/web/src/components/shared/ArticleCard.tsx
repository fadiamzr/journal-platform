"use client";

import React from "react";
import type { Article, Locale } from "@/lib/domain/types";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { FileText, ArrowUpRight } from "lucide-react";
import { AuthorList } from "./AuthorList";
import { Badge } from "@/components/ui/badge";
import { formatLocalizedDate } from "@/lib/utils";

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

  const isFallbackTitle = !article.title[currentLocale] && article.manuscriptLanguage !== currentLocale;

  // Abstract in user's locale or fallback
  const abstract =
    article.abstract[currentLocale] ||
    article.abstract[article.manuscriptLanguage] ||
    Object.values(article.abstract)[0] ||
    "";

  return (
    <article className="group py-6 border-b border-rule last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-2">
        {article.volume && article.number && (
          <span>
            Vol. {article.volume}, No. {article.number} ({article.year})
          </span>
        )}
        {article.publishedAt && (
          <>
            <span aria-hidden="true">•</span>
            <time dateTime={article.publishedAt}>
              {formatLocalizedDate(article.publishedAt, currentLocale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </>
        )}
        {isFallbackTitle && (
          <Badge variant="outline" className="text-[10px] uppercase py-0 px-1">
            {article.manuscriptLanguage}
          </Badge>
        )}
      </div>

      <h3 className="text-lg md:text-xl font-heading font-semibold text-ink group-hover:text-accent transition-colors leading-snug">
        <Link href={`/articles/${article.id}`} className="hover:underline flex items-baseline gap-1">
          <span>{title}</span>
          <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 inline-block" />
        </Link>
      </h3>

      <div className="mt-2">
        <AuthorList authors={article.authors} showAffiliations={false} />
      </div>

      {showAbstract && abstract && (
        <p className="mt-3 text-sm text-muted line-clamp-3 leading-relaxed font-body">
          {abstract}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
        {article.doi && (
          <span className="text-muted font-mono">
            DOI: {article.doi}
          </span>
        )}
        <a
          href={article.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline py-1"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{t("downloadPdf")}</span>
        </a>
      </div>
    </article>
  );
}
