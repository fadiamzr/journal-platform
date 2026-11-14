import React from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function PublicFooter() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="border-t border-rule bg-paper-alt mt-auto py-12 text-xs text-muted">
      <div className="max-w-content mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-rule">
          {/* Col 1: Brand & Publisher */}
          <div className="space-y-2 md:col-span-2">
            <h4 className="font-heading font-semibold text-sm text-ink tracking-tight">
              {brand.name}
            </h4>
            <p className="leading-relaxed max-w-sm">
              {t("publishedBy", {
                publisher: brand.publisher.name,
                location: brand.publisher.location,
              })}
            </p>
            <p className="font-mono text-[11px]">
              {t("issn", {
                print: brand.issn.print,
                online: brand.issn.online,
              })}
            </p>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-2">
            <h5 className="font-semibold text-ink uppercase tracking-wider text-[11px]">
              Navigation
            </h5>
            <ul className="space-y-1.5 list-none p-0 m-0">
              <li>
                <Link href="/issues/current" className="hover:text-ink hover:underline">
                  {tNav("currentIssue")}
                </Link>
              </li>
              <li>
                <Link href="/issues" className="hover:text-ink hover:underline">
                  {tNav("archive")}
                </Link>
              </li>
              <li>
                <Link href="/for-authors" className="hover:text-ink hover:underline">
                  {tNav("forAuthors")}
                </Link>
              </li>
              <li>
                <Link href="/editorial-board" className="hover:text-ink hover:underline">
                  {tNav("editorialBoard")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Policies & Compliance */}
          <div className="space-y-2">
            <h5 className="font-semibold text-ink uppercase tracking-wider text-[11px]">
              Information
            </h5>
            <ul className="space-y-1.5 list-none p-0 m-0">
              <li>
                <Link href="/about" className="hover:text-ink hover:underline">
                  {tNav("about")}
                </Link>
              </li>
              <li>
                <Link href="/accessibility" className="hover:text-ink hover:underline">
                  {t("accessibility")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-ink hover:underline">
                  {t("contact")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar with Language links and license */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-muted">
            {t("rights")}
          </p>
          <LanguageSwitcher variant="links" />
        </div>
      </div>
    </footer>
  );
}
