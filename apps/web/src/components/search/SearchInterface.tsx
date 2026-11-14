"use client";

import React, { useState, useEffect, useTransition } from "react";
import type { Article, Issue } from "@/lib/domain/types";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search as SearchIcon, X, SlidersHorizontal } from "lucide-react";
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

export function SearchInterface({ initialArticles, issues }: SearchInterfaceProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q") || "";
  const currentLang = searchParams.get("lang") || "all";
  const currentYear = searchParams.get("year") || "all";
  const currentIssue = searchParams.get("issue") || "all";

  const [inputQuery, setInputQuery] = useState(currentQuery);

  useEffect(() => {
    setInputQuery(currentQuery);
  }, [currentQuery]);

  const updateFilters = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val && val !== "all") {
      params.set(key, val);
    } else {
      params.delete(key);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

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

  // Filter client-side over initialArticles (or can call api.searchArticles)
  let filtered = [...initialArticles];

  if (currentQuery.trim()) {
    const q = currentQuery.trim().toLowerCase();
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
    Boolean(currentQuery) || currentLang !== "all" || currentYear !== "all" || currentIssue !== "all";

  return (
    <div className="space-y-8">
      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Input
          type="search"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={t("queryPlaceholder")}
          className="h-12 ps-4 pe-24 text-base bg-paper rounded-[3px] border-rule"
        />
        <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
              aria-label="Clear query"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button type="submit" size="sm" className="h-8 text-xs">
            <SearchIcon className="h-3.5 w-3.5 me-1.5" />
            <span>Search</span>
          </Button>
        </div>
      </form>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-paper-alt rounded-[3px] border border-rule text-xs">
        <div className="flex items-center gap-1.5 text-muted font-medium me-1">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filters:</span>
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
                  Vol. {iss.volume}, No. {iss.number} ({iss.year})
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
        {isPending && <span className="text-xs text-muted">Updating results…</span>}
      </div>

      {/* Results List */}
      {filtered.length > 0 ? (
        <div className="divide-y divide-rule">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} showAbstract={true} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("noResults")}
          description="Try broadening your search terms or resetting the language and year filters."
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
