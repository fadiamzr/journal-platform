import React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ContactForm } from "@/components/contact/ContactForm";
import { brand } from "@/config/brand";
import { Mail, Phone, MapPin, Building2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "contact" });

  return (
    <div className="space-y-12 max-w-reading mx-auto">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
        {/* ── Left / Main: Contact Form ─────────────────────────────────────── */}
        <div className="md:col-span-3 rounded-[3px] border border-rule bg-paper p-6 space-y-4">
          <h2 className="text-sm font-semibold font-body text-ink uppercase tracking-wider text-[11px] border-b border-rule pb-2">
            Direct Inquiry
          </h2>
          <ContactForm />
        </div>

        {/* ── Right / Aside: Office Details ─────────────────────────────────── */}
        <aside
          aria-labelledby="office-details-heading"
          className="md:col-span-2 rounded-[3px] border border-rule bg-paper-alt p-6 space-y-5 font-body text-xs"
        >
          <h2
            id="office-details-heading"
            className="text-xs font-semibold text-ink uppercase tracking-wider text-[11px] border-b border-rule pb-2"
          >
            {t("officeHeading")}
          </h2>

          <div className="space-y-3.5">
            <div className="flex items-start gap-2.5">
              <Mail className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] text-muted uppercase">Email</span>
                <a
                  href={`mailto:${brand.contact.email}`}
                  className="text-accent underline font-mono text-[11px] hover:text-ink"
                >
                  {brand.contact.email}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Phone className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] text-muted uppercase">Phone</span>
                <span className="font-mono text-[11px] text-ink">{brand.contact.phone}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] text-muted uppercase">Address</span>
                <span className="text-ink leading-relaxed">{brand.contact.address}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2 border-t border-rule">
              <Building2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] text-muted uppercase">Publisher</span>
                <span className="text-ink font-medium">{brand.publisher.name}</span>
                <span className="block text-muted">{brand.publisher.location}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
