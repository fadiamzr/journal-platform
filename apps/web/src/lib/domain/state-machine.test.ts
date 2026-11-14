import { describe, it, expect, beforeEach } from "vitest";
import { validateStatusTransition, resetDemoData } from "@/lib/api/mock/store";
import { mockApiClient } from "@/lib/api/mock/client";
import type { Submission } from "@/lib/domain/types";

describe("Workflow State Machine Guards", () => {
  beforeEach(() => {
    resetDemoData();
  });

  const baseSubmission: Submission = {
    id: "test-sub-01",
    authorId: "usr-author-01",
    status: "draft",
    manuscriptLanguage: "en",
    title: { en: "Test Manuscript" },
    abstract: {},
    keywords: {},
    authors: [{ fullName: "Author", affiliations: [] }],
    currentRound: 1,
    extractionStatus: "not_started",
    createdAt: new Date().toISOString(),
    versions: [
      {
        round: 1,
        hasManuscript: false,
        hasBlindCopy: false,
        blindCopyVerified: false,
      },
    ],
  };

  it("prevents submitting a draft without an uploaded manuscript", () => {
    expect(() => validateStatusTransition(baseSubmission, "submitted")).toThrowError(
      /manuscript file/i
    );
  });

  it("allows submitting a draft when manuscript is uploaded", () => {
    const withManuscript: Submission = {
      ...baseSubmission,
      versions: [
        {
          round: 1,
          hasManuscript: true,
          hasBlindCopy: false,
          blindCopyVerified: false,
        },
      ],
    };
    expect(() => validateStatusTransition(withManuscript, "submitted")).not.toThrow();
  });

  it("prevents submitted -> in_review when blind copy is unverified", () => {
    const submittedSub: Submission = {
      ...baseSubmission,
      status: "submitted",
      versions: [
        {
          round: 1,
          hasManuscript: true,
          hasBlindCopy: true,
          blindCopyVerified: false,
        },
      ],
    };
    expect(() => validateStatusTransition(submittedSub, "in_review")).toThrowError(
      /verified blind copy/i
    );
  });

  it("allows submitted -> in_review when blind copy is verified", () => {
    const verifiedSub: Submission = {
      ...baseSubmission,
      status: "submitted",
      versions: [
        {
          round: 1,
          hasManuscript: true,
          hasBlindCopy: true,
          blindCopyVerified: true,
        },
      ],
    };
    expect(() => validateStatusTransition(verifiedSub, "in_review")).not.toThrow();
  });

  it("allows in_review -> accepted, revisions_requested, or rejected", () => {
    const inReviewSub: Submission = {
      ...baseSubmission,
      status: "in_review",
    };
    expect(() => validateStatusTransition(inReviewSub, "accepted")).not.toThrow();
    expect(() => validateStatusTransition(inReviewSub, "revisions_requested")).not.toThrow();
    expect(() => validateStatusTransition(inReviewSub, "rejected")).not.toThrow();
  });

  it("forbids in_review -> published directly", () => {
    const inReviewSub: Submission = {
      ...baseSubmission,
      status: "in_review",
    };
    expect(() => validateStatusTransition(inReviewSub, "published")).toThrowError(
      /invalid transition/i
    );
  });

  it("requires response to reviewers when resubmitting from revisions_requested", () => {
    const revisionsSub: Submission = {
      ...baseSubmission,
      status: "revisions_requested",
    };
    expect(() => validateStatusTransition(revisionsSub, "submitted")).toThrowError(
      /response to reviewers note is required/i
    );
    expect(() =>
      validateStatusTransition(revisionsSub, "submitted", { responseToReviewers: "Addressed comments." })
    ).not.toThrow();
  });

  it("increments round and adds a new version upon resubmission", async () => {
    await mockApiClient.signIn({ persona: "author" });
    const updated = await mockApiClient.resubmitRevision(
      "sub-revisions-req-01",
      "We have addressed all reviewer recommendations in full."
    );

    expect(updated.currentRound).toBe(2);
    expect(updated.status).toBe("submitted");
    const round2 = updated.versions?.find((v) => v.round === 2);
    expect(round2).toBeDefined();
    expect(round2?.blindCopyVerified).toBe(false); // Must be re-verified
    expect(round2?.responseToReviewers).toContain("addressed all reviewer");
  });

  it("rejects transitions on terminal states (published / rejected)", () => {
    const publishedSub: Submission = { ...baseSubmission, status: "published" };
    const rejectedSub: Submission = { ...baseSubmission, status: "rejected" };

    expect(() => validateStatusTransition(publishedSub, "in_review")).toThrowError(
      /terminal status/i
    );
    expect(() => validateStatusTransition(rejectedSub, "submitted")).toThrowError(
      /terminal status/i
    );
  });
});
