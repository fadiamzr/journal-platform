import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../messages/en.json";
import { SessionProvider } from "@/lib/auth/session-context";
import { resetDemoData } from "@/lib/api/mock/store";
import { mockApiClient } from "@/lib/api/mock/client";
import { SEED_USERS } from "@/lib/api/mock/seed";
import { AuthorsRepeater } from "@/components/author/AuthorsRepeater";
import { Stepper } from "@/components/shared/Stepper";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReviewForm } from "@/components/reviewer/ReviewForm";
import { PdfViewer } from "@/components/reviewer/PdfViewer";
import { ComingSoon } from "@/components/portal/ComingSoon";
import type { Author } from "@/lib/domain/types";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SessionProvider>{ui}</SessionProvider>
    </NextIntlClientProvider>
  );
}

describe("Part F2: Author Portal & Reviewer Workspace", () => {
  beforeEach(() => {
    resetDemoData();
  });

  describe("Double-Blind Protocol Integrity in Rendered DOM", () => {
    it("ensures reviewer PdfViewer contains strictly NO author identities from seed data", async () => {
      await mockApiClient.signIn({ persona: "reviewer" });
      const assignments = await mockApiClient.listAssignments();
      expect(assignments.length).toBeGreaterThan(0);

      const asg = assignments[0];
      const authorUser = SEED_USERS.find((u) => u.role === "author")!;

      const { container } = renderWithProviders(
        <PdfViewer
          src={asg.anonymizedPath}
          title={asg.title.en || "Test Title"}
          manuscriptLanguage={asg.manuscriptLanguage}
        />
      );

      const renderedText = container.textContent || "";

      // Strictly verify author full name is NOT in DOM
      expect(renderedText).not.toContain(authorUser.fullName);
      // Verify author email is NOT in DOM
      expect(renderedText).not.toContain(authorUser.email);
      // Verify author affiliation is NOT in DOM
      if (authorUser.affiliation) {
        expect(renderedText).not.toContain(authorUser.affiliation);
      }
      // Verify double-blind banner is present
      expect(renderedText).toContain("DOUBLE-BLIND PEER REVIEW");
    });

    it("ensures author feedback never exposes reviewer names or confidential editor comments", async () => {
      await mockApiClient.signIn({ persona: "author" });
      const feedback = await mockApiClient.getFeedback("sub-revisions-req-01");

      expect(feedback).toBeDefined();
      expect(feedback?.reviews.length).toBeGreaterThan(0);

      const reviewerUsers = SEED_USERS.filter((u) => u.role === "reviewer");

      // Reviewers in feedback should have anonymous labels
      feedback!.reviews.forEach((rev) => {
        expect(rev.reviewerLabel).toMatch(/^Reviewer \d+$/);

        // Make sure no reviewer user name matches
        reviewerUsers.forEach((r) => {
          expect(rev.reviewerLabel).not.toContain(r.fullName);
          expect(rev.commentsToAuthor).not.toContain(r.fullName);
        });

        // Ensure confidential comments property does not exist on anonymous review
        const raw = rev as unknown as Record<string, unknown>;
        expect(raw.confidentialCommentsToEditor).toBeUndefined();
      });
    });
  });

  describe("Accessibility (vitest-axe) Verifications", () => {
    it("verifies Stepper has no accessibility violations", async () => {
      const steps = [
        { id: "1", label: "Manuscript" },
        { id: "2", label: "Blind copy" },
        { id: "3", label: "Details" },
      ];
      const { container } = renderWithProviders(
        <Stepper steps={steps} currentStepIndex={1} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("verifies FileDropzone has no accessibility violations", async () => {
      const { container } = renderWithProviders(
        <FileDropzone
          onFileSelect={() => {}}
          label="Upload Manuscript PDF"
          hint="PDF up to 50 MB"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("verifies AuthorsRepeater has no accessibility violations", async () => {
      const initialAuthors: Author[] = [
        {
          fullName: "Harriet Vance",
          affiliations: ["University of Edinburgh"],
          email: "h.vance@edinburgh.ac.uk",
          orcid: "0000-0002-1825-0097",
          isCorresponding: true,
        },
      ];

      const { container } = renderWithProviders(
        <AuthorsRepeater authors={initialAuthors} onChange={() => {}} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("verifies StatusBadge has no accessibility violations", async () => {
      const { container } = renderWithProviders(
        <div>
          <StatusBadge status="submitted" />
          <StatusBadge status="in_review" />
          <StatusBadge status="revisions_requested" />
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("verifies ReviewForm in read-only state has no accessibility violations", async () => {
      const mockReview = {
        assignmentId: "asg-01",
        scores: {
          originality: 4,
          methodology: 4,
          clarity: 5,
          significance: 4,
          relevance: 5,
        },
        recommendation: "minor_revisions" as const,
        commentsToAuthor: "Excellent research and empirical depth.",
        confidentialCommentsToEditor: "Solid candidate for publication.",
        submittedAt: "2026-10-08T16:20:00Z",
      };

      const { container } = renderWithProviders(
        <ReviewForm assignmentId="asg-01" initialReview={mockReview} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Reviewer Workflow State Transitions", () => {
    it("handles invitation acceptance, draft saving, and final review submission", async () => {
      await mockApiClient.signIn({ persona: "reviewer" });

      // 1. Check invitation
      const invitation = await mockApiClient.getAssignment("asg-inv-01");
      expect(invitation?.assignmentStatus).toBe("invited");

      // 2. Accept invitation
      const accepted = await mockApiClient.respondToInvitation("asg-inv-01", true);
      expect(accepted.status).toBe("accepted");

      // 3. Save review draft
      const draft = await mockApiClient.saveReviewDraft("asg-inv-01", {
        scores: { originality: 4, methodology: 4, clarity: 4, significance: 4, relevance: 4 },
        recommendation: "minor_revisions",
        commentsToAuthor: "Compelling thesis with solid archival documentation.",
        confidentialCommentsToEditor: "I recommend minor corrections before publication.",
      });
      expect(draft.scores.originality).toBe(4);
      expect(draft.recommendation).toBe("minor_revisions");

      // 4. Submit final review
      const submitted = await mockApiClient.submitReview("asg-inv-01", {
        scores: { originality: 5, methodology: 4, clarity: 5, significance: 5, relevance: 5 },
        recommendation: "accept",
        commentsToAuthor: "Flawless manuscript. Outstanding contribution.",
        confidentialCommentsToEditor: "Publish as lead article.",
      });
      expect(submitted.submittedAt).toBeDefined();

      // 5. Verify assignment marked completed
      const finalAsg = await mockApiClient.getAssignment("asg-inv-01");
      expect(finalAsg?.assignmentStatus).toBe("completed");
    });

    it("handles due date extension requests and conflict reports", async () => {
      await mockApiClient.signIn({ persona: "reviewer" });

      // Extension request
      const extReq = await mockApiClient.requestDueDateExtension("asg-acc-01", {
        proposedDate: "2026-12-15",
        reason: "Archive travel schedule conflict",
      });
      expect(extReq.assignmentId).toBe("asg-acc-01");
      expect(extReq.proposedDate).toBe("2026-12-15");
      expect(extReq.reason).toContain("Archive travel");

      // Conflict report declines assignment
      const confReport = await mockApiClient.reportConflict(
        "asg-acc-01",
        "Author identity recognized from conference presentation."
      );
      expect(confReport.assignmentId).toBe("asg-acc-01");
      expect(confReport.reason).toContain("Author identity recognized");

      const postConflict = await mockApiClient.getAssignment("asg-acc-01");
      expect(postConflict?.assignmentStatus).toBe("declined");
    });
  });

  describe("Portal Redirection & Coming Soon Pages (F2.1 Polish)", () => {
    it("renders ComingSoon for editor with explanations of triage, reviewers, issues, and decisions", () => {
      const { container } = renderWithProviders(<ComingSoon role="editor" />);
      const text = container.textContent || "";
      expect(text).toContain("Editorial Dashboard");
      expect(text).toContain("Manuscript Triage");
      expect(text).toContain("Reviewer Matching");
      expect(text).toContain("Issue Builder");
      expect(text).toContain("Editorial Decisions");

      // Verify no honorifics in displayed persona cards
      expect(text).not.toContain("Dr. Harriet Vance");
      expect(text).not.toContain("Prof. Arthur Pendelton");
      expect(text).not.toContain("Prof. Hélène Vance");
      expect(text).not.toContain("Dr. Tariq Al-Mansoor");
      expect(text).toContain("Harriet Vance");
      expect(text).toContain("Arthur Pendelton");
      expect(text).toContain("Hélène Vance");
      expect(text).toContain("Tariq Al-Mansoor");
    });

    it("renders ComingSoon for admin with explanations of users, settings, publication, and analytics", () => {
      const { container } = renderWithProviders(<ComingSoon role="admin" />);
      const text = container.textContent || "";
      expect(text).toContain("Administration Panel");
      expect(text).toContain("User Management");
      expect(text).toContain("Journal Configuration");
      expect(text).toContain("Publication Management");
      expect(text).toContain("Platform Analytics");
    });

    it("verifies ComingSoon has no accessibility violations", async () => {
      const { container } = renderWithProviders(<ComingSoon role="editor" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
