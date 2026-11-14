"use client";

import React, { useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    // Simulate reset link dispatch
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 400);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-heading font-semibold text-ink">
          {t("forgotPasswordTitle")}
        </h1>
        <p className="text-xs text-muted font-body leading-relaxed">
          {t("forgotPasswordSubtitle")}
        </p>
      </div>

      {submitted ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[3px] border border-success/40 bg-success/5 p-5 space-y-3 font-body"
        >
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <h2 className="text-sm font-semibold text-ink">{t("resetSentTitle")}</h2>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            {t("resetSentDesc", { email })}
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <ArrowLeft className="h-3.5 w-3.5 me-1.5 rtl:rotate-180" />
                <span>{t("backToSignIn")}</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 font-body">
          <div className="space-y-1.5">
            <Label htmlFor="reset-email" className="text-xs font-medium">
              {t("emailLabel")}
            </Label>
            <Input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-xs"
              placeholder="user@university.example"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full text-xs" size="sm">
            <Mail className="h-3.5 w-3.5 me-1.5" />
            <span>{loading ? "Sending instructions…" : t("sendResetButton")}</span>
          </Button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
              <span>{t("backToSignIn")}</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
