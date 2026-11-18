"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { ReviewerSubmissionView } from "@/lib/domain/types";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Check,
  X,
} from "lucide-react";

type ReviewerTab = "invitations" | "in_progress" | "completed";

export default function ReviewerDashboardPage() {
  const t = useTranslations("reviewer.list");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [assignments, setAssignments] = useState<ReviewerSubmissionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReviewerTab>("in_progress");

  // Decline Dialog State
  const [selectedDeclineId, setSelectedDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [isDeclining, setIsDeclining] = useState(false);

  // Extension Request Dialog State
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const [extensionDate, setExtensionDate] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [isSendingExtension, setIsSendingExtension] = useState(false);
  const [extensionSuccessMsg, setExtensionSuccessMsg] = useState(false);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await api.listAssignments();
      setAssignments(data);
    } catch (err) {
      console.error("Failed to load reviewer assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  // Filter groups
  const invitations = useMemo(
    () => assignments.filter((a) => a.assignmentStatus === "invited"),
    [assignments]
  );
  const inProgress = useMemo(
    () => assignments.filter((a) => a.assignmentStatus === "accepted"),
    [assignments]
  );
  const completed = useMemo(
    () => assignments.filter((a) => a.assignmentStatus === "completed"),
    [assignments]
  );

  // If initial load has invitations and no in_progress, focus invitations
  useEffect(() => {
    if (!loading && inProgress.length === 0 && invitations.length > 0) {
      setActiveTab("invitations");
    }
  }, [loading, inProgress.length, invitations.length]);

  // Handle Accept
  const handleAccept = async (assignmentId: string) => {
    try {
      await api.respondToInvitation(assignmentId, true);
      await fetchAssignments();
      setActiveTab("in_progress");
      router.push(`/reviewer/${assignmentId}`);
    } catch (err) {
      console.error("Failed to accept invitation:", err);
    }
  };

  // Handle Decline
  const handleConfirmDecline = async () => {
    if (!selectedDeclineId) return;
    try {
      setIsDeclining(true);
      await api.respondToInvitation(selectedDeclineId, false, declineReason);
      await fetchAssignments();
      setSelectedDeclineId(null);
      setDeclineReason("");
    } catch (err) {
      console.error("Failed to decline invitation:", err);
    } finally {
      setIsDeclining(false);
    }
  };

  // Handle Extension Request
  const handleConfirmExtension = async () => {
    if (!selectedExtensionId || !extensionDate) return;
    try {
      setIsSendingExtension(true);
      await api.requestDueDateExtension(selectedExtensionId, {
        proposedDate: extensionDate,
        reason: extensionReason,
      });
      setExtensionSuccessMsg(true);
      setTimeout(() => {
        setSelectedExtensionId(null);
        setExtensionDate("");
        setExtensionReason("");
        setExtensionSuccessMsg(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to request extension:", err);
    } finally {
      setIsSendingExtension(false);
    }
  };

  // Due date helper
  const getDueBadge = (dueDateString: string) => {
    const today = new Date();
    const due = new Date(dueDateString);
    const diffDays = Math.ceil(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      return (
        <span className="text-[11px] font-medium text-danger bg-danger-bg px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          <span>{t("overdue", { days: Math.abs(diffDays) })}</span>
        </span>
      );
    }

    if (diffDays === 0) {
      return (
        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          <span>{t("dueToday")}</span>
        </span>
      );
    }

    return (
      <span
        className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
          diffDays <= 7
            ? "text-amber-800 bg-amber-50"
            : "text-muted bg-paper-alt"
        }`}
      >
        <Calendar className="h-3 w-3 shrink-0" strokeWidth={1.5} />
        <span>{t("daysRemaining", { days: diffDays })}</span>
      </span>
    );
  };

  const tabs: Array<{ id: ReviewerTab; label: string; count: number }> = [
    { id: "invitations", label: t("tabInvitations"), count: invitations.length },
    { id: "in_progress", label: t("tabInProgress"), count: inProgress.length },
    { id: "completed", label: t("tabCompleted"), count: completed.length },
  ];

  const currentList =
    activeTab === "invitations"
      ? invitations
      : activeTab === "in_progress"
      ? inProgress
      : completed;

  return (
    <PortalLayout allowedRoles={["reviewer", "editor", "admin"]}>
      <div className="space-y-6">
        {/* Header & Guidelines Link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-heading font-bold text-ink tracking-tight">
              {t("title")}
            </h1>
            <p className="text-xs text-muted max-w-xl leading-relaxed">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/reviewer/guidelines"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium self-start sm:self-center"
          >
            <BookOpen className="h-4 w-4" strokeWidth={1.5} />
            <span>{t("guidelinesLink")}</span>
          </Link>
        </div>

        {/* Tab Selection */}
        <div
          role="tablist"
          aria-label="Review Assignment Tabs"
          className="flex items-center gap-2 border-b border-rule"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "border-accent text-accent font-semibold bg-paper/50"
                  : "border-transparent text-muted hover:text-ink hover:border-rule"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  activeTab === tab.id
                    ? "bg-accent/15 text-accent font-bold"
                    : "bg-paper-alt text-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* List Content */}
        {loading ? (
          <div className="rounded border border-rule bg-paper p-12 text-center text-xs text-muted animate-pulse">
            {tCommon("loading")}
          </div>
        ) : currentList.length === 0 ? (
          <EmptyState
            description={
              activeTab === "invitations"
                ? t("emptyInvitations")
                : activeTab === "in_progress"
                ? t("emptyInProgress")
                : t("emptyCompleted")
            }
          />
        ) : (
          <div className="space-y-4">
            {currentList.map((asg) => {
              const primaryTitle =
                asg.title[asg.manuscriptLanguage] ||
                Object.values(asg.title)[0] ||
                "Untitled Manuscript";
              const primaryAbstract =
                asg.abstract[asg.manuscriptLanguage] ||
                Object.values(asg.abstract)[0] ||
                "";

              return (
                <div
                  key={asg.assignmentId}
                  className="rounded-[3px] border border-rule bg-paper p-5 sm:p-6 space-y-4 transition-colors hover:border-muted/50 shadow-xs"
                >
                  {/* Top Meta: Status, Round, Language, Due Date */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/60 pb-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={asg.assignmentStatus} />
                      <Badge variant="outline" className="text-[11px] font-mono">
                        Round {asg.round}
                      </Badge>
                      <span className="text-[11px] font-mono uppercase text-muted">
                        {asg.manuscriptLanguage}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        {t("dueLabel", {
                          date: new Date(asg.dueAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }),
                        })}
                      </span>
                      {getDueBadge(asg.dueAt)}
                    </div>
                  </div>

                  {/* Title & Anonymized Abstract Excerpt */}
                  <div className="space-y-2">
                    <h2 className="text-base font-heading font-semibold text-ink leading-snug">
                      {primaryTitle}
                    </h2>
                    {primaryAbstract && (
                      <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                        {primaryAbstract}
                      </p>
                    )}
                    {asg.keywords[asg.manuscriptLanguage] && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {asg.keywords[asg.manuscriptLanguage]!.map((kw, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-paper-alt border border-rule text-ink px-1.5 py-0.5 rounded"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="border-t border-rule/60 pt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-muted font-mono">
                      Ref: {asg.assignmentId}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* INVITATION ACTIONS */}
                      {asg.assignmentStatus === "invited" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedExtensionId(asg.assignmentId)}
                            className="text-xs h-8 border-rule"
                          >
                            {t("requestExtension")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedDeclineId(asg.assignmentId)}
                            className="text-xs h-8 text-danger hover:text-danger hover:bg-danger-bg gap-1"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                            <span>{t("declineInvitation")}</span>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAccept(asg.assignmentId)}
                            className="text-xs h-8 gap-1.5 bg-accent text-white hover:bg-accent/90"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={2} />
                            <span>{t("acceptInvitation")}</span>
                          </Button>
                        </>
                      )}

                      {/* IN PROGRESS ACTION */}
                      {asg.assignmentStatus === "accepted" && (
                        <Button
                          size="sm"
                          onClick={() => router.push(`/reviewer/${asg.assignmentId}`)}
                          className="text-xs h-8 gap-1.5"
                        >
                          <span>{t("continueReview")}</span>
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </Button>
                      )}

                      {/* COMPLETED ACTION */}
                      {asg.assignmentStatus === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/reviewer/${asg.assignmentId}`)}
                          className="text-xs h-8 border-rule gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={1.5} />
                          <span>{t("viewReview")}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Decline Invitation Dialog */}
        <ConfirmDialog
          open={Boolean(selectedDeclineId)}
          onOpenChange={(open) => !open && setSelectedDeclineId(null)}
          title={t("declineDialogTitle")}
          description={t("declineDialogDesc")}
          confirmLabel={t("declineInvitation")}
          isDestructive={true}
          isLoading={isDeclining}
          onConfirm={handleConfirmDecline}
        >
          <div className="py-2 space-y-1">
            <Label htmlFor="decline-reason" className="text-xs font-medium text-ink">
              {t("declineReasonLabel")}
            </Label>
            <Input
              id="decline-reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Schedule constraints, topic outside primary area…"
              className="text-xs bg-paper h-8"
            />
          </div>
        </ConfirmDialog>

        {/* Request Extension Dialog */}
        <ConfirmDialog
          open={Boolean(selectedExtensionId)}
          onOpenChange={(open) => !open && setSelectedExtensionId(null)}
          title={t("extensionDialogTitle")}
          description={t("extensionDialogDesc")}
          confirmLabel={t("sendExtensionRequest")}
          isLoading={isSendingExtension}
          onConfirm={handleConfirmExtension}
        >
          <div className="py-2 space-y-3">
            {extensionSuccessMsg ? (
              <div className="p-3 bg-success-bg/30 text-success rounded text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                <span>Extension request dispatched to editorial board.</span>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="ext-date" className="text-xs font-medium text-ink">
                    {t("extensionDateLabel")} <span className="text-danger">*</span>
                  </Label>
                  <Input
                    id="ext-date"
                    type="date"
                    value={extensionDate}
                    onChange={(e) => setExtensionDate(e.target.value)}
                    className="text-xs bg-paper h-8"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ext-reason" className="text-xs font-medium text-ink">
                    {t("extensionReasonLabel")}
                  </Label>
                  <Input
                    id="ext-reason"
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    placeholder="e.g. Fieldwork schedule, archive travel…"
                    className="text-xs bg-paper h-8"
                  />
                </div>
              </>
            )}
          </div>
        </ConfirmDialog>
      </div>
    </PortalLayout>
  );
}
