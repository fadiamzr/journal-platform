"use client";

import React, { useState, useEffect } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useSession } from "@/lib/auth/session-context";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ORCID_REGEX } from "@/components/author/AuthorsRepeater";
import {
  User,
  Bell,
  Key,
  CheckCircle2,
  AlertCircle,
  Globe,
} from "lucide-react";
import type { Locale } from "@/lib/domain/types";

export default function ReviewerProfilePage() {
  const t = useTranslations("author.profile");
  const tNav = useTranslations("portalNav");
  const tCommon = useTranslations("common");
  const { user, refreshSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [fullName, setFullName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [orcid, setOrcid] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<Locale>("en");

  // Notifications toggles
  const [notifSubmissions, setNotifSubmissions] = useState(true);
  const [notifReviews, setNotifReviews] = useState(true);
  const [notifDecisions, setNotifDecisions] = useState(true);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setAffiliation(user.affiliation || "");
      setOrcid(user.orcid || "");
      setPreferredLocale(user.preferredLocale || "en");
      if (user.notificationPreferences) {
        setNotifSubmissions(user.notificationPreferences.submissions ?? true);
        setNotifReviews(user.notificationPreferences.reviews ?? true);
        setNotifDecisions(user.notificationPreferences.decisions ?? true);
      }
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMessage(null);
    setSaveSuccess(false);

    if (orcid && !ORCID_REGEX.test(orcid)) {
      setErrorMessage("Please enter a valid ORCID iD in the format 0000-0000-0000-0000.");
      return;
    }

    try {
      setSaving(true);
      await api.updateProfile(user.id, {
        fullName,
        affiliation,
        orcid,
        preferredLocale,
        notificationPreferences: {
          submissions: notifSubmissions,
          reviews: notifReviews,
          decisions: notifDecisions,
        },
      });

      // Handle password change if filled
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          setErrorMessage("New password and confirmation do not match.");
          return;
        }
        await api.changePassword(user.id, { currentPassword, newPassword });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }

      await refreshSession();
      setSaveSuccess(true);

      // If locale changed, update route
      if (preferredLocale !== user.preferredLocale) {
        router.replace(pathname, { locale: preferredLocale });
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout
      allowedRoles={["reviewer", "editor", "admin"]}
      breadcrumbs={[
        { label: tNav("reviewerReviews"), href: "/reviewer" },
        { label: tNav("reviewerProfile") },
      ]}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="border-b border-rule pb-4">
          <h1 className="text-xl font-heading font-semibold text-ink">
            Reviewer Profile
          </h1>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Manage your peer review expertise credentials, institutional affiliation, ORCID identifier, and notification preferences.
          </p>
        </div>

        {saveSuccess && (
          <div
            role="status"
            className="rounded border border-success/30 bg-success-bg/20 p-3.5 text-xs text-success flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="font-medium text-ink">{t("saveSuccess")}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded border border-danger/30 bg-danger-bg/50 p-3.5 text-xs text-danger flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Identity & Institutional Affiliation */}
          <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
              <User className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span>Identity & Academic Affiliation</span>
            </h2>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="prof-name" className="text-xs font-medium text-ink">
                  {t("fullName")} <span className="text-danger">*</span>
                </Label>
                <Input
                  id="prof-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-xs h-8 bg-paper"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="prof-aff" className="text-xs font-medium text-ink">
                  {t("affiliation")}
                </Label>
                <Input
                  id="prof-aff"
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  placeholder="e.g. Faculty of Social Sciences, Oxford University"
                  className="text-xs h-8 bg-paper"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="prof-orcid" className="text-xs font-medium text-ink flex items-center justify-between">
                  <span>{t("orcid")}</span>
                  <span className="text-[10px] text-muted font-mono font-normal">
                    0000-0000-0000-0000
                  </span>
                </Label>
                <Input
                  id="prof-orcid"
                  value={orcid}
                  onChange={(e) => setOrcid(e.target.value.trim())}
                  placeholder="0000-0002-1825-0097"
                  className="text-xs h-8 font-mono bg-paper"
                />
              </div>

              <div className="space-y-1 pt-1">
                <Label htmlFor="prof-locale" className="text-xs font-medium text-ink flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
                  <span>{t("preferredLocale")}</span>
                </Label>
                <select
                  id="prof-locale"
                  value={preferredLocale}
                  onChange={(e) => setPreferredLocale(e.target.value as Locale)}
                  className="w-full text-xs h-8 rounded border border-rule bg-paper px-2.5 focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية (Arabic)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
              <Bell className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span>{t("notificationsHeading")}</span>
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="notif-sub"
                  checked={notifSubmissions}
                  onCheckedChange={(c) => setNotifSubmissions(Boolean(c))}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="notif-sub"
                  className="text-xs text-ink font-normal cursor-pointer leading-relaxed"
                >
                  {t("notifSubmissions")}
                </Label>
              </div>

              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="notif-rev"
                  checked={notifReviews}
                  onCheckedChange={(c) => setNotifReviews(Boolean(c))}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="notif-rev"
                  className="text-xs text-ink font-normal cursor-pointer leading-relaxed"
                >
                  {t("notifReviews")}
                </Label>
              </div>

              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="notif-dec"
                  checked={notifDecisions}
                  onCheckedChange={(c) => setNotifDecisions(Boolean(c))}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="notif-dec"
                  className="text-xs text-ink font-normal cursor-pointer leading-relaxed"
                >
                  {t("notifDecisions")}
                </Label>
              </div>
            </div>
          </div>

          {/* Security & Password */}
          <div className="rounded-[3px] border border-rule bg-paper p-6 space-y-4 shadow-xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
              <Key className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span>{t("passwordHeading")}</span>
            </h2>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cur-pass" className="text-xs font-medium text-ink">
                  {t("currentPassword")}
                </Label>
                <Input
                  id="cur-pass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="text-xs h-8 bg-paper"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-pass" className="text-xs font-medium text-ink">
                    {t("newPassword")}
                  </Label>
                  <Input
                    id="new-pass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="text-xs h-8 bg-paper"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="conf-pass" className="text-xs font-medium text-ink">
                    Confirm Password
                  </Label>
                  <Input
                    id="conf-pass"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-xs h-8 bg-paper"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="text-xs px-6 shadow-xs"
            >
              {saving ? tCommon("loading") : tCommon("save")}
            </Button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
