"use client";

import React from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useTranslations } from "next-intl";
import {
  ShieldCheck,
  Scale,
  Award,
} from "lucide-react";

export default function ReviewerGuidelinesPage() {
  const t = useTranslations("reviewer.guidelines");
  const tNav = useTranslations("portalNav");

  const rubric = [
    {
      criterion: "1. Originality & Novelty",
      score5: "Pioneering contribution that redefines or significantly advances current scholarship with original primary evidence.",
      score3: "Competent and sound contribution, though largely corroborating existing scholarly frameworks.",
      score1: "Derivative, repetitive, or lacks any discernible original thesis or new empirical evidence.",
    },
    {
      criterion: "2. Methodology & Rigor",
      score5: "Flawless, innovative, and transparent methodology; primary sources exhaustively interrogated with critical discernment.",
      score3: "Methodologically adequate with standard analytical techniques; minor gaps in source contextualization.",
      score1: "Flawed or uncritical methodology; misattribution of sources; selective reading of evidence.",
    },
    {
      criterion: "3. Clarity & Argumentation",
      score5: "Exemplary narrative prose; seamless transitions; arguments rigorously substantiated and persuasively formulated.",
      score3: "Clear and coherent prose; minor structural disfluencies or ambiguous formulations in secondary sections.",
      score1: "Opaque, disjointed, or poorly argued; unsupported claims throughout.",
    },
    {
      criterion: "4. Academic Significance",
      score5: "Transformative potential; will be widely cited and consulted across multidisciplinary humanities networks.",
      score3: "Valuable reference for specialized regional or chronological sub-fields; modest broader impact.",
      score1: "Negligible scholarly value; trivial or overly narrow without theoretical or historiographical stakes.",
    },
    {
      criterion: "5. Relevance to Journal",
      score5: "Perfect alignment with the journal's multilingual, comparative Mediterranean and trans-regional scope.",
      score3: "Generally compatible with the editorial mission; may benefit from explicit framing within comparative scholarship.",
      score1: "Outside the journal's editorial remit; better suited for a specialized single-discipline outlet.",
    },
  ];

  return (
    <PortalLayout
      allowedRoles={["reviewer", "editor", "admin"]}
      breadcrumbs={[
        { label: tNav("reviewerReviews"), href: "/reviewer" },
        { label: t("title") },
      ]}
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="border-b border-rule pb-5 space-y-2">
          <h1 className="text-2xl font-heading font-bold text-ink tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xs text-muted leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Section 1: Confidentiality & Ethics */}
        <section className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-rule pb-3">
            <ShieldCheck className="h-5 w-5 text-accent" strokeWidth={1.5} />
            <h2 className="text-sm font-heading font-semibold text-ink">
              {t("sectionEthicsTitle")}
            </h2>
          </div>

          <div className="text-xs text-ink/90 space-y-3 leading-relaxed">
            <p>
              Peer review in the Journal operates under a strict <strong>double-blind protocol</strong>:
              reviewers do not know the identities of the authors, and authors do not know the identities
              of the reviewers.
            </p>
            <ul className="list-disc ps-5 space-y-1.5 text-muted">
              <li>
                <strong>Privileged Material:</strong> All manuscripts submitted for review are confidential
                documents. You must not quote, circulate, or utilize any unpublished findings prior to publication.
              </li>
              <li>
                <strong>Conflict of Interest:</strong> If you suspect the author&apos;s identity or have any personal,
                financial, or institutional association with the research, please click &ldquo;Report Conflict of Interest&rdquo;
                to recuse yourself immediately.
              </li>
              <li>
                <strong>Generative AI Policy:</strong> In compliance with international academic publication ethics,
                reviewers must not paste unpublished manuscripts into public third-party commercial AI models.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 2: Scoring Rubric */}
        <section className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-rule pb-3">
            <Scale className="h-5 w-5 text-accent" strokeWidth={1.5} />
            <h2 className="text-sm font-heading font-semibold text-ink">
              {t("sectionRubricTitle")}
            </h2>
          </div>

          <div className="space-y-4">
            {rubric.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded border border-rule bg-paper-alt/30 space-y-2.5 text-xs"
              >
                <h3 className="font-semibold text-ink">{item.criterion}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px] leading-relaxed">
                  <div className="p-2.5 rounded bg-success-bg/30 border border-success/20">
                    <span className="font-bold text-success block mb-0.5">
                      Score 5 (Exceptional)
                    </span>
                    <span className="text-ink/90">{item.score5}</span>
                  </div>
                  <div className="p-2.5 rounded bg-paper border border-rule">
                    <span className="font-bold text-muted block mb-0.5">
                      Score 3 (Acceptable)
                    </span>
                    <span className="text-ink/90">{item.score3}</span>
                  </div>
                  <div className="p-2.5 rounded bg-danger-bg/30 border border-danger/20">
                    <span className="font-bold text-danger block mb-0.5">
                      Score 1 (Unsatisfactory)
                    </span>
                    <span className="text-ink/90">{item.score1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Recommendations */}
        <section className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-rule pb-3">
            <Award className="h-5 w-5 text-accent" strokeWidth={1.5} />
            <h2 className="text-sm font-heading font-semibold text-ink">
              {t("sectionRecommendationTitle")}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded border border-rule bg-paper space-y-1">
              <span className="font-semibold text-success block">
                Accept without revisions
              </span>
              <p className="text-muted leading-relaxed text-[11px]">
                The manuscript is publication-ready as is, with exceptional rigor and clear contribution.
              </p>
            </div>
            <div className="p-3 rounded border border-rule bg-paper space-y-1">
              <span className="font-semibold text-accent block">
                Accept with minor revisions
              </span>
              <p className="text-muted leading-relaxed text-[11px]">
                The paper is fundamentally sound but requires specific textual, bibliographic, or stylistic refinements.
              </p>
            </div>
            <div className="p-3 rounded border border-rule bg-paper space-y-1">
              <span className="font-semibold text-amber-700 block">
                Major revisions required
              </span>
              <p className="text-muted leading-relaxed text-[11px]">
                Substantial theoretical restructuring, archival expansion, or analytical re-framing needed before re-evaluation.
              </p>
            </div>
            <div className="p-3 rounded border border-rule bg-paper space-y-1">
              <span className="font-semibold text-danger block">
                Decline submission
              </span>
              <p className="text-muted leading-relaxed text-[11px]">
                The study suffers from severe methodological flaws, lacks original evidence, or falls outside the journal&apos;s scope.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PortalLayout>
  );
}
