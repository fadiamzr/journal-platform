"use client";

import React, { useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth/session-context";
import { Search, Menu, User as UserIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";

export function PublicHeader() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/issues/current", label: t("currentIssue") },
    { href: "/issues", label: t("archive") },
    { href: "/for-authors", label: t("forAuthors") },
    { href: "/about", label: t("about") },
    { href: "/editorial-board", label: t("editorialBoard") },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const tagline =
    locale === "ar"
      ? brand.tagline.ar
      : locale === "fr"
      ? brand.tagline.fr
      : brand.tagline.en;

  return (
    <header className="border-b border-rule bg-paper">
      {/* Skip to Content accessible landmark */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-ink focus:text-paper focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {tCommon("skipToContent")}
      </a>

      {/* Utility top bar */}
      <div className="border-b border-rule/50 bg-paper-alt/60 text-xs text-muted">
        <div className="max-w-content mx-auto px-4 md:px-6 h-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">ISSN {brand.issn.online} (Online)</span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="dropdown" />
            <div className="h-3 w-px bg-rule" aria-hidden="true" />
            {user ? (
              <Link
                href="/portal"
                className="inline-flex items-center gap-1 font-medium text-ink hover:text-accent"
              >
                <UserIcon className="h-3 w-3" />
                <span>{tCommon("myPortal")}</span>
                <span className="text-[10px] text-muted capitalize">({user.role})</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="font-medium text-ink hover:text-accent"
              >
                {tCommon("signIn")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div className="max-w-content mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link href="/" className="inline-block group focus:outline-none">
              <span className="text-3xl md:text-5xl font-heading font-bold tracking-tight text-ink group-hover:text-ink/90 transition-colors block">
                {brand.logo.wordmark}
              </span>
            </Link>
            <p className="mt-1.5 text-xs md:text-sm text-muted font-body max-w-xl">
              {tagline}
            </p>
          </div>

          {/* Header search bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="w-full md:w-72 relative"
            role="search"
          >
            <Input
              type="search"
              placeholder={tCommon("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pe-8 text-xs bg-paper-alt/50 border-rule"
            />
            <button
              type="submit"
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-0.5"
              aria-label={tCommon("search")}
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Main navigation */}
      <nav
        aria-label="Main Navigation"
        className="border-t border-rule bg-paper"
      >
        <div className="max-w-content mx-auto px-4 md:px-6 flex items-center justify-between">
          {/* Desktop Nav */}
          <ul className="hidden md:flex items-center gap-6 list-none p-0 m-0 text-[14px]">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`inline-block py-3 font-medium transition-colors border-b-2 -mb-[1px] ${
                      isActive
                        ? "border-accent text-accent"
                        : "border-transparent text-ink/80 hover:text-ink hover:border-rule"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block py-2">
            <Link href="/for-authors">
              <Button size="sm" variant="default" className="text-xs h-7">
                {t("submitManuscript")}
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center justify-between w-full py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Menu
            </span>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Open navigation menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-6">
                <SheetHeader className="mb-6">
                  <SheetTitle className="text-start font-heading text-xl">
                    {brand.name}
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col space-y-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`text-base py-1 ${
                        pathname === link.href
                          ? "font-semibold text-accent"
                          : "text-ink hover:text-accent"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="pt-4 border-t border-rule">
                    <Link
                      href="/for-authors"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Button className="w-full text-xs">
                        {t("submitManuscript")}
                      </Button>
                    </Link>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
