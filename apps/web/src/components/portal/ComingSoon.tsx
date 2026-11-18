"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth/session-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Users,
  Layers,
  Settings,
  ArrowRight,
  ExternalLink,
  Edit3,
  CheckCircle2,
  Shield,
  RefreshCw,
} from "lucide-react";
import type { Role } from "@/lib/domain/types";

interface ComingSoonProps {
  role: "editor" | "admin";
}

const PERSONAS: Array<{
  role: Role;
  name: string;
  targetPath: string;
  icon: React.ElementType;
}> = [
  { role: "author", name: "Harriet Vance", targetPath: "/author", icon: Edit3 },
  { role: "reviewer", name: "Arthur Pendelton", targetPath: "/reviewer", icon: CheckCircle2 },
  { role: "editor", name: "Hélène Vance", targetPath: "/editor", icon: BookOpen },
  { role: "admin", name: "Tariq Al-Mansoor", targetPath: "/admin", icon: Shield },
];

export function ComingSoon({ role }: ComingSoonProps) {
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const { user, switchPersona } = useSession();

  const isEditor = role === "editor";

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <div className="rounded-[3px] border border-rule bg-paper p-6 md:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="outline" className="text-[11px] font-mono border-accent text-accent">
            {t("comingSoonBadge")}
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-xs gap-1.5 border-rule">
                <ExternalLink className="h-3 w-3 text-muted" strokeWidth={1.5} />
                <span>{tCommon("backToHome")}</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink tracking-tight">
            {isEditor ? t("editorComingSoonTitle") : t("adminComingSoonTitle")}
          </h1>
          <p className="text-xs md:text-sm text-muted font-body leading-relaxed max-w-2xl">
            {isEditor ? t("editorComingSoonDesc") : t("adminComingSoonDesc")}
          </p>
        </div>
      </div>

      {/* ── Feature Capabilities Grid ────────────────────────────────────────── */}
      <section aria-labelledby="planned-capabilities-heading" className="space-y-3">
        <h2
          id="planned-capabilities-heading"
          className="text-xs font-semibold text-muted uppercase tracking-wider text-[11px]"
        >
          {t("previewNotice")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isEditor ? (
            <>
              <FeatureCard
                icon={BookOpen}
                title={t("editorFeatureTriage")}
                description={t("editorFeatureTriageDesc")}
              />
              <FeatureCard
                icon={Users}
                title={t("editorFeatureReviewers")}
                description={t("editorFeatureReviewersDesc")}
              />
              <FeatureCard
                icon={Layers}
                title={t("editorFeatureIssues")}
                description={t("editorFeatureIssuesDesc")}
              />
              <FeatureCard
                icon={Settings}
                title={t("editorFeatureDecisions")}
                description={t("editorFeatureDecisionsDesc")}
              />
            </>
          ) : (
            <>
              <FeatureCard
                icon={Users}
                title={t("adminFeatureUsers")}
                description={t("adminFeatureUsersDesc")}
              />
              <FeatureCard
                icon={Settings}
                title={t("adminFeatureSettings")}
                description={t("adminFeatureSettingsDesc")}
              />
              <FeatureCard
                icon={Layers}
                title={t("adminFeatureIssues")}
                description={t("adminFeatureIssuesDesc")}
              />
              <FeatureCard
                icon={BookOpen}
                title={t("adminFeatureAnalytics")}
                description={t("adminFeatureAnalyticsDesc")}
              />
            </>
          )}
        </div>
      </section>

      {/* ── Demo Persona Switcher Panel ──────────────────────────────────────── */}
      <section aria-labelledby="persona-switcher-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          <h2
            id="persona-switcher-heading"
            className="text-xs font-semibold text-muted uppercase tracking-wider text-[11px]"
          >
            {t("switchPersona")}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const isCurrent = user?.role === p.role;
            return (
              <Link
                key={p.role}
                href={p.targetPath as Parameters<typeof Link>[0]["href"]}
                onClick={() => switchPersona(p.role)}
                className={`p-3.5 rounded-[3px] border text-start transition-all space-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent block ${
                  isCurrent
                    ? "border-accent bg-paper ring-1 ring-accent"
                    : "border-rule bg-paper hover:border-ink/40 hover:bg-paper-alt/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink uppercase tracking-wide">
                    {t(`roles.${p.role}`)}
                  </span>
                  <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                </div>
                <p className="text-xs text-ink font-medium truncate">{p.name}</p>
                <div className="flex items-center gap-1 text-[11px] text-accent font-medium">
                  <span>{isCurrent ? t("activePersona") : t("switchToRole")}</span>
                  {!isCurrent && (
                    <ArrowRight className="h-2.5 w-2.5 rtl:rotate-180" strokeWidth={1.5} />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[3px] border border-rule bg-paper p-5 space-y-2">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-accent flex-shrink-0" strokeWidth={1.5} />
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <p className="text-xs text-muted leading-relaxed font-body">{description}</p>
    </div>
  );
}
