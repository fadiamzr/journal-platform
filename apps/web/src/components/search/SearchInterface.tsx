"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import type { Article, Issue, Locale } from "@/lib/domain/types";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { AuthorList } from "@/components/shared/AuthorList";
import { formatLocalizedDate, formatVolumeIssue } from "@/lib/utils";
import { Search as SearchIcon, X, SlidersHorizontal, ArrowUpRight, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchInterfaceProps {
  initialArticles: Article[];
  issues: Issue[];
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="bg-gold/30 text-ink rounded-[2px] px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function SearchInterface({ initialArticles, issues }: SearchInterfaceProps) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q") || "";
  const currentLang = searchParams.get("lang") || "all";
  const currentYear = searchParams.get("year") || "all";
  const currentIssue = searchParams.get("issue") || "all";

  const [inputQuery, setInputQuery] = useState(currentQuery);

  // Sync state if URL query changes
  useEffect(() => {
    setInputQuery(currentQuery);
  }, [currentQuery]);

  const updateFilters = useCallback(
    (key: string, val: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (val && val !== "all") {
        params.set(key, val);
      } else {
        params.delete(key);
      }

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  // Live debounced search while typing (~250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputQuery.trim() !== currentQuery) {
        updateFilters("q", inputQuery.trim());
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputQuery, currentQuery, updateFilters]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters("q", inputQuery.trim());
  };

  const handleClearFilters = () => {
    setInputQuery("");
    startTransition(() => {
      router.replace(pathname);
    });
  };

  // Filter client-side over initialArticles
  let filtered = [...initialArticles];

  if (inputQuery.trim()) {
    const q = inputQuery.trim().toLowerCase();
    filtered = filtered.filter((art) => {
      const titleMatch = Object.values(art.title).some((t) => t?.toLowerCase().includes(q));
      const abstractMatch = Object.values(art.abstract).some((a) => a?.toLowerCase().includes(q));
      const authorMatch = art.authors.some((au) => au.fullName.toLowerCase().includes(q));
      const keywordMatch = Object.values(art.keywords).some((kws) =>
        kws?.some((k) => k.toLowerCase().includes(q))
      );
      return titleMatch || abstractMatch || authorMatch || keywordMatch;
    });
  }

  if (currentLang !== "all") {
    filtered = filtered.filter((a) => a.manuscriptLanguage === currentLang);
  }

  if (currentYear !== "all") {
    filtered = filtered.filter((a) => a.year === Number(currentYear));
  }

  if (currentIssue !== "all") {
    filtered = filtered.filter((a) => a.issueId === currentIssue);
  }

  const availableYears = Array.from(new Set(initialArticles.map((a) => a.year).filter(Boolean))).sort(
    (a, b) => (b as number) - (a as number)
  );

  const hasActiveFilters =
    Boolean(inputQuery) || currentLang !== "all" || currentYear !== "all" || currentIssue !== "all";

  return (
    <div className="space-y-8 pb-12">
      {/* Search Input Box with Live Debounced updates */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Input
          type="search"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={t("queryPlaceholder")}
          aria-label={t("queryPlaceholder")}
          className="h-12 ps-4 pe-28 text-base bg-paper rounded-[3px] border-rule focus-visible:border-accent shadow-sm"
        />
        <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {inputQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted hover:text-ink"
              onClick={() => {
                setInputQuery("");
                updateFilters("q", "");
              }}
              aria-label={t("clearQuery")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button type="submit" size="sm" className="h-8 text-xs px-3 shadow-warm">
            <SearchIcon className="h-3.5 w-3.5 me-1.5" />
            <span>{tCommon("search")}</span>
          </Button>
        </div>
      </form>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-paper-alt rounded-[3px] border border-rule text-xs">
        <div className="flex items-center gap-1.5 text-muted font-medium me-1">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{t("filters")}:</span>
        </div>

        {/* Language Filter */}
        <div className="w-36">
          <Select
            value={currentLang}
            onValueChange={(val) => updateFilters("lang", val)}
          >
            <SelectTrigger className="h-8 text-xs bg-paper border-rule">
              <SelectValue placeholder={t("allLanguages")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allLanguages")}</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Year Filter */}
        <div className="w-32">
          <Select
            value={currentYear}
            onValueChange={(val) => updateFilters("year", val)}
          >
            <SelectTrigger className="h-8 text-xs bg-paper border-rule">
              <SelectValue placeholder={t("allYears")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allYears")}</SelectItem>
              {availableYears.map((yr) => (
                <SelectItem key={yr} value={String(yr)}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Issue Filter */}
        <div className="w-48">
          <Select
            value={currentIssue}
            onValueChange={(val) => updateFilters("issue", val)}
          >
            <SelectTrigger className="h-8 text-xs bg-paper border-rule">
              <SelectValue placeholder={t("allIssues")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allIssues")}</SelectItem>
              {issues.map((iss) => (
                <SelectItem key={iss.id} value={iss.id}>
                  {formatVolumeIssue(iss.volume, iss.number, currentLocale)} ({iss.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8 text-xs text-muted hover:text-ink ms-auto"
          >
            {t("clearFilters")}
          </Button>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-baseline justify-between border-b border-rule pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted font-body">
          {t("resultsCount", { count: filtered.length })}
        </h2>
        {isPending && <span className="text-xs text-muted animate-pulse">{t("updating")}</span>}
      </div>

      {/* Results List with Highlighted Matches and Animated Changes */}
      {filtered.length > 0 ? (
        <div className="divide-y divide-rule transition-opacity duration-200">
          {filtered.map((article) => {
            const title =
              article.title[currentLocale] ||
              article.title[article.manuscriptLanguage] ||
              Object.values(article.title)[0] ||
              "";

            const abstract =
              article.abstract[currentLocale] ||
              article.abstract[article.manuscriptLanguage] ||
              Object.values(article.abstract)[0] ||
              "";

            const volIssue = formatVolumeIssue(article.volume ?? 1, article.number ?? 1, currentLocale);

            const subjectChip =
              article.keywords[currentLocale]?.[0] ||
              article.keywords[article.manuscriptLanguage]?.[0] ||
              article.manuscriptLanguage.toUpperCase();

            return (
              <article
                key={article.id}
                className="group py-5 first:pt-0 transition-all duration-200 hover:bg-paper-alt/40 px-3 -mx-3 rounded-[3px]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted mb-2 font-body">
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

                <h3 className="text-base sm:text-lg font-heading font-semibold text-ink group-hover:text-accent transition-colors leading-snug">
                  <Link
                    href={`/articles/${article.id}`}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span>
                      <HighlightMatch text={title} query={inputQuery} />
                    </span>
                    <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rtl:rotate-90" />
                  </Link>
                </h3>

                <div className="mt-1.5">
                  <AuthorList authors={article.authors} showAffiliations={false} />
                </div>

                {abstract && (
                  <p className="mt-2 text-xs sm:text-sm text-muted font-body line-clamp-2 leading-relaxed">
                    <HighlightMatch text={abstract} query={inputQuery} />
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between pt-2">
                  <a
                    href={article.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{tCommon("pdf")}</span>
                  </a>

                  <Link
                    href={`/articles/${article.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors font-medium"
                  >
                    <span>{tCommon("viewArticle")}</span>
                    <ArrowUpRight className="h-3 w-3 rtl:rotate-90" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t("noResults")}
          description={t("emptyQuery")}
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                {t("clearFilters")}
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
