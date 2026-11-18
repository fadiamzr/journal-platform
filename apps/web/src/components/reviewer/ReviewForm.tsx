"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type {
  Review,
  ReviewScores,
  Recommendation,
} from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Lock,
  CheckCircle2,
  Send,
  Save,
} from "lucide-react";

interface ReviewFormProps {
  assignmentId: string;
  initialReview?: Review | null;
  onReviewSubmitted?: (review: Review) => void;
  className?: string;
}

const SCORE_DESCRIPTORS: Record<number, string> = {
  1: "1 - Unsatisfactory",
  2: "2 - Marginal",
  3: "3 - Acceptable",
  4: "4 - Strong",
  5: "5 - Exceptional",
};

export function ReviewForm({
  assignmentId,
  initialReview,
  onReviewSubmitted,
  className = "",
}: ReviewFormProps) {
  const t = useTranslations("reviewer.workspace");
  const tRec = useTranslations("recommendation");

  const isReadOnly = Boolean(initialReview?.submittedAt && !initialReview.isDraft);

  const [scores, setScores] = useState<ReviewScores>({
    originality: initialReview?.scores?.originality || 0,
    methodology: initialReview?.scores?.methodology || 0,
    clarity: initialReview?.scores?.clarity || 0,
    significance: initialReview?.scores?.significance || 0,
    relevance: initialReview?.scores?.relevance || 0,
  });

  const [recommendation, setRecommendation] = useState<Recommendation | "">(
    initialReview?.recommendation || ""
  );
  const [commentsToAuthor, setCommentsToAuthor] = useState(
    initialReview?.commentsToAuthor || ""
  );
  const [confidentialComments, setConfidentialComments] = useState(
    initialReview?.confidentialCommentsToEditor || ""
  );

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReview, setSubmittedReview] = useState<Review | null>(
    isReadOnly ? initialReview || null : null
  );

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mark changes dirty
  const markDirty = () => {
    if (!isReadOnly) setHasChanges(true);
  };

  // Draft save function
  const saveDraft = useCallback(async () => {
    if (isReadOnly) return;
    try {
      setSaving(true);
      await api.saveReviewDraft(assignmentId, {
        scores,
        recommendation: recommendation ? (recommendation as Recommendation) : undefined,
        commentsToAuthor,
        confidentialCommentsToEditor: confidentialComments,
      });
      setLastSaved(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save review draft:", err);
    } finally {
      setSaving(false);
    }
  }, [
    isReadOnly,
    assignmentId,
    scores,
    recommendation,
    commentsToAuthor,
    confidentialComments,
  ]);

  // Debounced autosave
  useEffect(() => {
    if (!hasChanges || isReadOnly) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      saveDraft();
    }, 2500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [hasChanges, isReadOnly, saveDraft]);

  // Completeness calculation
  const scoreKeys: Array<keyof ReviewScores> = [
    "originality",
    "methodology",
    "clarity",
    "significance",
    "relevance",
  ];
  const filledScoresCount = scoreKeys.filter((k) => scores[k] > 0).length;
  const isRecFilled = Boolean(recommendation);
  const isCommentsFilled = commentsToAuthor.trim().length >= 20;

  // Percentage calculation: 50% for scores (10% each), 20% for rec, 30% for comments
  const percentComplete = Math.min(
    Math.round(
      (filledScoresCount / 5) * 50 +
        (isRecFilled ? 20 : 0) +
        (isCommentsFilled ? 30 : 0)
    ),
    100
  );

  const isFormComplete = percentComplete === 100;

  const handleFinalSubmit = async () => {
    if (!isFormComplete || !recommendation) return;
    try {
      setSubmitting(true);
      const res = await api.submitReview(assignmentId, {
        scores,
        recommendation: recommendation as Recommendation,
        commentsToAuthor: commentsToAuthor.trim(),
        confidentialCommentsToEditor: confidentialComments.trim(),
      });
      setSubmittedReview(res);
      setShowSubmitDialog(false);
      onReviewSubmitted?.(res);
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const criteriaList: Array<{
    key: keyof ReviewScores;
    title: string;
    help: string;
  }> = [
    {
      key: "originality",
      title: t("criterion1"),
      help: t("criterion1Help"),
    },
    {
      key: "methodology",
      title: t("criterion2"),
      help: t("criterion2Help"),
    },
    {
      key: "clarity",
      title: t("criterion3"),
      help: t("criterion3Help"),
    },
    {
      key: "significance",
      title: t("criterion4"),
      help: t("criterion4Help"),
    },
    {
      key: "relevance",
      title: t("criterion5"),
      help: t("criterion5Help"),
    },
  ];

  const wordCount = commentsToAuthor.trim()
    ? commentsToAuthor.trim().split(/\s+/).length
    : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Read-Only Notice if already submitted */}
      {submittedReview?.submittedAt && !submittedReview.isDraft && (
        <div className="rounded border border-success/30 bg-success-bg/20 p-4 text-xs flex items-center justify-between text-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="font-medium text-ink">
              {t("reviewSubmittedNotice", {
                date: new Date(submittedReview.submittedAt).toLocaleDateString(
                  undefined,
                  { year: "numeric", month: "short", day: "numeric" }
                ),
              })}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase font-bold text-success border border-success/40 px-2 py-0.5 rounded">
            Submitted
          </span>
        </div>
      )}

      {/* Header & Autosave & Progress */}
      <div className="rounded-[3px] border border-rule bg-paper p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rule pb-3">
          <div>
            <h2 className="text-sm font-heading font-semibold text-ink">
              {t("reviewTab")}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
              {lastSaved && (
                <span className="flex items-center gap-1 font-mono text-[11px] text-muted">
                  <Save className="h-3 w-3 text-success" strokeWidth={1.5} />
                  Saved at {lastSaved}
                </span>
              )}
              {saving && (
                <span className="text-accent text-[11px] animate-pulse">
                  Saving draft…
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span
              className={`text-xs font-mono font-medium ${
                isFormComplete ? "text-success" : "text-muted"
              }`}
            >
              {t("completeness", { percent: percentComplete })}
            </span>
            <div
              role="progressbar"
              aria-label="Review completion"
              aria-valuenow={percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-24 rounded-full bg-paper-alt border border-rule overflow-hidden"
            >
              <div
                className={`h-full transition-all ${
                  isFormComplete ? "bg-success" : "bg-accent"
                }`}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── SECTION 1: 5 SCORING CRITERIA ───────────────────────────────────── */}
        <div className="space-y-4 pt-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("criteriaHeading")}
          </div>

          {criteriaList.map((crit) => {
            const currentScore = scores[crit.key];
            return (
              <div
                key={crit.key}
                className="p-3.5 rounded border border-rule bg-paper-alt/30 space-y-2.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-ink">
                      {crit.title}
                    </span>
                    <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                      {crit.help}
                    </p>
                  </div>
                  {currentScore > 0 && (
                    <span className="text-[11px] font-mono font-medium text-ink shrink-0 bg-paper border border-rule px-2 py-0.5 rounded">
                      {SCORE_DESCRIPTORS[currentScore]}
                    </span>
                  )}
                </div>

                {/* 1-5 Segmented Buttons */}
                <div
                  role="radiogroup"
                  aria-label={crit.title}
                  className="grid grid-cols-5 gap-1.5 pt-1"
                >
                  {[1, 2, 3, 4, 5].map((val) => {
                    const isSelected = currentScore === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={isReadOnly}
                        onClick={() => {
                          setScores((prev) => ({ ...prev, [crit.key]: val }));
                          markDirty();
                        }}
                        className={`py-1.5 rounded text-xs font-mono font-medium transition-colors border ${
                          isSelected
                            ? "bg-ink text-paper border-ink font-bold shadow-xs"
                            : "bg-paper text-muted hover:text-ink border-rule hover:bg-paper-alt"
                        } ${isReadOnly ? "cursor-default opacity-85" : "cursor-pointer"}`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── SECTION 2: RECOMMENDATION ───────────────────────────────────────── */}
        <div className="space-y-2 pt-3 border-t border-rule">
          <Label
            htmlFor="rev-rec"
            className="text-xs font-semibold text-ink uppercase tracking-wider block"
          >
            {t("recommendationHeading")} <span className="text-danger">*</span>
          </Label>

          <select
            id="rev-rec"
            value={recommendation}
            disabled={isReadOnly}
            onChange={(e) => {
              setRecommendation(e.target.value as Recommendation);
              markDirty();
            }}
            className="w-full text-xs h-9 rounded border border-rule bg-paper px-3 text-ink focus:outline-none focus:ring-1 focus:ring-accent font-medium"
            required
          >
            <option value="" disabled>
              Select your final publication recommendation…
            </option>
            <option value="accept">{tRec("accept")}</option>
            <option value="minor_revisions">{tRec("minor_revisions")}</option>
            <option value="major_revisions">{tRec("major_revisions")}</option>
            <option value="reject">{tRec("reject")}</option>
          </select>
        </div>

        {/* ── SECTION 3: COMMENTS TO AUTHOR ────────────────────────────────────── */}
        <div className="space-y-2 pt-3 border-t border-rule">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="comm-auth"
              className="text-xs font-semibold text-ink uppercase tracking-wider"
            >
              {t("commentsToAuthorHeading")}{" "}
              <span className="text-danger">*</span>
            </Label>
            <span
              className={`text-[11px] font-mono ${
                wordCount < 20 ? "text-amber-700" : "text-muted"
              }`}
            >
              {wordCount} words
            </span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            {t("commentsToAuthorGuidance")}
          </p>
          <Textarea
            id="comm-auth"
            rows={7}
            value={commentsToAuthor}
            disabled={isReadOnly}
            onChange={(e) => {
              setCommentsToAuthor(e.target.value);
              markDirty();
            }}
            placeholder="Detail your evaluation of arguments, methodology, literature engagement, and recommended revisions…"
            className="text-xs bg-paper leading-relaxed font-body"
            required
          />
        </div>

        {/* ── SECTION 4: CONFIDENTIAL COMMENTS TO EDITOR ─────────────────────── */}
        <div className="rounded-[3px] border border-accent/30 bg-accent/5 p-4 space-y-2 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink uppercase tracking-wider">
            <Lock className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            <span>{t("confidentialHeading")}</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            {t("confidentialGuidance")}
          </p>
          <Textarea
            id="comm-editor"
            rows={4}
            value={confidentialComments}
            disabled={isReadOnly}
            onChange={(e) => {
              setConfidentialComments(e.target.value);
              markDirty();
            }}
            placeholder="Private notes for the editors regarding potential ethical concerns, prioritization, or confidential reservations…"
            className="text-xs bg-paper leading-relaxed font-body border-accent/20"
          />
        </div>

        {/* Submit Actions */}
        {!isReadOnly && (
          <div className="pt-4 border-t border-rule flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={saveDraft}
              disabled={saving || !hasChanges}
              className="text-xs border-rule gap-1.5"
            >
              <Save className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
              <span>Save Draft</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setShowSubmitDialog(true)}
              disabled={!isFormComplete || submitting}
              className="text-xs gap-1.5 px-6 shadow-xs"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>{t("submitReviewButton")}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Confirm Final Review Submission Dialog */}
      <ConfirmDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        title={t("confirmSubmitTitle")}
        description={t("confirmSubmitDesc")}
        confirmLabel={t("submitReviewButton")}
        isLoading={submitting}
        onConfirm={handleFinalSubmit}
      />
    </div>
  );
}
