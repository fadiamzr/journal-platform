import React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { brand } from "@/config/brand";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserCheck, Users, Award } from "lucide-react";
import { ScrollReveal } from "@/components/shared/ScrollReveal";

export default async function EditorialBoardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "editorialBoard" });
  const board = brand.editorialBoard;

  return (
    <div className="space-y-12 max-w-reading mx-auto pb-16">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* ── 1. Editor-in-Chief ──────────────────────────────────────────────── */}
      <ScrollReveal>
        <section aria-labelledby="editor-in-chief-heading" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rule pb-2">
            <Award className="h-5 w-5 text-accent" />
            <h2 id="editor-in-chief-heading" className="text-xl font-heading font-semibold text-ink">
              {t("editorInChief")}
            </h2>
          </div>
          <div className="rounded-[3px] border border-rule bg-paper p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-warm">
            <div>
              <h3 className="text-base font-semibold font-body text-ink">
                {board.editorInChief.name}
              </h3>
              <p className="text-xs text-muted font-body mt-0.5">
                {board.editorInChief.affiliation}
              </p>
            </div>
            {board.editorInChief.orcid && (
              <div className="text-xs text-muted font-body">
                <span className="text-[11px] uppercase tracking-wider text-muted font-mono block">ORCID</span>
                <a
                  href={`https://orcid.org/${board.editorInChief.orcid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline font-mono text-[11px] hover:text-ink"
                >
                  {board.editorInChief.orcid}
                </a>
              </div>
            )}
          </div>
        </section>
      </ScrollReveal>

      {/* ── 2. Associate Editors ────────────────────────────────────────────── */}
      <ScrollReveal>
        <section aria-labelledby="associate-editors-heading" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rule pb-2">
            <UserCheck className="h-5 w-5 text-accent" />
            <h2 id="associate-editors-heading" className="text-xl font-heading font-semibold text-ink">
              {t("associateEditors")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {board.associateEditors.map((editor, idx) => (
              <div
                key={idx}
                className="rounded-[3px] border border-rule bg-paper p-4 space-y-1 shadow-sm hover:border-accent/30 transition-colors"
              >
                <h3 className="text-sm font-semibold font-body text-ink">
                  {editor.name}
                </h3>
                <p className="text-xs text-muted font-body">
                  {editor.affiliation}
                </p>
                <p className="text-[11px] text-accent font-body pt-1 font-medium font-mono">
                  {editor.role}
                </p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ── 3. Editorial Board Members ──────────────────────────────────────── */}
      <ScrollReveal>
        <section aria-labelledby="board-members-heading" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rule pb-2">
            <Users className="h-5 w-5 text-accent" />
            <h2 id="board-members-heading" className="text-xl font-heading font-semibold text-ink">
              {t("boardMembers")}
            </h2>
          </div>
          <div className="divide-y divide-rule rounded-[3px] border border-rule bg-paper shadow-warm">
            {board.editorialBoardMembers.map((member, idx) => (
              <div
                key={idx}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm font-body hover:bg-paper-alt/50 transition-colors"
              >
                <span className="font-medium text-ink">{member.name}</span>
                <span className="text-xs text-muted">{member.affiliation}</span>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
