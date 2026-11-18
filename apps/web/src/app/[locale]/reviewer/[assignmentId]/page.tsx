"use client";

import React, { useState, useEffect, use, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { ReviewerSubmissionView, Review } from "@/lib/domain/types";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { PdfViewer } from "@/components/reviewer/PdfViewer";
import { ReviewForm } from "@/components/reviewer/ReviewForm";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  Minimize2,
  FileText,
  Edit3,
  GripVertical,
} from "lucide-react";

interface ReviewWorkspacePageProps {
  params: Promise<{ assignmentId: string; locale: string }>;
}

export default function ReviewWorkspacePage({
  params,
}: ReviewWorkspacePageProps) {
  const resolvedParams = use(params);
  const t = useTranslations("reviewer.workspace");
  const tNav = useTranslations("portalNav");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [assignment, setAssignment] = useState<ReviewerSubmissionView | null>(
    null
  );
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Split-pane layout state
  const [splitPercent, setSplitPercent] = useState<number>(55); // 55% PDF, 45% Form
  const [isDragging, setIsDragging] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<"manuscript" | "review">(
    "manuscript"
  );

  // Conflict Report Dialog
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictReason, setConflictReason] = useState("");
  const [reportingConflict, setReportingConflict] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        setLoading(true);
        const [asgData, revData] = await Promise.all([
          api.getAssignment(resolvedParams.assignmentId),
          api.getReview(resolvedParams.assignmentId),
        ]);

        if (!asgData) {
          setNotFound(true);
          return;
        }

        setAssignment(asgData);
        setReview(revData);
      } catch (err) {
        console.error("Failed to load review workspace:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [resolvedParams.assignmentId]);

  // Handle Drag Resizing of Split Pane
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      if (newPercent >= 30 && newPercent <= 75) {
        setSplitPercent(Math.round(newPercent));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Keyboard navigation for divider
  const handleDividerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setSplitPercent((prev) => Math.max(prev - 5, 30));
    } else if (e.key === "ArrowRight") {
      setSplitPercent((prev) => Math.min(prev + 5, 75));
    }
  };

  // Conflict Report handler
  const handleReportConflict = async () => {
    if (!assignment || !conflictReason.trim()) return;
    try {
      setReportingConflict(true);
      await api.reportConflict(assignment.assignmentId, conflictReason.trim());
      setShowConflictDialog(false);
      router.push("/reviewer");
    } catch (err) {
      console.error("Failed to report conflict:", err);
    } finally {
      setReportingConflict(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout allowedRoles={["reviewer", "editor", "admin"]}>
        <div className="rounded border border-rule bg-paper p-12 text-center text-xs text-muted animate-pulse">
          {tCommon("loading")}
        </div>
      </PortalLayout>
    );
  }

  if (notFound || !assignment) {
    return (
      <PortalLayout allowedRoles={["reviewer", "editor", "admin"]}>
        <div className="rounded border border-rule bg-paper p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-ink">Assignment Not Found</p>
          <p className="text-xs text-muted">
            The requested review assignment does not exist or has been reassigned.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/reviewer")}
            className="text-xs border-rule"
          >
            Back to My Reviews
          </Button>
        </div>
      </PortalLayout>
    );
  }

  const primaryTitle =
    assignment.title[assignment.manuscriptLanguage] ||
    Object.values(assignment.title)[0] ||
    "Anonymized Manuscript";

  return (
    <PortalLayout
      allowedRoles={["reviewer", "editor", "admin"]}
      breadcrumbs={
        isFocusMode
          ? undefined
          : [
              { label: tNav("reviewerReviews"), href: "/reviewer" },
              { label: primaryTitle },
            ]
      }
    >
      <div className={`space-y-4 ${isFocusMode ? "fixed inset-0 z-50 bg-paper-alt p-4 overflow-hidden" : ""}`}>
        {/* Anonymity Banner & Focus Mode Bar */}
        <div className="rounded-[3px] border border-accent/30 bg-paper p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-accent/10 border border-accent/20">
              <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.5} />
            </div>
            <div className="text-xs">
              <span className="font-semibold text-ink">
                Double-Blind Peer Review
              </span>
              <span className="text-muted hidden md:inline">
                {" "}
                • Author identity removed by editorial office
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {/* Conflict of Interest Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConflictDialog(true)}
              className="text-xs h-7 text-danger hover:text-danger hover:bg-danger-bg gap-1.5"
            >
              <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>{t("reportConflict")}</span>
            </Button>

            {/* Focus Mode Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFocusMode((f) => !f)}
              className="text-xs h-7 border-rule gap-1.5"
            >
              {isFocusMode ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
                  <span>{t("focusModeOff")}</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
                  <span>{t("focusModeOn")}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Tab Switcher (< 1024px) */}
        <div className="flex lg:hidden rounded bg-paper p-1 border border-rule gap-1">
          <button
            type="button"
            onClick={() => setMobileActiveTab("manuscript")}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
              mobileActiveTab === "manuscript"
                ? "bg-paper-alt text-ink font-semibold border border-rule"
                : "text-muted hover:text-ink"
            }`}
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{t("manuscriptTab")}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileActiveTab("review")}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
              mobileActiveTab === "review"
                ? "bg-paper-alt text-ink font-semibold border border-rule"
                : "text-muted hover:text-ink"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{t("reviewTab")}</span>
          </button>
        </div>

        {/* Desktop Split Pane Workspace */}
        <div
          ref={containerRef}
          className="relative w-full rounded-[3px] overflow-hidden"
          style={{ height: isFocusMode ? "calc(100vh - 80px)" : "750px" }}
        >
          {/* Mobile Single-Pane Render */}
          <div className="block lg:hidden h-full overflow-y-auto">
            {mobileActiveTab === "manuscript" ? (
              <PdfViewer
                src={assignment.anonymizedPath}
                title={primaryTitle}
                manuscriptLanguage={assignment.manuscriptLanguage}
                className="h-full"
              />
            ) : (
              <div className="h-full overflow-y-auto p-1">
                <ReviewForm
                  assignmentId={assignment.assignmentId}
                  initialReview={review}
                  onReviewSubmitted={(updated) => setReview(updated)}
                />
              </div>
            )}
          </div>

          {/* Desktop Dual-Pane Render */}
          <div className="hidden lg:flex h-full w-full select-none">
            {/* Left Pane: PDF Viewer */}
            <div
              style={{ width: `${splitPercent}%` }}
              className="h-full overflow-hidden"
            >
              <PdfViewer
                src={assignment.anonymizedPath}
                title={primaryTitle}
                manuscriptLanguage={assignment.manuscriptLanguage}
                className="h-full"
              />
            </div>

            {/* Draggable Divider */}
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-valuenow={splitPercent}
              aria-valuemin={30}
              aria-valuemax={75}
              aria-label="Resize panels"
              onMouseDown={handleMouseDown}
              onKeyDown={handleDividerKeyDown}
              className={`w-2.5 bg-paper hover:bg-accent/20 cursor-col-resize transition-colors flex items-center justify-center border-x border-rule group shrink-0 ${
                isDragging ? "bg-accent/30" : ""
              }`}
            >
              <GripVertical
                className="h-4 w-4 text-muted group-hover:text-accent pointer-events-none"
                strokeWidth={1.5}
              />
            </div>

            {/* Right Pane: Review Form */}
            <div
              style={{ width: `${100 - splitPercent}%` }}
              className="h-full overflow-y-auto ps-2 pe-1"
            >
              <ReviewForm
                assignmentId={assignment.assignmentId}
                initialReview={review}
                onReviewSubmitted={(updated) => setReview(updated)}
              />
            </div>
          </div>
        </div>

        {/* Conflict of Interest Dialog */}
        <ConfirmDialog
          open={showConflictDialog}
          onOpenChange={setShowConflictDialog}
          title={t("reportConflictTitle")}
          description={t("reportConflictDesc")}
          confirmLabel="Report and Unassign"
          isDestructive={true}
          isLoading={reportingConflict}
          onConfirm={handleReportConflict}
        >
          <div className="py-2 space-y-1">
            <Label
              htmlFor="conf-reason"
              className="text-xs font-medium text-ink"
            >
              {t("reportConflictReasonLabel")} <span className="text-danger">*</span>
            </Label>
            <Textarea
              id="conf-reason"
              rows={3}
              value={conflictReason}
              onChange={(e) => setConflictReason(e.target.value)}
              placeholder="State whether you recognize the authors, have a close personal/professional relationship, or have competing financial interests…"
              className="text-xs bg-paper leading-relaxed"
              required
            />
          </div>
        </ConfirmDialog>
      </div>
    </PortalLayout>
  );
}
