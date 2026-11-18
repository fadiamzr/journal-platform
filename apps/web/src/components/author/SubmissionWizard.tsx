"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import type {
  Submission,
  Locale,
  MultilingualText,
  Keywords,
  Author,
  SubmissionDeclarations,
} from "@/lib/domain/types";
import { api } from "@/lib/api";
import { Stepper, StepItem } from "@/components/shared/Stepper";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { AuthorsRepeater } from "./AuthorsRepeater";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timeline } from "@/components/shared/Timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";

interface SubmissionWizardProps {
  initialSubmission: Submission;
}

const DEFAULT_DECLARATIONS: SubmissionDeclarations = {
  originalWork: false,
  notUnderConsideration: false,
  ethicalCompliance: false,
  licenseAgreement: false,
  conflictOfInterest: false,
};

export function SubmissionWizard({ initialSubmission }: SubmissionWizardProps) {
  const router = useRouter();
  const t = useTranslations("author.wizard");
  const tCommon = useTranslations("common");

  const [submission, setSubmission] = useState<Submission>(initialSubmission);
  const [currentStep, setCurrentStep] = useState<number>(
    initialSubmission.step ? Math.min(Math.max(initialSubmission.step - 1, 0), 4) : 0
  );

  // Form State
  const [manuscriptLang, setManuscriptLang] = useState<Locale>(
    submission.manuscriptLanguage || "en"
  );
  const [activeTabLang, setActiveTabLang] = useState<Locale>(
    submission.manuscriptLanguage || "en"
  );
  const [title, setTitle] = useState<MultilingualText>(submission.title || {});
  const [abstract, setAbstract] = useState<MultilingualText>(
    submission.abstract || {}
  );
  const [keywords, setKeywords] = useState<Keywords>(submission.keywords || {});
  const [keywordInput, setKeywordInput] = useState("");
  const [authors, setAuthors] = useState<Author[]>(
    submission.authors && submission.authors.length > 0
      ? submission.authors
      : [
          {
            fullName: "",
            affiliations: [],
            email: "",
            isCorresponding: true,
          },
        ]
  );
  const [declarations, setDeclarations] = useState<SubmissionDeclarations>(
    submission.declarations || DEFAULT_DECLARATIONS
  );
  const [coverLetter, setCoverLetter] = useState(submission.coverLetter || "");
  const [suggestedReviewers, setSuggestedReviewers] = useState(
    submission.suggestedReviewers || ""
  );
  const [excludedReviewers, setExcludedReviewers] = useState(
    submission.excludedReviewers || ""
  );

  // UI & Lifecycle States
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<string>(
    submission.extractionStatus || "not_started"
  );
  const [showRerunDialog, setShowRerunDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const steps: StepItem[] = [
    { id: "manuscript", label: t("stepperManuscript") },
    { id: "blind-copy", label: t("stepperBlindCopy") },
    { id: "details", label: t("stepperDetails") },
    { id: "declarations", label: t("stepperDeclarations") },
    { id: "review", label: t("stepperReviewSubmit") },
  ];

  // Current version check
  const currentVer = submission.versions?.find(
    (v) => v.round === submission.currentRound
  );
  const hasManuscript = Boolean(currentVer?.hasManuscript);
  const hasBlindCopy = Boolean(currentVer?.hasBlindCopy);

  // Mark changes dirty
  const markDirty = () => setHasUnsavedChanges(true);

  // Save draft payload
  const persistDraft = useCallback(
    async (stepNum?: number) => {
      try {
        setSaving(true);
        const updated = await api.saveDraft(submission.id, {
          title,
          abstract,
          keywords,
          manuscriptLanguage: manuscriptLang,
          authors,
          declarations,
          coverLetter,
          suggestedReviewers,
          excludedReviewers,
          step: stepNum ?? currentStep + 1,
        });
        setSubmission(updated);
        setLastSaved(
          new Date().toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Failed to save draft:", err);
      } finally {
        setSaving(false);
      }
    },
    [
      submission.id,
      title,
      abstract,
      keywords,
      manuscriptLang,
      authors,
      declarations,
      coverLetter,
      suggestedReviewers,
      excludedReviewers,
      currentStep,
    ]
  );

  // Autosave debouncer
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      persistDraft();
    }, 3000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [hasUnsavedChanges, persistDraft]);

  // Unsaved changes browser guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Step 1: Manuscript File Select
  const handleManuscriptSelect = async (file: File) => {
    try {
      setSaving(true);
      const updated = await api.uploadManuscript(submission.id, file);
      setSubmission(updated);

      // Trigger AI Extraction automatically if not yet extracted
      if (extractionStatus === "not_started") {
        runAiExtraction();
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Blind Copy Select
  const handleBlindCopySelect = async (file: File) => {
    try {
      setSaving(true);
      const updated = await api.uploadBlindCopy(submission.id, file);
      setSubmission(updated);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Run AI Extraction
  const runAiExtraction = async () => {
    try {
      setExtractionLoading(true);
      setExtractionStatus("pending");
      const result = await api.runExtraction(submission.id);

      if (result.status === "succeeded") {
        setExtractionStatus("succeeded");
        const extractedTitle =
          (result.title ? result.title[manuscriptLang] || Object.values(result.title)[0] : "") ||
          result.data?.title ||
          "";
        const extractedAbstract =
          (result.abstract ? result.abstract[manuscriptLang] || Object.values(result.abstract)[0] : "") ||
          result.data?.abstract ||
          "";
        const extractedKw =
          (result.keywords ? result.keywords[manuscriptLang] : []) ||
          result.data?.keywords ||
          [];
        const extractedAuth = result.authors || result.data?.authors || [];

        // Pre-fill fields if currently empty
        if (extractedTitle) {
          setTitle((prev) => ({
            ...prev,
            [manuscriptLang]: prev[manuscriptLang] || extractedTitle,
          }));
        }
        if (extractedAbstract) {
          setAbstract((prev) => ({
            ...prev,
            [manuscriptLang]: prev[manuscriptLang] || extractedAbstract,
          }));
        }
        if (extractedKw && extractedKw.length > 0) {
          setKeywords((prev) => ({
            ...prev,
            [manuscriptLang]:
              prev[manuscriptLang] && prev[manuscriptLang]!.length > 0
                ? prev[manuscriptLang]
                : extractedKw,
          }));
        }
        if (extractedAuth && extractedAuth.length > 0) {
          setAuthors((prev) =>
            prev.length === 1 && !prev[0].fullName
              ? extractedAuth
              : prev
          );
        }
        markDirty();
      } else {
        setExtractionStatus("failed");
      }
    } catch {
      setExtractionStatus("failed");
    } finally {
      setExtractionLoading(false);
    }
  };

  // Step navigation & validation
  const validateStep = (stepIdx: number): boolean => {
    const errors: string[] = [];

    if (stepIdx === 0) {
      if (!hasManuscript) {
        errors.push("Please upload your complete manuscript file before continuing.");
      }
    } else if (stepIdx === 1) {
      if (!hasBlindCopy) {
        errors.push("Please upload an anonymized blind copy file before continuing.");
      }
    } else if (stepIdx === 2) {
      const activeTitle = title[manuscriptLang]?.trim();
      const activeAbstract = abstract[manuscriptLang]?.trim();
      const wordCount = activeAbstract ? activeAbstract.split(/\s+/).filter(Boolean).length : 0;

      if (!activeTitle) {
        errors.push(`A manuscript title in ${manuscriptLang.toUpperCase()} is required.`);
      }
      if (!activeAbstract || wordCount < 50) {
        errors.push(`An abstract of at least 50 words in ${manuscriptLang.toUpperCase()} is required.`);
      }
      if (!authors || authors.length === 0 || !authors[0].fullName.trim()) {
        errors.push("At least one author with a full name is required.");
      }
    } else if (stepIdx === 3) {
      if (
        !declarations.originalWork ||
        !declarations.notUnderConsideration ||
        !declarations.ethicalCompliance ||
        !declarations.licenseAgreement ||
        !declarations.conflictOfInterest
      ) {
        errors.push("All 5 declaration compliance checkboxes must be agreed to.");
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleNextStep = async () => {
    if (!validateStep(currentStep)) return;
    const nextIdx = currentStep + 1;
    setCurrentStep(nextIdx);
    await persistDraft(nextIdx + 1);
  };

  const handleBackStep = async () => {
    const prevIdx = Math.max(currentStep - 1, 0);
    setCurrentStep(prevIdx);
    await persistDraft(prevIdx + 1);
  };

  const jumpToStep = (stepIdx: number) => {
    setCurrentStep(stepIdx);
    persistDraft(stepIdx + 1);
  };

  // Keywords management
  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    const currentList = keywords[activeTabLang] || [];
    if (!currentList.includes(trimmed)) {
      setKeywords((prev) => ({
        ...prev,
        [activeTabLang]: [...currentList, trimmed],
      }));
      markDirty();
    }
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    const currentList = keywords[activeTabLang] || [];
    setKeywords((prev) => ({
      ...prev,
      [activeTabLang]: currentList.filter((k) => k !== kw),
    }));
    markDirty();
  };

  // Submit Final
  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      await persistDraft();
      const submitted = await api.submit(submission.id);
      setSubmission(submitted);
      setIsSubmittedSuccess(true);
      setShowSubmitDialog(false);
    } catch (err) {
      console.error("Submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDraft = async () => {
    try {
      await api.deleteDraft(submission.id);
      router.push("/author");
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  };

  // If successfully submitted, render confirmation screen
  if (isSubmittedSuccess) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <div className="rounded-[3px] border border-success/40 bg-paper p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg border border-success/30">
            <Check className="h-7 w-7 text-success" strokeWidth={2} />
          </div>
          <h1 className="text-xl font-heading font-semibold text-ink">
            {t("submitSuccessTitle")}
          </h1>
          <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
            {t("submitSuccessDesc")}
          </p>

          <div className="p-4 bg-paper-alt rounded border border-rule text-start max-w-md mx-auto text-xs space-y-1">
            <div className="font-semibold text-ink">
              {submission.title[submission.manuscriptLanguage] || "Manuscript"}
            </div>
            <div className="text-muted flex items-center gap-2">
              <span>ID: {submission.id}</span>
              <span>•</span>
              <StatusBadge status="submitted" />
            </div>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <Button
              onClick={() => router.push(`/author/${submission.id}`)}
              className="text-xs gap-1.5"
            >
              <span>{t("viewSubmission")}</span>
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/author")}
              className="text-xs border-rule"
            >
              {tCommon("all")} Submissions
            </Button>
          </div>
        </div>

        <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Submission Lifecycle
          </h2>
          <Timeline
            events={[
              {
                id: "1",
                label: "Manuscript Draft Initiated",
                timestamp: submission.createdAt,
                status: "completed",
              },
              {
                id: "2",
                label: "Submitted for Editorial Verification",
                timestamp: new Date().toISOString(),
                status: "current",
              },
              {
                id: "3",
                label: "Blind Copy Verification",
                status: "upcoming",
              },
              {
                id: "4",
                label: "Peer Review Assignment",
                status: "upcoming",
              },
            ]}
          />
        </div>
      </div>
    );
  }

  // Active abstract word count
  const activeAbstractText = abstract[activeTabLang] || "";
  const wordCount = activeAbstractText.trim()
    ? activeAbstractText.trim().split(/\s+/).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Autosave Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-4">
        <div>
          <h1 className="text-xl font-heading font-semibold text-ink">
            {submission.title[manuscriptLang] || "New Manuscript Submission"}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted">
            <span>ID: {submission.id}</span>
            <span>•</span>
            <StatusBadge status="draft" />
            {lastSaved && (
              <>
                <span>•</span>
                <span className="text-[11px] text-muted flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3 w-3 text-success" strokeWidth={1.5} />
                  {t("savedAt", { time: lastSaved })}
                </span>
              </>
            )}
            {saving && (
              <>
                <span>•</span>
                <span className="text-[11px] text-accent animate-pulse">
                  Saving…
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => persistDraft().then(() => router.push("/author"))}
            className="text-xs border-rule gap-1.5"
          >
            <Save className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
            <span>{t("saveAndExit")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="text-xs text-danger hover:text-danger hover:bg-danger-bg gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{t("cancelDraft")}</span>
          </Button>
        </div>
      </div>

      {/* Stepper Progress */}
      <div className="bg-paper p-4 rounded-[3px] border border-rule shadow-xs">
        <Stepper steps={steps} currentStepIndex={currentStep} />
      </div>

      {/* Validation Error Banner */}
      {validationErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-[3px] border border-danger/30 bg-danger-bg/50 p-4 space-y-1.5 text-xs text-danger"
        >
          <div className="font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>Please complete the required items before proceeding:</span>
          </div>
          <ul className="list-disc ps-5 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── STEP 1: MANUSCRIPT UPLOAD ─────────────────────────────────────────── */}
      {currentStep === 0 && (
        <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-6">
          <div className="space-y-1 border-b border-rule pb-4">
            <h2 className="text-base font-heading font-semibold text-ink flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted" strokeWidth={1.5} />
              <span>{t("step1Heading")}</span>
            </h2>
            <p className="text-xs text-muted leading-relaxed max-w-2xl">
              {t("step1Desc")}
            </p>
          </div>

          <div className="max-w-xl mx-auto py-2">
            <FileDropzone
              onFileSelect={handleManuscriptSelect}
              selectedFile={
                hasManuscript
                  ? {
                      name: `${submission.id}_manuscript.pdf`,
                      size: currentVer?.sizeBytes || 480000,
                    }
                  : null
              }
              label={t("step1Heading")}
              hint="PDF format only, maximum 50 MB"
            />
          </div>

          {hasManuscript && (
            <div className="rounded border border-success/30 bg-success-bg/20 p-4 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.5} />
                <span className="font-medium text-ink">
                  Primary manuscript uploaded successfully.
                </span>
              </div>
              <span className="text-[11px] text-muted">Ready for Step 2</span>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: BLIND COPY UPLOAD ──────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-6">
          <div className="space-y-1 border-b border-rule pb-4">
            <h2 className="text-base font-heading font-semibold text-ink flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-muted" strokeWidth={1.5} />
              <span>{t("step2Heading")}</span>
            </h2>
            <p className="text-xs text-muted leading-relaxed max-w-2xl">
              {t("step2Desc")}
            </p>
          </div>

          {/* Checklist Card */}
          <div className="rounded-[3px] border border-rule bg-paper-alt/50 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span>{t("blindChecklistTitle")}</span>
            </h3>
            <ul className="text-xs text-muted space-y-2 list-none p-0 m-0">
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" strokeWidth={2} />
                <span>{t("blindCheck1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" strokeWidth={2} />
                <span>{t("blindCheck2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" strokeWidth={2} />
                <span>{t("blindCheck3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" strokeWidth={2} />
                <span>{t("blindCheck4")}</span>
              </li>
            </ul>
            <p className="text-[11px] text-muted border-t border-rule/60 pt-2 italic">
              {t("blindVerifyExplainer")}
            </p>
          </div>

          <div className="max-w-xl mx-auto py-2">
            <FileDropzone
              onFileSelect={handleBlindCopySelect}
              selectedFile={
                hasBlindCopy
                  ? {
                      name: `${submission.id}_anonymized.pdf`,
                      size: currentVer?.sizeBytes || 450000,
                    }
                  : null
              }
              label={t("step2Heading")}
              hint="Anonymized PDF only, maximum 50 MB"
            />
          </div>
        </div>
      )}

      {/* ── STEP 3: DETAILS & AUTHORS ─────────────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-4">
            <div className="space-y-1">
              <h2 className="text-base font-heading font-semibold text-ink">
                {t("step3Heading")}
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                {t("step3Desc")}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRerunDialog(true)}
              disabled={extractionLoading}
              className="text-xs gap-1.5 border-rule shrink-0"
            >
              <RefreshCw
                className={`h-3 w-3 ${extractionLoading ? "animate-spin" : ""}`}
                strokeWidth={1.5}
              />
              <span>{t("reRunExtraction")}</span>
            </Button>
          </div>

          {/* AI Extraction Status Banners */}
          {extractionLoading && (
            <div className="rounded border border-accent/30 bg-accent/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                <Sparkles className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                <span>{t("aiExtractionBanner")}</span>
              </div>
              <Skeleton className="h-4 w-3/4 bg-rule/50" />
              <Skeleton className="h-4 w-1/2 bg-rule/50" />
            </div>
          )}

          {!extractionLoading && extractionStatus === "succeeded" && (
            <div className="rounded border border-success/30 bg-success-bg/20 p-3 text-xs flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="text-ink">{t("aiExtractionSuccess")}</span>
            </div>
          )}

          {!extractionLoading && extractionStatus === "failed" && (
            <div className="rounded border border-amber-600/30 bg-amber-500/10 p-3 text-xs flex items-center justify-between gap-2 text-amber-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span>{t("aiExtractionFailed")}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runAiExtraction}
                className="text-xs h-7 border-amber-600/40"
              >
                Retry Extraction
              </Button>
            </div>
          )}

          {/* Primary Language Selection */}
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="ms-lang" className="text-xs font-medium text-ink">
              {t("manuscriptLanguage")} <span className="text-danger">*</span>
            </Label>
            <select
              id="ms-lang"
              value={manuscriptLang}
              onChange={(e) => {
                const newLang = e.target.value as Locale;
                setManuscriptLang(newLang);
                setActiveTabLang(newLang);
                markDirty();
              }}
              className="w-full text-xs h-8 rounded border border-rule bg-paper px-2.5 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </div>

          {/* Language Tabs for Title & Abstract */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Metadata Content
              </div>
              <div
                role="tablist"
                aria-label="Metadata Language Tabs"
                className="inline-flex gap-1 rounded bg-paper-alt p-0.5 border border-rule"
              >
                {(["en", "fr", "ar"] as Locale[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    role="tab"
                    aria-selected={loc === activeTabLang}
                    onClick={() => setActiveTabLang(loc)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      loc === activeTabLang
                        ? "bg-paper text-ink font-semibold shadow-xs border border-rule"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {loc === "en" ? "English" : loc === "fr" ? "Français" : "العربية"}
                    {loc === manuscriptLang && (
                      <span className="ms-1 text-[9px] text-accent uppercase font-bold">
                        (Primary)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Title Input */}
            <div className="space-y-1">
              <Label
                htmlFor="meta-title"
                className="text-xs font-medium text-ink flex items-center justify-between"
              >
                <span>
                  {t("titleLabel")} ({activeTabLang.toUpperCase()}){" "}
                  {activeTabLang === manuscriptLang && (
                    <span className="text-danger">*</span>
                  )}
                </span>
              </Label>
              <Input
                id="meta-title"
                dir={activeTabLang === "ar" ? "rtl" : "ltr"}
                value={title[activeTabLang] || ""}
                onChange={(e) => {
                  setTitle((prev) => ({
                    ...prev,
                    [activeTabLang]: e.target.value,
                  }));
                  markDirty();
                }}
                placeholder="Enter complete manuscript title…"
                className="text-xs bg-paper font-heading text-sm"
              />
            </div>

            {/* Abstract Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="meta-abstract"
                  className="text-xs font-medium text-ink"
                >
                  {t("abstractLabel")} ({activeTabLang.toUpperCase()}){" "}
                  {activeTabLang === manuscriptLang && (
                    <span className="text-danger">*</span>
                  )}
                </Label>
                <span
                  className={`text-[11px] font-mono ${
                    wordCount < 100 ? "text-amber-700" : "text-muted"
                  }`}
                >
                  {t("abstractWords", { count: wordCount })}
                </span>
              </div>
              <Textarea
                id="meta-abstract"
                dir={activeTabLang === "ar" ? "rtl" : "ltr"}
                rows={5}
                value={abstract[activeTabLang] || ""}
                onChange={(e) => {
                  setAbstract((prev) => ({
                    ...prev,
                    [activeTabLang]: e.target.value,
                  }));
                  markDirty();
                }}
                placeholder="Paste or write the abstract here…"
                className="text-xs bg-paper leading-relaxed"
              />
            </div>

            {/* Keywords Tag Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {t("keywordsLabel")} ({activeTabLang.toUpperCase()})
              </Label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded border border-rule bg-paper min-h-[42px]">
                {(keywords[activeTabLang] || []).map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-paper-alt text-ink border border-rule px-2 py-0.5 rounded text-xs"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="text-muted hover:text-ink focus:outline-none"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  dir={activeTabLang === "ar" ? "rtl" : "ltr"}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  onBlur={addKeyword}
                  placeholder={t("keywordsPlaceholder")}
                  className="flex-1 min-w-[140px] text-xs bg-transparent border-none outline-none text-ink placeholder:text-muted"
                />
              </div>
            </div>
          </div>

          {/* Authors Repeater */}
          <div className="border-t border-rule pt-6">
            <AuthorsRepeater
              authors={authors}
              onChange={(updated) => {
                setAuthors(updated);
                markDirty();
              }}
            />
          </div>
        </div>
      )}

      {/* ── STEP 4: DECLARATIONS & NOTES ───────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-6">
          <div className="space-y-1 border-b border-rule pb-4">
            <h2 className="text-base font-heading font-semibold text-ink">
              {t("step4Heading")}
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              {t("step4Desc")}
            </p>
          </div>

          {/* 5 Required Checkboxes */}
          <div className="space-y-3.5 bg-paper-alt/40 p-4 rounded border border-rule">
            <div className="flex items-start gap-3">
              <Checkbox
                id="dec-orig"
                checked={declarations.originalWork}
                onCheckedChange={(c) => {
                  setDeclarations((prev: SubmissionDeclarations) => ({
                    ...prev,
                    originalWork: Boolean(c),
                  }));
                  markDirty();
                }}
                className="mt-0.5"
              />
              <Label
                htmlFor="dec-orig"
                className="text-xs text-ink leading-relaxed font-normal cursor-pointer"
              >
                <span className="font-semibold text-danger">* </span>
                {t("decOriginal")}
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="dec-review"
                checked={declarations.notUnderConsideration}
                onCheckedChange={(c) => {
                  setDeclarations((prev: SubmissionDeclarations) => ({
                    ...prev,
                    notUnderConsideration: Boolean(c),
                  }));
                  markDirty();
                }}
                className="mt-0.5"
              />
              <Label
                htmlFor="dec-review"
                className="text-xs text-ink leading-relaxed font-normal cursor-pointer"
              >
                <span className="font-semibold text-danger">* </span>
                {t("decNotUnderReview")}
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="dec-ethics"
                checked={declarations.ethicalCompliance}
                onCheckedChange={(c) => {
                  setDeclarations((prev: SubmissionDeclarations) => ({
                    ...prev,
                    ethicalCompliance: Boolean(c),
                  }));
                  markDirty();
                }}
                className="mt-0.5"
              />
              <Label
                htmlFor="dec-ethics"
                className="text-xs text-ink leading-relaxed font-normal cursor-pointer"
              >
                <span className="font-semibold text-danger">* </span>
                {t("decEthics")}
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="dec-license"
                checked={declarations.licenseAgreement}
                onCheckedChange={(c) => {
                  setDeclarations((prev: SubmissionDeclarations) => ({
                    ...prev,
                    licenseAgreement: Boolean(c),
                  }));
                  markDirty();
                }}
                className="mt-0.5"
              />
              <Label
                htmlFor="dec-license"
                className="text-xs text-ink leading-relaxed font-normal cursor-pointer"
              >
                <span className="font-semibold text-danger">* </span>
                {t("decLicense")}
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="dec-conflict"
                checked={declarations.conflictOfInterest}
                onCheckedChange={(c) => {
                  setDeclarations((prev: SubmissionDeclarations) => ({
                    ...prev,
                    conflictOfInterest: Boolean(c),
                  }));
                  markDirty();
                }}
                className="mt-0.5"
              />
              <Label
                htmlFor="dec-conflict"
                className="text-xs text-ink leading-relaxed font-normal cursor-pointer"
              >
                <span className="font-semibold text-danger">* </span>
                {t("decConflict")}
              </Label>
            </div>
          </div>

          {/* Optional Cover Letter & Reviewer Suggestions */}
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="cover-letter" className="text-xs font-medium text-ink">
                {t("coverLetterLabel")}
              </Label>
              <Textarea
                id="cover-letter"
                rows={4}
                value={coverLetter}
                onChange={(e) => {
                  setCoverLetter(e.target.value);
                  markDirty();
                }}
                placeholder="Optional comments or contextual remarks for the Editor-in-Chief…"
                className="text-xs bg-paper leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="sugg-rev" className="text-xs font-medium text-ink">
                  {t("suggestedReviewersLabel")}
                </Label>
                <Input
                  id="sugg-rev"
                  value={suggestedReviewers}
                  onChange={(e) => {
                    setSuggestedReviewers(e.target.value);
                    markDirty();
                  }}
                  placeholder="Names and affiliations of recommended experts"
                  className="text-xs bg-paper"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="excl-rev" className="text-xs font-medium text-ink">
                  {t("excludedReviewersLabel")}
                </Label>
                <Input
                  id="excl-rev"
                  value={excludedReviewers}
                  onChange={(e) => {
                    setExcludedReviewers(e.target.value);
                    markDirty();
                  }}
                  placeholder="Individuals with direct conflicts of interest"
                  className="text-xs bg-paper"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: REVIEW AND SUBMIT ─────────────────────────────────────────── */}
      {currentStep === 4 && (
        <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-6">
          <div className="space-y-1 border-b border-rule pb-4">
            <h2 className="text-base font-heading font-semibold text-ink">
              {t("step5Heading")}
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              {t("step5Desc")}
            </p>
          </div>

          {/* Checklist Status */}
          <div className="rounded border border-rule bg-paper-alt/50 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink">
              {t("checklistTitle")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                {hasManuscript ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-danger" />
                )}
                <span>Full Manuscript Uploaded</span>
              </div>
              <div className="flex items-center gap-2">
                {hasBlindCopy ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-danger" />
                )}
                <span>Anonymized Blind Copy Uploaded</span>
              </div>
              <div className="flex items-center gap-2">
                {title[manuscriptLang] ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-danger" />
                )}
                <span>Title in {manuscriptLang.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                {wordCount >= 50 ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-danger" />
                )}
                <span>Abstract ({wordCount} words)</span>
              </div>
              <div className="flex items-center gap-2">
                {authors.length > 0 && authors[0].fullName ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-danger" />
                )}
                <span>Contributing Authors ({authors.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {declarations.originalWork && declarations.licenseAgreement ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-danger" />
                )}
                <span>Declarations Confirmed</span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="space-y-4">
            {/* Step 1 Summary */}
            <div className="rounded border border-rule p-4 space-y-2 bg-paper">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Manuscript File
                </span>
                <button
                  type="button"
                  onClick={() => jumpToStep(0)}
                  className="text-xs text-accent hover:underline font-medium"
                >
                  {t("editStep")}
                </button>
              </div>
              <div className="text-xs text-ink font-medium">
                {hasManuscript
                  ? `${submission.id}_manuscript.pdf (${(
                      (currentVer?.sizeBytes || 480000) / 1024
                    ).toFixed(0)} KB)`
                  : "No file uploaded"}
              </div>
            </div>

            {/* Step 2 Summary */}
            <div className="rounded border border-rule p-4 space-y-2 bg-paper">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Anonymized Blind Copy
                </span>
                <button
                  type="button"
                  onClick={() => jumpToStep(1)}
                  className="text-xs text-accent hover:underline font-medium"
                >
                  {t("editStep")}
                </button>
              </div>
              <div className="text-xs text-ink font-medium">
                {hasBlindCopy
                  ? `${submission.id}_anonymized.pdf (${(
                      (currentVer?.sizeBytes || 450000) / 1024
                    ).toFixed(0)} KB)`
                  : "No file uploaded"}
              </div>
            </div>

            {/* Step 3 Summary */}
            <div className="rounded border border-rule p-4 space-y-2 bg-paper">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Details & Authors
                </span>
                <button
                  type="button"
                  onClick={() => jumpToStep(2)}
                  className="text-xs text-accent hover:underline font-medium"
                >
                  {t("editStep")}
                </button>
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-muted">Title: </span>
                  <span className="font-semibold text-ink">
                    {title[manuscriptLang] || "Not provided"}
                  </span>
                </div>
                <div>
                  <span className="text-muted">Language: </span>
                  <span className="uppercase font-mono text-ink">
                    {manuscriptLang}
                  </span>
                </div>
                <div>
                  <span className="text-muted">Authors: </span>
                  <span className="text-ink">
                    {authors.map((a) => a.fullName).filter(Boolean).join(", ") ||
                      "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 4 Summary */}
            <div className="rounded border border-rule p-4 space-y-2 bg-paper">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Declarations
                </span>
                <button
                  type="button"
                  onClick={() => jumpToStep(3)}
                  className="text-xs text-accent hover:underline font-medium"
                >
                  {t("editStep")}
                </button>
              </div>
              <div className="text-xs text-success flex items-center gap-1.5 font-medium">
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                <span>All publication and ethics declarations signed</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-rule flex justify-end">
            <Button
              onClick={() => setShowSubmitDialog(true)}
              className="text-xs gap-2 px-6"
            >
              <Check className="h-4 w-4" strokeWidth={2} />
              <span>{t("submitButton")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackStep}
          disabled={currentStep === 0}
          className="text-xs border-rule gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>{t("back")}</span>
        </Button>

        {currentStep < 4 && (
          <Button
            size="sm"
            onClick={handleNextStep}
            className="text-xs gap-1.5"
          >
            <span>{t("next")}</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        )}
      </div>

      {/* Confirm Delete Draft Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("confirmDeleteDraftTitle")}
        description={t("confirmDeleteDraftDesc")}
        confirmLabel={t("cancelDraft")}
        isDestructive={true}
        onConfirm={handleDeleteDraft}
      />

      {/* Confirm Re-run Extraction Dialog */}
      <ConfirmDialog
        open={showRerunDialog}
        onOpenChange={setShowRerunDialog}
        title={t("reRunExtraction")}
        description={t("confirmReRunExtraction")}
        confirmLabel="Re-run Extraction"
        onConfirm={runAiExtraction}
      />

      {/* Confirm Submit Dialog */}
      <ConfirmDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        title={t("confirmSubmitTitle")}
        description={t("confirmSubmitDesc")}
        confirmLabel={t("submitButton")}
        isLoading={submitting}
        onConfirm={handleFinalSubmit}
      />
    </div>
  );
}
