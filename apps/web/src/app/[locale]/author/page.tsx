"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { Submission } from "@/lib/domain/types";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  ArrowRight,
  FileEdit,
  MessageSquare,
  Eye,
} from "lucide-react";

type FilterTab = "all" | "drafts" | "under_review" | "revisions_requested" | "decided";

export default function AuthorDashboardPage() {
  const t = useTranslations("author");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await api.listMySubmissions();
        setSubmissions(data);
      } catch (err) {
        console.error("Failed to load submissions:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter counts
  const counts = useMemo(() => {
    return {
      all: submissions.length,
      drafts: submissions.filter((s) => s.status === "draft").length,
      under_review: submissions.filter(
        (s) => s.status === "submitted" || s.status === "in_review"
      ).length,
      revisions_requested: submissions.filter(
        (s) => s.status === "revisions_requested"
      ).length,
      decided: submissions.filter(
        (s) =>
          s.status === "accepted" ||
          s.status === "rejected" ||
          s.status === "published"
      ).length,
    };
  }, [submissions]);

  // Filtered list
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Tab matching
      if (filter === "drafts" && sub.status !== "draft") return false;
      if (
        filter === "under_review" &&
        sub.status !== "submitted" &&
        sub.status !== "in_review"
      )
        return false;
      if (
        filter === "revisions_requested" &&
        sub.status !== "revisions_requested"
      )
        return false;
      if (
        filter === "decided" &&
        sub.status !== "accepted" &&
        sub.status !== "rejected" &&
        sub.status !== "published"
      )
        return false;

      // Search matching
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titles = Object.values(sub.title).join(" ").toLowerCase();
        const kw = Object.values(sub.keywords)
          .flatMap((k) => k)
          .join(" ")
          .toLowerCase();
        if (!titles.includes(query) && !kw.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [submissions, filter, searchQuery]);

  // Action Button for each submission
  const renderActionButton = (sub: Submission) => {
    if (sub.status === "draft") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/author/${sub.id}/edit`)}
          className="text-xs h-7 border-rule gap-1 text-ink hover:text-accent"
        >
          <FileEdit className="h-3 w-3 text-muted" strokeWidth={1.5} />
          <span>{t("actionContinueDraft")}</span>
        </Button>
      );
    }

    if (sub.status === "revisions_requested") {
      return (
        <Button
          size="sm"
          onClick={() => router.push(`/author/${sub.id}?tab=revision`)}
          className="text-xs h-7 gap-1 bg-amber-700 hover:bg-amber-800 text-white"
        >
          <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
          <span>{t("actionRespond")}</span>
        </Button>
      );
    }

    if (
      sub.status === "accepted" ||
      sub.status === "rejected" ||
      sub.status === "published"
    ) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/author/${sub.id}?tab=decision`)}
          className="text-xs h-7 border-rule gap-1 text-ink"
        >
          <Eye className="h-3 w-3 text-muted" strokeWidth={1.5} />
          <span>{t("actionViewDecision")}</span>
        </Button>
      );
    }

    // Default under review
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => router.push(`/author/${sub.id}`)}
        className="text-xs h-7 gap-1 text-muted hover:text-ink"
      >
        <span>{t("actionViewSubmission")}</span>
        <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
      </Button>
    );
  };

  const filterTabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "all", label: t("filterAll"), count: counts.all },
    { id: "drafts", label: t("filterDrafts"), count: counts.drafts },
    {
      id: "under_review",
      label: t("filterUnderReview"),
      count: counts.under_review,
    },
    {
      id: "revisions_requested",
      label: t("filterRevisionsRequested"),
      count: counts.revisions_requested,
    },
    { id: "decided", label: t("filterDecided"), count: counts.decided },
  ];

  return (
    <PortalLayout allowedRoles={["author", "editor", "admin"]}>
      <div className="space-y-6">
        {/* Header & Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-heading font-bold text-ink tracking-tight">
              {t("title")}
            </h1>
            <p className="text-xs text-muted max-w-xl leading-relaxed">
              {t("subtitle")}
            </p>
          </div>

          <Button
            onClick={() => router.push("/author/new")}
            className="text-xs gap-1.5 self-start sm:self-center shadow-xs"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            <span>{t("newButton")}</span>
          </Button>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Pills */}
          <div
            role="tablist"
            aria-label="Submission Filters"
            className="flex flex-wrap items-center gap-1.5"
          >
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                  filter === tab.id
                    ? "bg-ink text-paper font-semibold"
                    : "bg-paper text-muted hover:text-ink border border-rule hover:bg-paper-alt"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    filter === tab.id
                      ? "bg-paper/20 text-paper"
                      : "bg-paper-alt text-muted"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative max-w-xs w-full">
            <Search
              className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted pointer-events-none"
              strokeWidth={1.5}
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="text-xs ps-8 h-8 bg-paper border-rule"
            />
          </div>
        </div>

        {/* Submissions List: Table on Desktop / Cards on Mobile */}
        {loading ? (
          <div className="rounded border border-rule bg-paper p-12 text-center text-xs text-muted animate-pulse">
            {tCommon("loading")}
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDesc")}
            action={
              <Button
                size="sm"
                onClick={() => router.push("/author/new")}
                className="text-xs gap-1.5 mt-2"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{t("newButton")}</span>
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-[3px] border border-rule bg-paper overflow-hidden shadow-xs">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-rule bg-paper-alt/50 text-muted font-medium text-[11px] uppercase tracking-wider">
                    <th scope="col" className="py-3 px-4 text-start font-semibold">
                      {t("colTitle")}
                    </th>
                    <th scope="col" className="py-3 px-4 text-start font-semibold w-36">
                      {t("colStatus")}
                    </th>
                    <th scope="col" className="py-3 px-4 text-center font-semibold w-24">
                      {t("colRound")}
                    </th>
                    <th scope="col" className="py-3 px-4 text-start font-semibold w-32">
                      {t("colLastUpdated")}
                    </th>
                    <th scope="col" className="py-3 px-4 text-end font-semibold w-40">
                      {t("colActions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {filteredSubmissions.map((sub) => {
                    const primaryTitle =
                      sub.title[sub.manuscriptLanguage] ||
                      Object.values(sub.title)[0] ||
                      "Untitled Manuscript";
                    const lastDate =
                      sub.submittedAt || sub.createdAt || "Recently";

                    return (
                      <tr
                        key={sub.id}
                        className="hover:bg-paper-alt/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-medium text-ink">
                          <Link
                            href={
                              sub.status === "draft"
                                ? `/author/${sub.id}/edit`
                                : `/author/${sub.id}`
                            }
                            className="hover:text-accent transition-colors line-clamp-1 font-semibold"
                          >
                            {primaryTitle}
                          </Link>
                          <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-muted/80">
                              {sub.id}
                            </span>
                            <span>•</span>
                            <span className="uppercase text-[10px] font-mono">
                              {sub.manuscriptLanguage}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={sub.status} />
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-[11px] text-muted">
                          R{sub.currentRound}
                        </td>
                        <td className="py-3.5 px-4 text-muted text-[11px]">
                          {new Date(lastDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-end">
                          {renderActionButton(sub)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredSubmissions.map((sub) => {
                const primaryTitle =
                  sub.title[sub.manuscriptLanguage] ||
                  Object.values(sub.title)[0] ||
                  "Untitled Manuscript";
                const lastDate =
                  sub.submittedAt || sub.createdAt || "Recently";

                return (
                  <div
                    key={sub.id}
                    className="rounded-[3px] border border-rule bg-paper p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <StatusBadge status={sub.status} />
                      <span className="text-[11px] font-mono text-muted">
                        Round {sub.currentRound}
                      </span>
                    </div>

                    <div>
                      <Link
                        href={
                          sub.status === "draft"
                            ? `/author/${sub.id}/edit`
                            : `/author/${sub.id}`
                        }
                        className="font-heading font-semibold text-sm text-ink hover:text-accent line-clamp-2"
                      >
                        {primaryTitle}
                      </Link>
                      <div className="text-[11px] text-muted mt-1 flex items-center gap-2">
                        <span className="font-mono">{sub.id}</span>
                        <span>•</span>
                        <span>
                          {new Date(lastDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-rule pt-2.5 flex justify-end">
                      {renderActionButton(sub)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
