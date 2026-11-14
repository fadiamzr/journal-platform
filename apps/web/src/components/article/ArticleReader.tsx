"use client";

import React, { useState } from "react";
import type { Article, Locale } from "@/lib/domain/types";
import { LanguageTabs } from "@/components/shared/LanguageTabs";
import { CitationBlock } from "@/components/shared/CitationBlock";
import { AuthorList } from "@/components/shared/AuthorList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Share2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatLocalizedDate } from "@/lib/utils";

export function ArticleReader({ article }: { article: Article }) {
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("article");

  const [activeTabLocale, setActiveTabLocale] = useState<Locale>(() => {
    if (article.abstract[currentLocale]) return currentLocale;
    if (article.abstract[article.manuscriptLanguage]) return article.manuscriptLanguage;
    return (Object.keys(article.abstract)[0] as Locale) || "en";
  });

  const [shareCopied, setShareCopied] = useState(false);

  const displayTitle =
    article.title[activeTabLocale] ||
    article.title[article.manuscriptLanguage] ||
    Object.values(article.title)[0] ||
    "Untitled";

  const displayAbstract =
    article.abstract[activeTabLocale] ||
    article.abstract[article.manuscriptLanguage] ||
    Object.values(article.abstract)[0] ||
    "";

  const displayKeywords =
    article.keywords[activeTabLocale] ||
    article.keywords[article.manuscriptLanguage] ||
    Object.values(article.keywords)[0] ||
    [];

  const handleShare = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setShareCopied(true);
        toast.success(t("linkCopied"));
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <article className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
      {/* ── Main Reading Column (approx 680px) ─────────────────────────────────── */}
      <div className="lg:col-span-8 max-w-reading space-y-8">
        {/* Title and Language Tag */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs uppercase py-0.5 px-2">
              {t("manuscriptLanguage")}: {article.manuscriptLanguage}
            </Badge>
            {article.doi && (
              <span className="text-xs font-mono text-muted">
                {article.doi}
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-4xl font-heading font-semibold text-ink leading-tight tracking-tight">
            {displayTitle}
          </h1>

          {/* Authors and affiliations */}
          <div className="pt-2">
            <AuthorList authors={article.authors} showAffiliations={true} />
          </div>
        </header>

        {/* Abstract with Multilingual Tabs */}
        <section aria-labelledby="abstract-heading" className="space-y-3 pt-6 border-t border-rule">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 id="abstract-heading" className="text-sm font-semibold uppercase tracking-wider text-muted font-body">
              {t("abstract")}
            </h2>
            <LanguageTabs
              content={article.abstract}
              activeLocale={activeTabLocale}
              onLocaleChange={setActiveTabLocale}
            />
          </div>

          <div className="prose-academic text-ink/90 leading-relaxed font-heading text-lg">
            <p>{displayAbstract}</p>
          </div>
        </section>

        {/* Keywords */}
        {displayKeywords.length > 0 && (
          <section aria-labelledby="keywords-heading" className="space-y-2 pt-4 border-t border-rule/60">
            <h3 id="keywords-heading" className="text-xs font-semibold uppercase tracking-wider text-muted font-body">
              {t("keywords")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {displayKeywords.map((kw, i) => (
                <span
                  key={kw + i}
                  className="rounded-[2px] bg-paper-alt border border-rule px-2 py-0.5 text-xs text-ink"
                >
                  {kw}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Citation Box */}
        <div className="pt-8 border-t border-rule no-print">
          <CitationBlock article={article} />
        </div>
      </div>

      {/* ── Metadata Sidebar Column (Desktop) ─────────────────────────────────── */}
      <aside aria-label={t("metadata")} className="lg:col-span-4 border-t lg:border-t-0 lg:border-s border-rule pt-6 lg:pt-0 lg:ps-8 space-y-6 text-sm">
        {/* PDF Download Button (Primary) */}
        <div className="space-y-3">
          <a
            href={article.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block no-print"
          >
            <Button className="w-full justify-center gap-2 h-10 font-medium">
              <FileText className="h-4 w-4" />
              <span>{t("downloadPdf")}</span>
            </Button>
          </a>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="w-full justify-center gap-2 text-xs no-print"
          >
            {shareCopied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            <span>{shareCopied ? t("linkCopied") : t("share")}</span>
          </Button>
        </div>

        {/* Metadata List */}
        <div className="space-y-4 pt-4 border-t border-rule text-xs">
          <div>
            <span className="font-semibold text-muted uppercase tracking-wider block mb-1">
              {t("issue")}
            </span>
            <span className="text-ink font-medium">
              Vol. {article.volume || 1}, No. {article.number || 1} ({article.year || 2026})
            </span>
          </div>

          <div>
            <span className="font-semibold text-muted uppercase tracking-wider block mb-1">
              {t("publishedDate")}
            </span>
            <time dateTime={article.publishedAt} className="text-ink">
              {formatLocalizedDate(article.publishedAt, currentLocale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>

          {article.doi && (
            <div>
              <span className="font-semibold text-muted uppercase tracking-wider block mb-1">
                {t("doi")}
              </span>
              <a
                href={`https://doi.org/${article.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline break-all inline-flex items-center gap-1 font-mono text-[11px]"
              >
                <span>{article.doi}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          )}

          <div>
            <span className="font-semibold text-muted uppercase tracking-wider block mb-1">
              License
            </span>
            <span className="text-ink">
              Creative Commons Attribution-NonCommercial (CC BY-NC 4.0)
            </span>
          </div>
        </div>
      </aside>
    </article>
  );
}
