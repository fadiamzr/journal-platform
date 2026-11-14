"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Send } from "lucide-react";
import { useTranslations } from "next-intl";

export function ContactForm() {
  const t = useTranslations("contact");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;

    setLoading(true);
    // Simulate network roundtrip in mock mode
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 400);
  };

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-[3px] border border-success/40 bg-success/5 p-6 space-y-3"
      >
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          <h3 className="text-sm font-semibold font-body">Message Dispatched</h3>
        </div>
        <p className="text-xs text-ink/90 font-body leading-relaxed">
          {t("sentSuccess")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSubmitted(false);
            setForm({ name: "", email: "", subject: "", message: "" });
          }}
          className="mt-2 text-xs"
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="contact-name" className="text-xs font-medium">
          {t("nameLabel")} <span className="text-danger">*</span>
        </Label>
        <Input
          id="contact-name"
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-email" className="text-xs font-medium">
          {t("emailLabel")} <span className="text-danger">*</span>
        </Label>
        <Input
          id="contact-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          className="text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-subject" className="text-xs font-medium">
          {t("subjectLabel")}
        </Label>
        <Input
          id="contact-subject"
          type="text"
          value={form.subject}
          onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
          className="text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message" className="text-xs font-medium">
          {t("messageLabel")} <span className="text-danger">*</span>
        </Label>
        <Textarea
          id="contact-message"
          required
          rows={5}
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          className="text-xs"
        />
      </div>

      <Button type="submit" disabled={loading} size="sm" className="w-full sm:w-auto">
        <Send className="h-3.5 w-3.5 me-1.5" />
        <span>{loading ? "Sending…" : t("sendButton")}</span>
      </Button>
    </form>
  );
}
