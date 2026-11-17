"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { api } from "@/lib/api";
import type { Article, Issue } from "@/lib/domain/types";
import { formatVolumeIssue, cleanAuthorName } from "@/lib/utils";
import { Search, FileText, BookOpen, User, X, CornerDownLeft } from "lucide-react";

interface AuthorMatch {
  name: string;
  articleId: string;
  articleTitle: string;
}

export function CommandSearchDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("search");
  const tCommon = useTranslations("common");

  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [authors, setAuthors] = useState<AuthorMatch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search over mock data when query changes
  useEffect(() => {
    if (!query.trim()) {
      setArticles([]);
      setIssues([]);
      setAuthors([]);
      setSelectedIndex(0);
      return;
    }

    const q = query.trim().toLowerCase();

    // 1. Search articles
    api.searchArticles({ query: q }).then((res) => {
      setArticles(res.slice(0, 5));

      // Extract matching authors
      const matchedAuthors: AuthorMatch[] = [];
      const seenAuthors = new Set<string>();

      res.forEach((art) => {
        art.authors.forEach((au) => {
          const cleaned = cleanAuthorName(au.fullName);
          if (
            cleaned.toLowerCase().includes(q) &&
            !seenAuthors.has(cleaned.toLowerCase())
          ) {
            seenAuthors.add(cleaned.toLowerCase());
            const title =
              art.title[locale as "en" | "fr" | "ar"] || art.title.en || "";
            matchedAuthors.push({
              name: cleaned,
              articleId: art.id,
              articleTitle: title,
            });
          }
        });
      });

      setAuthors(matchedAuthors.slice(0, 3));
    });

    // 2. Search issues
    api.listIssues().then((issList) => {
      const matched = issList.filter((iss) => {
        const titleMatches = iss.title
          ? Object.values(iss.title).some((t) => t?.toLowerCase().includes(q))
          : false;
        const yearMatches = String(iss.year).includes(q);
        const volMatches = `vol ${iss.volume}`.includes(q) || `volume ${iss.volume}`.includes(q);
        return titleMatches || yearMatches || volMatches;
      });
      setIssues(matched.slice(0, 3));
    });
  }, [query, locale]);

  // Flattened items list for keyboard navigation
  interface FlatItem {
    type: "article" | "author" | "issue";
    id: string;
    url: string;
  }

  const flattenedItems: FlatItem[] = [
    ...articles.map((a) => ({ type: "article" as const, id: a.id, url: `/articles/${a.id}` })),
    ...authors.map((au) => ({ type: "author" as const, id: `${au.name}-${au.articleId}`, url: `/articles/${au.articleId}` })),
    ...issues.map((i) => ({ type: "issue" as const, id: i.id, url: `/issues/${i.id}` })),
  ];

  const handleSelect = useCallback((url: string) => {
    onClose();
    router.push(url);
  }, [onClose, router]);

  const handleSubmitSearch = useCallback(() => {
    onClose();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/search");
    }
  }, [onClose, query, router]);

  // Handle keyboard navigation inside dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        flattenedItems.length > 0 ? (prev + 1) % flattenedItems.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        flattenedItems.length > 0
          ? (prev - 1 + flattenedItems.length) % flattenedItems.length
          : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flattenedItems.length > 0 && selectedIndex < flattenedItems.length) {
        handleSelect(flattenedItems[selectedIndex].url);
      } else {
        handleSubmitSearch();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  let currentItemCounter = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("queryPlaceholder")}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150 font-body"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-[3px] border border-rule bg-paper shadow-warm-lg overflow-hidden flex flex-col text-ink animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-rule bg-paper">
          <Search className="h-4 w-4 text-accent shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t("queryPlaceholder")}
            aria-label={t("queryPlaceholder")}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-muted hover:text-ink"
              aria-label={tCommon("clearAll")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-[10px] text-muted font-mono bg-paper-alt px-1.5 py-0.5 rounded border border-rule select-none">
            Esc
          </span>
        </div>

        {/* Results Body */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-3">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-muted space-y-1">
              <p>{t("emptyQuery")}</p>
              <p className="text-[11px] text-muted/70">
                Type keywords, article titles, author names, or volume numbers.
              </p>
            </div>
          ) : flattenedItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted space-y-2">
              <p>{t("noResults")}</p>
              <button
                type="button"
                onClick={handleSubmitSearch}
                className="text-xs text-accent underline hover:text-ink"
              >
                Search all in archive →
              </button>
            </div>
          ) : (
            <>
              {/* Articles Group */}
              {articles.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-accent" />
                    <span>Articles</span>
                  </div>
                  {articles.map((art) => {
                    const myIndex = currentItemCounter++;
                    const isSelected = selectedIndex === myIndex;
                    const title =
                      art.title[locale as "en" | "fr" | "ar"] ||
                      art.title.en ||
                      "";
                    const volIssue = formatVolumeIssue(art.volume ?? 1, art.number ?? 1, locale);

                    return (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => handleSelect(`/articles/${art.id}`)}
                        className={`w-full text-start p-2.5 rounded-[3px] text-xs flex items-center justify-between gap-3 transition-colors ${
                          isSelected
                            ? "bg-accent/10 border border-accent/40 text-accent font-medium"
                            : "hover:bg-paper-alt border border-transparent text-ink"
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="truncate font-heading text-xs font-medium">
                            {title}
                          </p>
                          <p className="text-[11px] text-muted truncate">
                            {art.authors.map((a) => cleanAuthorName(a.fullName)).join(", ")} •{" "}
                            <span className="font-mono">{volIssue}</span>
                          </p>
                        </div>
                        {isSelected && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Authors Group */}
              {authors.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5 border-t border-rule pt-2">
                    <User className="h-3 w-3 text-accent" />
                    <span>Authors</span>
                  </div>
                  {authors.map((au) => {
                    const myIndex = currentItemCounter++;
                    const isSelected = selectedIndex === myIndex;

                    return (
                      <button
                        key={`${au.name}-${au.articleId}`}
                        type="button"
                        onClick={() => handleSelect(`/articles/${au.articleId}`)}
                        className={`w-full text-start p-2.5 rounded-[3px] text-xs flex items-center justify-between gap-3 transition-colors ${
                          isSelected
                            ? "bg-accent/10 border border-accent/40 text-accent font-medium"
                            : "hover:bg-paper-alt border border-transparent text-ink"
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-medium text-ink">{au.name}</p>
                          <p className="text-[11px] text-muted truncate">
                            Publication: {au.articleTitle}
                          </p>
                        </div>
                        {isSelected && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Issues Group */}
              {issues.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5 border-t border-rule pt-2">
                    <BookOpen className="h-3 w-3 text-accent" />
                    <span>Issues</span>
                  </div>
                  {issues.map((iss) => {
                    const myIndex = currentItemCounter++;
                    const isSelected = selectedIndex === myIndex;
                    const volIssue = formatVolumeIssue(iss.volume, iss.number, locale);
                    const title =
                      (iss.title && (iss.title[locale as "en" | "fr" | "ar"] ||
                        iss.title.en)) ||
                      "";

                    return (
                      <button
                        key={iss.id}
                        type="button"
                        onClick={() => handleSelect(`/issues/${iss.id}`)}
                        className={`w-full text-start p-2.5 rounded-[3px] text-xs flex items-center justify-between gap-3 transition-colors ${
                          isSelected
                            ? "bg-accent/10 border border-accent/40 text-accent font-medium"
                            : "hover:bg-paper-alt border border-transparent text-ink"
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-medium text-ink">
                            <span className="font-mono text-accent">{volIssue}</span> ({iss.year})
                          </p>
                          <p className="text-[11px] text-muted truncate">{title}</p>
                        </div>
                        {isSelected && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info bar */}
        <footer className="px-4 py-2 bg-paper-alt border-t border-rule text-[11px] text-muted flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono px-1 py-0.5 border border-rule bg-paper rounded text-[10px]">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono px-1 py-0.5 border border-rule bg-paper rounded text-[10px]">Enter</kbd> open
            </span>
          </div>
          <button
            type="button"
            onClick={handleSubmitSearch}
            className="text-accent hover:underline font-medium"
          >
            Full search page →
          </button>
        </footer>
      </div>
    </div>
  );
}
