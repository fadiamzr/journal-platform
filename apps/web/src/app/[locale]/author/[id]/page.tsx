"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type {
  Submission,
  AuthorFeedbackView,
  Locale,
} from "@/lib/domain/types";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timeline } from "@/components/shared/Timeline";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  EyeOff,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  User,
} from "lucide-react";

interface AuthorSubmissionDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
}

type TabKey = "overview" | "files" | "feedback" | "decision" | "revision";

export default function AuthorSubmissionDetailPage({
  params,
}: AuthorSubmissionDetailPageProps) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "overview";

  const t = useTranslations("author.detail");
  const tNav = useTranslations("portalNav");
  const tCommon = useTranslations("common");
  const tRec = useTranslations("recommendation");
  const router = useRouter();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState<AuthorFeedbackView | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [activeLang, setActiveLang] = useState<Locale>("en");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Revision Form State
  const [responseToReviewers, setResponseToReviewers] = useState("");
  const [showResubmitDialog, setShowResubmitDialog] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [showReplaceBlindDialog, setShowReplaceBlindDialog] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const sub = await api.getSubmission(resolvedParams.id);
        if (!sub) {
          setNotFound(true);
          return;
        }
        setSubmission(sub);
        setActiveLang(sub.manuscriptLanguage || "en");

        // Load feedback if decided or revisions requested
        if (
          sub.status === "revisions_requested" ||
          sub.status === "accepted" ||
          sub.status === "rejected" ||
          sub.status === "published"
        ) {
          const fb = await api.getFeedback(sub.id);
          setFeedback(fb);
        }
      } catch (err) {
        console.error("Failed to load submission:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [resolvedParams.id]);

  const handleResubmit = async () => {
    if (!submission || !responseToReviewers.trim()) return;
    try {
      setResubmitting(true);
      const updated = await api.resubmitRevision(
        submission.id,
        responseToReviewers.trim()
      );
      setSubmission(updated);
      setShowResubmitDialog(false);
      setActiveTab("overview");
    } catch (err) {
      console.error("Resubmission failed:", err);
    } finally {
      setResubmitting(false);
    }
  };

  const handleReplaceBlindCopy = async (file: File) => {
    if (!submission) return;
    try {
      const updated = await api.replaceBlindCopy(submission.id, file);
      setSubmission(updated);
      setShowReplaceBlindDialog(false);
    } catch (err) {
      console.error("Failed to replace blind copy:", err);
    }
  };

  if (loading) {
    return (
      <PortalLayout allowedRoles={["author", "editor", "admin"]}>
        <div className="rounded border border-rule bg-paper p-12 text-center text-xs text-muted animate-pulse">
          {tCommon("loading")}
        </div>
      </PortalLayout>
    );
  }

  if (notFound || !submission) {
    return (
      <PortalLayout allowedRoles={["author", "editor", "admin"]}>
        <div className="rounded border border-rule bg-paper p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-ink">Submission Not Found</p>
          <p className="text-xs text-muted">
            The requested submission does not exist or you do not have permission to view it.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/author")}
            className="text-xs border-rule"
          >
            Back to My Submissions
          </Button>
        </div>
      </PortalLayout>
    );
  }

  const primaryTitle =
    submission.title[submission.manuscriptLanguage] ||
    Object.values(submission.title)[0] ||
    "Untitled Manuscript";

  const currentVersion = submission.versions?.find(
    (v) => v.round === submission.currentRound
  );
  const isBlindVerified = currentVersion?.blindCopyVerified ?? false;

  // Build timeline events
  const timelineEvents = [
    {
      id: "created",
      label: "Manuscript Draft Initiated",
      timestamp: submission.createdAt,
      status: "completed" as const,
    },
    {
      id: "submitted",
      label: "Submitted for Review",
      timestamp: submission.submittedAt,
      status: submission.submittedAt ? ("completed" as const) : ("upcoming" as const),
    },
    {
      id: "verified",
      label: "Blind Copy Verification",
      status: isBlindVerified
        ? ("completed" as const)
        : submission.status === "submitted"
        ? ("current" as const)
        : ("upcoming" as const),
    },
    {
      id: "in_review",
      label: "Double-Blind Peer Review",
      status:
        submission.status === "in_review"
          ? ("current" as const)
          : submission.status === "revisions_requested" ||
            submission.status === "accepted" ||
            submission.status === "rejected" ||
            submission.status === "published"
          ? ("completed" as const)
          : ("upcoming" as const),
    },
    {
      id: "decided",
      label:
        submission.status === "revisions_requested"
          ? "Revisions Requested"
          : submission.status === "accepted"
          ? "Accepted for Publication"
          : submission.status === "rejected"
          ? "Declined"
          : "Editorial Decision",
      timestamp: submission.decidedAt,
      status: submission.decidedAt
        ? ("completed" as const)
        : ("upcoming" as const),
    },
  ];

  const tabs: Array<{ id: TabKey; label: string; badge?: string | number }> = [
    { id: "overview", label: t("tabOverview") },
    { id: "files", label: t("tabFiles") },
    {
      id: "feedback",
      label: t("tabFeedback"),
      badge: feedback?.reviews?.length ? feedback.reviews.length : undefined,
    },
    { id: "decision", label: t("tabDecision") },
  ];

  if (submission.status === "revisions_requested") {
    tabs.push({ id: "revision", label: t("tabRevision") });
  }

  const renderScoreMeter = (label: string, score: number) => {
    const percent = (score / 5) * 100;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{label}</span>
          <span className="font-mono font-medium text-ink">{score} / 5</span>
        </div>
        <div
          role="progressbar"
          aria-label={label}
          aria-valuenow={score}
          aria-valuemin={1}
          aria-valuemax={5}
          className="h-2 w-full rounded-full bg-paper-alt overflow-hidden border border-rule/50"
        >
          <div
            className={`h-full transition-all rounded-full ${
              score >= 4
                ? "bg-success"
                : score === 3
                ? "bg-amber-600"
                : "bg-danger"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <PortalLayout
      allowedRoles={["author", "editor", "admin"]}
      breadcrumbs={[
        { label: tNav("authorSubmissions"), href: "/author" },
        { label: primaryTitle },
      ]}
    >
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={submission.status} />
                <Badge variant="outline" className="text-[11px] font-mono">
                  {t("roundLabel", { round: submission.currentRound })}
                </Badge>
                <span className="text-xs text-muted font-mono">{submission.id}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink leading-snug">
                {primaryTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                {submission.submittedAt && (
                  <span>
                    {t("submittedOn", {
                      date: new Date(submission.submittedAt).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" }
                      ),
                    })}
                  </span>
                )}
                <span>•</span>
                <span className="uppercase font-mono">
                  Language: {submission.manuscriptLanguage}
                </span>
                {submission.doi && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-accent">DOI: {submission.doi}</span>
                  </>
                )}
              </div>
            </div>

            {submission.status === "revisions_requested" && (
              <Button
                onClick={() => setActiveTab("revision")}
                className="text-xs gap-1.5 bg-amber-700 hover:bg-amber-800 text-white shrink-0 self-start shadow-xs"
              >
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{t("tabRevision")}</span>
              </Button>
            )}
          </div>

          {/* Timeline */}
          <div className="border-t border-rule pt-4">
            <Timeline events={timelineEvents} />
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label="Submission Views"
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
              {tab.badge !== undefined && (
                <span className="text-[10px] bg-paper-alt border border-rule px-1.5 py-0.2 rounded-full font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB 1: OVERVIEW ─────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Language Switcher for Metadata */}
              <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-rule pb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                    Manuscript Metadata
                  </h2>
                  <div
                    role="tablist"
                    aria-label="Language"
                    className="inline-flex gap-1 rounded bg-paper-alt p-0.5 border border-rule"
                  >
                    {(["en", "fr", "ar"] as Locale[]).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        role="tab"
                        aria-selected={loc === activeLang}
                        onClick={() => setActiveLang(loc)}
                        className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                          loc === activeLang
                            ? "bg-paper text-ink font-semibold border border-rule shadow-xs"
                            : "text-muted hover:text-ink"
                        }`}
                      >
                        {loc.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-muted block mb-1">Title</span>
                    <p
                      dir={activeLang === "ar" ? "rtl" : "ltr"}
                      className="text-sm font-heading font-semibold text-ink"
                    >
                      {submission.title[activeLang] || (
                        <span className="italic text-muted font-normal text-xs">
                          Not provided in {activeLang.toUpperCase()}
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-muted block mb-1">Abstract</span>
                    <p
                      dir={activeLang === "ar" ? "rtl" : "ltr"}
                      className="text-xs text-ink/90 leading-relaxed font-body"
                    >
                      {submission.abstract[activeLang] || (
                        <span className="italic text-muted text-xs">
                          Not provided in {activeLang.toUpperCase()}
                        </span>
                      )}
                    </p>
                  </div>

                  {submission.keywords[activeLang] &&
                    submission.keywords[activeLang]!.length > 0 && (
                      <div>
                        <span className="text-xs text-muted block mb-1.5">
                          Keywords
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {submission.keywords[activeLang]!.map((kw, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] bg-paper-alt border border-rule text-ink px-2 py-0.5 rounded"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Sidebar: Authors and Submission Info */}
            <div className="space-y-6">
              <div className="rounded-[3px] border border-rule bg-paper p-5 space-y-4 shadow-xs">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-rule pb-2">
                  Contributing Authors ({submission.authors.length})
                </h2>
                <div className="space-y-3">
                  {submission.authors.map((author, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="font-medium text-ink flex items-center justify-between">
                        <span>{author.fullName}</span>
                        {author.isCorresponding && (
                          <span className="text-[10px] bg-accent/10 text-accent font-medium px-1.5 py-0.2 rounded-full">
                            Corresponding
                          </span>
                        )}
                      </div>
                      {author.affiliations && author.affiliations.length > 0 && (
                        <div className="text-[11px] text-muted">
                          {author.affiliations.join("; ")}
                        </div>
                      )}
                      {author.orcid && (
                        <div className="text-[10px] font-mono text-muted/80">
                          ORCID: {author.orcid}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cover Letter / Notes if provided */}
              {submission.coverLetter && (
                <div className="rounded-[3px] border border-rule bg-paper p-5 space-y-2 shadow-xs">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Cover Letter
                  </h2>
                  <p className="text-xs text-ink/80 leading-relaxed italic">
                    &ldquo;{submission.coverLetter}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: FILES ────────────────────────────────────────────────────── */}
        {activeTab === "files" && (
          <div className="space-y-4">
            <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted border-b border-rule pb-2">
                Version Round {submission.currentRound} Files
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Manuscript File */}
                <div className="rounded border border-rule p-4 space-y-3 bg-paper-alt/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-accent" strokeWidth={1.5} />
                      <div>
                        <div className="text-xs font-semibold text-ink">
                          {t("manuscriptFile")}
                        </div>
                        <div className="text-[11px] text-muted">
                          {(
                            (currentVersion?.sizeBytes || 480000) / 1024
                          ).toFixed(0)}{" "}
                          KB • Uploaded for editorial record
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted italic">
                    Includes author names, affiliations, and acknowledgments.
                  </div>
                </div>

                {/* Anonymized Blind Copy File */}
                <div className="rounded border border-rule p-4 space-y-3 bg-paper-alt/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <EyeOff className="h-5 w-5 text-muted" strokeWidth={1.5} />
                      <div>
                        <div className="text-xs font-semibold text-ink">
                          {t("blindCopyFile")}
                        </div>
                        <div className="text-[11px] text-muted">
                          {(
                            (currentVersion?.sizeBytes || 450000) / 1024
                          ).toFixed(0)}{" "}
                          KB • Distributed to reviewers
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {isBlindVerified ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-success font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>{t("blindVerifiedBadge")}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>{t("blindPendingBadge")}</span>
                      </span>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowReplaceBlindDialog(true)}
                      className="text-xs h-7 border-rule"
                    >
                      {t("replaceBlindCopy")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Replace Blind Copy Dialog */}
            <ConfirmDialog
              open={showReplaceBlindDialog}
              onOpenChange={setShowReplaceBlindDialog}
              title={t("replaceBlindCopy")}
              description="Upload a new anonymized PDF file to replace the existing blind copy. The new file will require editorial re-verification."
              confirmLabel="Done"
              showCancel={false}
              onConfirm={() => {}}
            >
              <div className="pt-2">
                <FileDropzone
                  onFileSelect={handleReplaceBlindCopy}
                  label="Upload New Anonymized PDF"
                  hint="PDF only, max 50 MB"
                />
              </div>
            </ConfirmDialog>
          </div>
        )}

        {/* ── TAB 3: FEEDBACK ─────────────────────────────────────────────────── */}
        {activeTab === "feedback" && (
          <div className="space-y-6">
            {!feedback || feedback.reviews.length === 0 ? (
              <div className="rounded border border-rule bg-paper p-8 text-center space-y-2">
                <Clock className="h-6 w-6 text-muted mx-auto" strokeWidth={1.5} />
                <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                  {t("feedbackAwaiting")}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-base font-heading font-semibold text-ink">
                    {t("tabFeedback")} (Round {submission.currentRound})
                  </h2>
                  <p className="text-xs text-muted">
                    Evaluations provided by independent double-blind peer reviewers.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {feedback.reviews.map((rev, idx) => (
                    <div
                      key={idx}
                      className="rounded-[3px] border border-rule bg-paper p-6 space-y-5 shadow-xs"
                    >
                      {/* Reviewer Header */}
                      <div className="flex items-center justify-between border-b border-rule pb-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted" strokeWidth={1.5} />
                          <span className="text-sm font-semibold text-ink">
                            {t("reviewerLabel", { number: idx + 1 })}
                          </span>
                        </div>
                        <Badge
                          variant={
                            rev.recommendation === "accept"
                              ? "success"
                              : rev.recommendation === "reject"
                              ? "danger"
                              : "outline"
                          }
                          className="capitalize text-xs"
                        >
                          {tRec(rev.recommendation)}
                        </Badge>
                      </div>

                      {/* Score Meters */}
                      <div className="space-y-3 bg-paper-alt/40 p-4 rounded border border-rule">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                          {t("scoresHeading")}
                        </div>
                        {renderScoreMeter(
                          t("scoreOriginality"),
                          rev.scores.originality
                        )}
                        {renderScoreMeter(
                          t("scoreMethodology"),
                          rev.scores.methodology
                        )}
                        {renderScoreMeter(
                          t("scoreClarity"),
                          rev.scores.clarity
                        )}
                        {renderScoreMeter(
                          t("scoreSignificance"),
                          rev.scores.significance
                        )}
                        {renderScoreMeter(
                          t("scoreRelevance"),
                          rev.scores.relevance
                        )}
                      </div>

                      {/* Comments to Author */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
                          {t("commentsToAuthor")}
                        </h3>
                        <p className="text-xs text-ink/90 leading-relaxed whitespace-pre-line font-body bg-paper-alt/20 p-3 rounded border border-rule">
                          {rev.commentsToAuthor}
                        </p>
                      </div>

                      <div className="text-[10px] text-muted text-end font-mono">
                        Submitted:{" "}
                        {new Date(rev.submittedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: DECISION ─────────────────────────────────────────────────── */}
        {activeTab === "decision" && (
          <div className="space-y-4">
            <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-rule pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                    {t("tabDecision")}
                  </h2>
                  <StatusBadge status={submission.status} />
                </div>
                {submission.decidedAt && (
                  <span className="text-xs text-muted font-mono">
                    {t("decisionDate", {
                      date: new Date(submission.decidedAt).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" }
                      ),
                    })}
                  </span>
                )}
              </div>

              {submission.decisionNote ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-ink">
                    {t("decisionNoteLabel")}
                  </Label>
                  <p className="text-xs text-ink leading-relaxed whitespace-pre-line bg-paper-alt/40 p-4 rounded border border-rule">
                    {submission.decisionNote}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted">
                  An editorial decision has not yet been rendered on this submission.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: REVISION ─────────────────────────────────────────────────── */}
        {activeTab === "revision" && submission.status === "revisions_requested" && (
          <div className="rounded-[3px] border border-amber-600/30 bg-paper p-6 space-y-6 shadow-xs">
            <div className="space-y-1 border-b border-rule pb-4">
              <h2 className="text-base font-heading font-semibold text-ink">
                {t("revisionHeading", { round: submission.currentRound + 1 })}
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                {t("revisionDesc")}
              </p>
            </div>

            {/* Response to reviewers textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="resp-rev"
                  className="text-xs font-semibold text-ink"
                >
                  {t("responseToReviewersLabel")}{" "}
                  <span className="text-danger">*</span>
                </Label>
                <span className="text-[11px] text-muted font-mono">
                  {responseToReviewers.trim().length} characters
                </span>
              </div>
              <Textarea
                id="resp-rev"
                rows={8}
                value={responseToReviewers}
                onChange={(e) => setResponseToReviewers(e.target.value)}
                placeholder={t("responseToReviewersPlaceholder")}
                className="text-xs bg-paper leading-relaxed font-body"
                required
              />
            </div>

            {/* File uploads for revised version */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-ink">
                  Upload Revised Full Manuscript (PDF)
                </Label>
                <FileDropzone
                  onFileSelect={(file) => api.uploadManuscript(submission.id, file)}
                  label="Upload Revised Manuscript"
                  hint="PDF up to 50 MB"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-ink">
                  Upload Revised Anonymized Blind Copy (PDF)
                </Label>
                <FileDropzone
                  onFileSelect={(file) => api.uploadBlindCopy(submission.id, file)}
                  label="Upload Revised Blind Copy"
                  hint="Anonymized PDF up to 50 MB"
                />
              </div>
            </div>

            {/* Resubmit Action */}
            <div className="pt-4 border-t border-rule flex justify-end">
              <Button
                onClick={() => setShowResubmitDialog(true)}
                disabled={!responseToReviewers.trim() || resubmitting}
                className="text-xs gap-2 px-6 bg-accent hover:bg-accent/90 text-white"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>
                  {t("resubmitButton", {
                    round: submission.currentRound + 1,
                  })}
                </span>
              </Button>
            </div>

            {/* Confirm Resubmission Dialog */}
            <ConfirmDialog
              open={showResubmitDialog}
              onOpenChange={setShowResubmitDialog}
              title={t("confirmResubmitTitle")}
              description={t("confirmResubmitDesc", {
                round: submission.currentRound + 1,
              })}
              confirmLabel="Confirm and Resubmit"
              onConfirm={handleResubmit}
            />
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
