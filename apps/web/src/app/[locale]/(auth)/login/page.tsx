"use client";

import React, { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth/session-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, User, CheckCircle2, Shield, Edit3, BookOpen } from "lucide-react";
import type { Role } from "@/lib/domain/types";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { signIn } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [personaLoading, setPersonaLoading] = useState<Role | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) return;

    setLoading(true);
    try {
      await signIn({ email, password });
      router.push("/portal");
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaClick = async (role: Role) => {
    setError(null);
    setPersonaLoading(role);
    try {
      await signIn({ persona: role });
      router.push("/portal");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("invalidCredentials");
      setError(msg);
    } finally {
      setPersonaLoading(null);
    }
  };

  const personas: Array<{ role: Role; label: string; icon: React.ElementType }> = [
    { role: "author", label: t("authorPersona"), icon: Edit3 },
    { role: "reviewer", label: t("reviewerPersona"), icon: CheckCircle2 },
    { role: "editor", label: t("editorPersona"), icon: BookOpen },
    { role: "admin", label: t("adminPersona"), icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-heading font-semibold text-ink">
          {t("signInTitle")}
        </h1>
        <p className="text-xs text-muted font-body leading-relaxed">
          {t("signInSubtitle")}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[3px] border border-danger/30 bg-danger/5 p-3 flex items-start gap-2.5 text-xs text-danger font-body"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Standard Credentials Form ───────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-xs font-medium">
            {t("emailLabel")}
          </Label>
          <Input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-xs"
            placeholder="author@university.example"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-medium">
              {t("passwordLabel")}
            </Label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-accent hover:underline font-body"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-xs"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || personaLoading !== null}
          className="w-full text-xs"
          size="sm"
        >
          <User className="h-3.5 w-3.5 me-1.5" />
          <span>{loading ? "Signing in…" : t("signInButton")}</span>
        </Button>
      </form>

      <div className="text-center text-xs text-muted font-body">
        <span>{t("noAccount")} </span>
        <Link href="/register" className="text-accent underline font-medium hover:text-ink">
          {t("registerTitle")}
        </Link>
      </div>

      {/* ── Demo Preview Mode Personas ───────────────────────────────────────── */}
      <section
        aria-label="Demo Preview Personas"
        className="pt-4 border-t border-rule space-y-3"
      >
        <div className="text-center space-y-1">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t("previewModeHeading")}
          </span>
          <p className="text-[11px] text-muted font-body leading-relaxed">
            {t("previewModeDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {personas.map((p) => {
            const Icon = p.icon;
            const isThisLoading = personaLoading === p.role;
            return (
              <button
                key={p.role}
                type="button"
                onClick={() => handlePersonaClick(p.role)}
                disabled={loading || personaLoading !== null}
                className="w-full text-start flex items-center gap-2.5 p-2.5 rounded-[3px] border border-rule bg-paper-alt hover:bg-paper hover:border-accent text-xs font-body transition-colors disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="truncate flex-1 text-ink/90 font-medium">{p.label}</span>
                {isThisLoading && <span className="text-[10px] text-muted">…</span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
