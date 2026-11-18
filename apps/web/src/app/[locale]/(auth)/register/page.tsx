"use client";

import React, { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "@/lib/auth/session-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, UserPlus, Info } from "lucide-react";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const currentLocale = useLocale() as "en" | "fr" | "ar";
  const router = useRouter();
  const { register } = useSession();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [password, setPassword] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<"en" | "fr" | "ar">(currentLocale);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreeTerms) {
      setError("Please agree to the journal's ethical policies to proceed.");
      return;
    }

    if (password.length < 8) {
      setError(t("passwordHint"));
      return;
    }

    setLoading(true);
    try {
      await register({
        fullName,
        email,
        password,
        preferredLocale,
        affiliation: affiliation || undefined,
      });
      router.push("/portal");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-heading font-semibold text-ink">
          {t("registerTitle")}
        </h1>
        <p className="text-xs text-muted font-body leading-relaxed">
          {t("registerSubtitle")}
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

      <form onSubmit={handleSubmit} className="space-y-4 font-body">
        <div className="space-y-1.5">
          <Label htmlFor="reg-name" className="text-xs font-medium">
            {t("fullNameLabel")} <span className="text-danger">*</span>
          </Label>
          <Input
            id="reg-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="text-xs"
            placeholder="Harriet Vance"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-email" className="text-xs font-medium">
            {t("emailLabel")} <span className="text-danger">*</span>
          </Label>
          <Input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-xs"
            placeholder="h.vance@university.example"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-affiliation" className="text-xs font-medium">
            {t("affiliationLabel")}
          </Label>
          <Input
            id="reg-affiliation"
            type="text"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            className="text-xs"
            placeholder="Department of History, University of Paris"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-lang" className="text-xs font-medium">
            {t("preferredLocaleLabel")}
          </Label>
          <Select
            value={preferredLocale}
            onValueChange={(val) => setPreferredLocale(val as "en" | "fr" | "ar")}
          >
            <SelectTrigger id="reg-lang" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="ar">العربية (Arabic)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-password" className="text-xs font-medium">
            {t("passwordLabel")} <span className="text-danger">*</span>
          </Label>
          <Input
            id="reg-password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-xs"
          />
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Info className="h-3 w-3 shrink-0" />
            <span>{t("passwordHint")}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <Checkbox
            id="reg-terms"
            checked={agreeTerms}
            onCheckedChange={(checked) => setAgreeTerms(Boolean(checked))}
            className="mt-0.5"
          />
          <Label
            htmlFor="reg-terms"
            className="text-xs text-ink/90 font-normal leading-relaxed cursor-pointer"
          >
            {t("agreeTerms")}
          </Label>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full text-xs"
          size="sm"
        >
          <UserPlus className="h-3.5 w-3.5 me-1.5" />
          <span>{loading ? "Registering…" : t("registerButton")}</span>
        </Button>
      </form>

      <div className="text-center text-xs text-muted font-body pt-2 border-t border-rule">
        <span>{t("haveAccount")} </span>
        <Link href="/login" className="text-accent underline font-medium hover:text-ink">
          {t("signInButton")}
        </Link>
      </div>
    </div>
  );
}
