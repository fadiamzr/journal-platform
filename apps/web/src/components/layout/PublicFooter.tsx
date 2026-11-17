"use client";

import React, { useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Monogram } from "@/components/shared/Monogram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, ArrowRight, BookOpen } from "lucide-react";

export function PublicFooter() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");

  const [newsletterEmail, setNewsletterEmail] = useState("");

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;

    toast.success(tCommon("newsletterSuccess"));
    setNewsletterEmail("");
  };

  return (
    <footer className="border-t-2 border-t-gold/70 border-b-0 bg-paper-alt mt-auto pt-14 pb-8 text-xs text-muted font-body">
      <div className="max-w-content mx-auto px-4 md:px-6">
        {/* 4-column academic grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-rule">
          {/* Col 1: About the Journal */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Monogram size={26} />
              <h4 className="font-heading font-bold text-base text-ink tracking-tight uppercase">
                {brand.name}
              </h4>
            </div>
            <p className="leading-relaxed text-[12px] text-ink/80">
              {t("publishedBy", {
                publisher: brand.publisher.name,
                location: brand.publisher.location,
              })}
            </p>
            <div className="font-mono text-[11px] text-muted space-y-0.5 pt-1">
              <div>ISSN {brand.issn.print} (Print)</div>
              <div>ISSN {brand.issn.online} (Online)</div>
            </div>
            <ul className="space-y-1.5 list-none p-0 pt-2 m-0 text-xs">
              <li>
                <Link href="/about" className="hover:text-accent academic-link">
                  {tNav("about")}
                </Link>
              </li>
              <li>
                <Link href="/editorial-board" className="hover:text-accent academic-link">
                  {tNav("editorialBoard")}
                </Link>
              </li>
              <li>
                <Link href="/accessibility" className="hover:text-accent academic-link">
                  {t("accessibility")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 2: For Authors */}
          <div className="space-y-3">
            <h5 className="font-semibold text-ink uppercase tracking-wider text-[11px] border-b border-rule/60 pb-1.5">
              {tNav("forAuthors")}
            </h5>
            <ul className="space-y-2 list-none p-0 m-0 text-xs">
              <li>
                <Link href="/for-authors" className="hover:text-accent academic-link">
                  Guidelines & Word Limits
                </Link>
              </li>
              <li>
                <Link href="/for-authors#anonymization" className="hover:text-accent academic-link">
                  Double-Blind Preparation
                </Link>
              </li>
              <li>
                <Link href="/for-authors#faq" className="hover:text-accent academic-link">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link href="/for-authors" className="hover:text-accent academic-link">
                  Diamond Open Access (No APCs)
                </Link>
              </li>
              <li className="pt-2">
                <Link href="/login">
                  <Button variant="secondary" size="sm" className="h-7 text-[11px] w-full justify-between">
                    <span>{tNav("submitManuscript")}</span>
                    <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </Button>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Archive by Year */}
          <div className="space-y-3">
            <h5 className="font-semibold text-ink uppercase tracking-wider text-[11px] border-b border-rule/60 pb-1.5">
              {tCommon("archiveByYear")}
            </h5>
            <ul className="space-y-2 list-none p-0 m-0 text-xs">
              <li>
                <Link
                  href="/issues/current"
                  className="hover:text-accent academic-link flex items-center justify-between"
                >
                  <span>{tNav("currentIssue")}</span>
                  <span className="text-[10px] text-accent font-mono font-medium">2026</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/issues?year=2026"
                  className="hover:text-accent academic-link flex items-center justify-between"
                >
                  <span>Volume 2 (2026)</span>
                  <BookOpen className="h-3 w-3 text-muted/60" />
                </Link>
              </li>
              <li>
                <Link
                  href="/issues?year=2025"
                  className="hover:text-accent academic-link flex items-center justify-between"
                >
                  <span>Volume 1 (2025)</span>
                  <BookOpen className="h-3 w-3 text-muted/60" />
                </Link>
              </li>
              <li className="pt-2">
                <Link
                  href="/issues"
                  className="text-accent font-medium hover:underline text-[11px] inline-flex items-center gap-1"
                >
                  <span>{tCommon("viewAllIssues")}</span>
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Editorial Office & Alerts */}
          <div className="space-y-3">
            <h5 className="font-semibold text-ink uppercase tracking-wider text-[11px] border-b border-rule/60 pb-1.5">
              {tHome("newsletterHeading")}
            </h5>
            <p className="text-[11px] text-muted leading-relaxed">
              {tHome("newsletterSubtitle")}
            </p>

            <form onSubmit={handleNewsletterSubmit} className="space-y-2">
              <Input
                type="email"
                required
                placeholder={tHome("newsletterPlaceholder")}
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="h-8 text-xs bg-paper border-rule"
              />
              <Button type="submit" size="sm" className="w-full h-7 text-xs">
                <Mail className="h-3 w-3 me-1.5" />
                <span>{tHome("newsletterButton")}</span>
              </Button>
            </form>

            <div className="pt-2 text-[11px] text-muted leading-relaxed">
              <span className="font-medium text-ink block">{t("contact")}</span>
              <a
                href={`mailto:${brand.contact.email}`}
                className="text-accent underline font-mono text-[11px] hover:text-ink"
              >
                {brand.contact.email}
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar with Language links and license */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px]">
          <p className="text-muted text-center md:text-start">
            {t("rights")}
          </p>
          <LanguageSwitcher variant="links" />
        </div>
      </div>
    </footer>
  );
}
