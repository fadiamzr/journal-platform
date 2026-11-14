"use client";

import React from "react";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { useSession } from "@/lib/auth/session-context";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CheckCircle2,
  Edit3,
  Shield,
  Layers,
  ArrowRight,
  User as UserIcon,
} from "lucide-react";
import type { Role } from "@/lib/domain/types";

const PERSONAS: Array<{ role: Role; label: string; name: string; icon: React.ElementType }> = [
  { role: "author", label: "Author", name: "Dr. Harriet Vance", icon: Edit3 },
  { role: "reviewer", label: "Reviewer", name: "Prof. Arthur Pendelton", icon: CheckCircle2 },
  { role: "editor", label: "Editor", name: "Prof. Hélène Vance", icon: BookOpen },
  { role: "admin", label: "Administrator", name: "Dr. Tariq Al-Mansoor", icon: Shield },
];

export default function PortalDashboardPage() {
  const { user, isLoading, switchPersona } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <PortalHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-xs text-muted font-body">Loading session…</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-paper-alt flex flex-col">
        <PortalHeader />
        <main className="flex-1 max-w-content mx-auto px-4 md:px-6 py-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="rounded-full bg-paper p-3 border border-rule">
            <UserIcon className="h-6 w-6 text-muted" />
          </div>
          <h1 className="text-lg font-heading font-semibold text-ink">
            Session Required
          </h1>
          <p className="text-xs text-muted font-body max-w-sm leading-relaxed">
            Please sign in or select a demo persona to view the portal workspace.
          </p>
          <Link href="/login">
            <Button size="sm" className="text-xs">
              Go to Sign In
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-alt flex flex-col">
      <PortalHeader />

      <main className="flex-1 max-w-content mx-auto px-4 md:px-6 py-8 space-y-8 w-full">
        {/* ── Active User Banner ──────────────────────────────────────────────── */}
        <section
          aria-labelledby="user-banner-heading"
          className="rounded-[3px] border border-rule bg-paper p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 id="user-banner-heading" className="text-lg font-heading font-semibold text-ink">
                Welcome, {user.fullName}
              </h1>
              <Badge variant="outline" className="capitalize text-[11px] font-mono">
                {user.role}
              </Badge>
            </div>
            <p className="text-xs text-muted font-body">
              {user.email} {user.affiliation ? `• ${user.affiliation}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-xs">
                Public Journal Site
              </Button>
            </Link>
          </div>
        </section>

        {/* ── Roadmap / Stage F1 Notice ────────────────────────────────────────── */}
        <section
          aria-labelledby="stage-notice-heading"
          className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 font-body"
        >
          <div className="flex items-center gap-2 border-b border-rule pb-2">
            <Layers className="h-4 w-4 text-accent" />
            <h2 id="stage-notice-heading" className="text-sm font-semibold text-ink">
              Frontend Architecture Status (Part F1 Complete)
            </h2>
          </div>

          <p className="text-xs text-ink/90 leading-relaxed">
            You are viewing the authenticated portal landing shell. In <strong>Part F1</strong>,
            the foundational design system, app shell, trilingual i18n with RTL layout, typed
            mock data layer, public site (Home, Archive, Issue Detail, Article Reader, Search, About,
            Editorial Board, Accessibility, Contact), and authentication flows (Login, Persona Switcher,
            Register, Password Reset) are fully built and verified.
          </p>

          <p className="text-xs text-muted leading-relaxed">
            The specialized portal workflows (Author manuscript submission & revision wizard,
            Reviewer invitation & blinded evaluation scorecard, Editor triage pipeline & reviewer
            matching, and Administrator journal settings & issue assembler) will be mounted in
            subsequent stages (<strong>F2</strong> and <strong>F3</strong>) using the typed mock API
            methods and shared components already wired in this build.
          </p>
        </section>

        {/* ── Quick Switch Persona Panel ───────────────────────────────────────── */}
        <section aria-labelledby="quick-switch-heading" className="space-y-3 font-body">
          <h2
            id="quick-switch-heading"
            className="text-xs font-semibold text-muted uppercase tracking-wider text-[11px]"
          >
            Quick Switch Active Persona (Demo Preview)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              const isCurrent = user.role === p.role;
              return (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => switchPersona(p.role)}
                  className={`p-3.5 rounded-[3px] border text-start transition-all space-y-1.5 ${
                    isCurrent
                      ? "border-accent bg-paper ring-1 ring-accent"
                      : "border-rule bg-paper hover:border-ink/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink uppercase tracking-wide">
                      {p.label}
                    </span>
                    <Icon className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <p className="text-xs text-ink font-medium truncate">{p.name}</p>
                  <div className="flex items-center gap-1 text-[11px] text-accent">
                    <span>{isCurrent ? "Active session" : "Switch to role"}</span>
                    {!isCurrent && <ArrowRight className="h-2.5 w-2.5 rtl:rotate-180" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-rule bg-paper py-4 text-center text-xs text-muted">
        <span>Part F1 Mock Portal Environment • Light Theme • Latin Digits Only</span>
      </footer>
    </div>
  );
}
