"use client";

import React, { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfViewerProps {
  src?: string;
  title: string;
  manuscriptLanguage?: string;
  totalPageCount?: number;
  className?: string;
}

export function PdfViewer({
  src = "/mock-files/anonymized-manuscript.pdf",
  title,
  manuscriptLanguage = "en",
  totalPageCount = 14,
  className = "",
}: PdfViewerProps) {
  const t = useTranslations("reviewer.workspace");
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(prev + delta, 50), 200));
  };

  const resetZoom = () => {
    setZoomLevel(100);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-paper-alt border border-rule rounded-[3px] overflow-hidden ${className}`}
    >
      {/* PDF Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-paper border-b border-rule text-xs">
        {/* Page Navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage <= 1}
            aria-label="Previous Page"
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>

          <span className="text-[11px] font-mono text-muted px-1">
            {t("pageNav", { page: currentPage, total: totalPageCount })}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPageCount))}
            disabled={currentPage >= totalPageCount}
            aria-label="Next Page"
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleZoom(-15)}
            disabled={zoomLevel <= 50}
            aria-label={t("zoomOut")}
            className="h-7 w-7 p-0"
          >
            <ZoomOut className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
          </Button>

          <button
            type="button"
            onClick={resetZoom}
            className="text-[11px] font-mono text-muted hover:text-ink px-1.5 py-0.5 rounded hover:bg-paper-alt"
          >
            {zoomLevel}%
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleZoom(15)}
            disabled={zoomLevel >= 200}
            aria-label={t("zoomIn")}
            className="h-7 w-7 p-0"
          >
            <ZoomIn className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
          </Button>

          <div className="h-4 w-[1px] bg-rule mx-1" aria-hidden="true" />

          {/* Download Button */}
          <a
            href={src}
            download={`${title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}_anonymized.pdf`}
            className="inline-flex items-center justify-center h-7 px-2 text-[11px] rounded hover:bg-paper-alt text-muted hover:text-ink gap-1"
            title={t("downloadAnonymizedPdf")}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">PDF</span>
          </a>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            aria-label={t("fullscreen")}
            className="h-7 w-7 p-0 text-muted hover:text-ink"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </Button>
        </div>
      </div>

      {/* Manuscript Sheet Scroll Container */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center bg-paper-alt/80">
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "top center",
          }}
          className="transition-transform duration-150"
        >
          {/* Simulated Academic Manuscript Page */}
          <div
            dir={manuscriptLanguage === "ar" ? "rtl" : "ltr"}
            className="w-[620px] min-h-[820px] bg-paper shadow-md border border-rule/80 p-10 sm:p-14 flex flex-col justify-between text-ink select-text font-body leading-relaxed"
          >
            {/* Running Header */}
            <div className="border-b border-rule/60 pb-3 flex items-center justify-between text-[10px] text-muted font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-accent font-semibold">
                <Shield className="h-3 w-3" strokeWidth={1.5} />
                DOUBLE-BLIND PEER REVIEW
              </span>
              <span>
                Page {currentPage} of {totalPageCount}
              </span>
            </div>

            {/* Academic Content */}
            <div className="my-6 space-y-5 flex-1">
              {currentPage === 1 ? (
                <>
                  <div className="text-center space-y-3 pt-4 pb-6 border-b border-rule/50">
                    <h1 className="text-lg sm:text-xl font-heading font-semibold text-ink leading-snug">
                      {title}
                    </h1>
                    <div className="text-xs text-muted font-mono uppercase">
                      [Author identity and affiliations removed for double-blind review]
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted font-heading">
                      Abstract
                    </h2>
                    <p className="text-xs text-ink/90 leading-relaxed text-justify indent-4">
                      This scholarly inquiry undertakes a rigorous examination of the documentary
                      corpus preserved across maritime, consular, and judicial archives. By synthesizing
                      primary source materials in Latin, Arabic, and early modern vernaculars, the study
                      reconstructs trans-regional institutional networks and interrogates long-standing
                      historiographical assumptions regarding jurisdiction, communal sovereignty, and
                      commercial adjudication across the Mediterranean basin.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted font-heading">
                      1. Introduction & Historiographical Framework
                    </h2>
                    <p className="text-xs text-ink/90 leading-relaxed text-justify indent-4">
                      Scholarly assessments of Mediterranean trade networks during the eighteenth century
                      have frequently oscillated between two divergent explanatory models. On the one hand,
                      classical institutional analyses emphasize the overarching framework of bilateral capitulations
                      and consular courts. On the other hand, micro-historical investigations demonstrate how local
                      magistrates, merchant guilds, and regional maritime authorities negotiated pragmatic accommodations
                      that routinely diverged from formal imperial decrees.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3 pt-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted font-heading">
                      Section {currentPage}. Archival Findings and Analysis
                    </h2>
                    <p className="text-xs text-ink/90 leading-relaxed text-justify indent-4">
                      The empirical documentation gathered across municipal and consular registers reveals an
                      intricate matrix of cross-border contractual obligations. Far from exhibiting structural
                      rigidity, the notarized agreements reflect dynamic legal pluralism. Notaries documented maritime
                      protests, currency exchange arbitrations, and maritime insurance liabilities through an adaptable
                      lexicon designed to reconcile divergent regional jurisprudence.
                    </p>
                    <p className="text-xs text-ink/90 leading-relaxed text-justify indent-4">
                      Furthermore, quantitative analysis of cargo manifests confirms that transit volumes fluctuated
                      in direct correlation with seasonal sanitary quarantines and regional fiscal tariffs. Contrary to
                      the hypothesis advanced in earlier studies, the evidence demonstrates that intermediary merchant
                      confraternities played a decisive structural role in guaranteeing commercial liquidity.
                    </p>
                    <p className="text-xs text-ink/90 leading-relaxed text-justify indent-4">
                      Detailed comparative tabulation of archival samples indicates that dispute resolution protocols
                      favored customary merchant arbitration over formal consular tribunals in more than seventy percent
                      of documented litigations during the decade under scrutiny.
                    </p>
                  </div>

                  {/* Footnotes on page */}
                  <div className="border-t border-rule/50 pt-4 mt-8 space-y-1 text-[10px] text-muted">
                    <div>[1] See Archival Series B-14, Carton 28, Register of Maritime Adjudications.</div>
                    <div>[2] Critical editions collated with contemporary chancery transcriptions.</div>
                  </div>
                </>
              )}
            </div>

            {/* Running Footer */}
            <div className="border-t border-rule/60 pt-3 flex items-center justify-between text-[10px] text-muted font-mono">
              <span>CONFIDENTIAL - JOURNAL PEER REVIEW</span>
              <span>{currentPage}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
