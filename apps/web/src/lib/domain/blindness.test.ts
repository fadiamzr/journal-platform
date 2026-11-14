import { describe, it, expect, beforeEach } from "vitest";
import { resetDemoData } from "@/lib/api/mock/store";
import { mockApiClient } from "@/lib/api/mock/client";

describe("Double-Blind Protocol Integrity", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("ensures reviewer assignment views contain strictly NO author identity fields", async () => {
    await mockApiClient.signIn({ persona: "reviewer" });
    const assignments = await mockApiClient.listAssignments();

    expect(assignments.length).toBeGreaterThan(0);

    for (const item of assignments) {
      // TypeScript compile-time check + Runtime verification:
      const raw = item as unknown as Record<string, unknown>;
      expect(raw.authorId).toBeUndefined();
      expect(raw.authors).toBeUndefined();
      expect(raw.manuscript_path).toBeUndefined();
      expect(raw.manuscriptPath).toBeUndefined();
      expect(item.submissionId).toBeDefined();
      expect(item.title).toBeDefined();
    }
  });

  it("hides anonymized file path from reviewer until assignment is accepted AND verified", async () => {
    await mockApiClient.signIn({ persona: "reviewer" });

    // usr-rev-01 has asg-01 (completed on sub-in-review-01, verified)
    const asg1 = await mockApiClient.getAssignment("asg-01");
    expect(asg1).toBeDefined();
    expect(asg1?.blindCopyVerified).toBe(true);
    expect(asg1?.assignmentStatus).toBe("completed");
    expect(asg1?.anonymizedPath).toContain("mock-storage/anonymized");

    // Check with a newly created invited assignment
    await mockApiClient.signIn({ persona: "editor" });
    const newAsg = await mockApiClient.assignReviewer("sub-submitted-verified", 1, "usr-rev-01");

    await mockApiClient.signIn({ persona: "reviewer" });
    const unacceptedView = await mockApiClient.getAssignment(newAsg.id);
    expect(unacceptedView?.assignmentStatus).toBe("invited");
    // Should be undefined because assignment is not accepted yet!
    expect(unacceptedView?.anonymizedPath).toBeUndefined();
  });

  it("ensures author feedback has anonymous reviewer labels and NO confidential editor notes", async () => {
    await mockApiClient.signIn({ persona: "author" });
    const feedback = await mockApiClient.getFeedback("sub-revisions-req-01");

    expect(feedback).toBeDefined();
    expect(feedback?.reviews.length).toBeGreaterThan(0);

    for (const rev of feedback!.reviews) {
      // Must use anonymous label ("Reviewer 1", "Reviewer 2")
      expect(rev.reviewerLabel).toMatch(/^Reviewer \d+$/);

      // Runtime check that confidential notes and reviewer identity are absent
      const rawRev = rev as unknown as Record<string, unknown>;
      expect(rawRev.confidentialCommentsToEditor).toBeUndefined();
      expect(rawRev.confidentialComments).toBeUndefined();
      expect(rawRev.reviewerId).toBeUndefined();
      expect(rawRev.reviewerName).toBeUndefined();
      expect(rawRev.reviewerEmail).toBeUndefined();

      // Comments to author and scores should be accessible
      expect(rev.commentsToAuthor).toBeDefined();
      expect(rev.scores.methodology).toBeGreaterThanOrEqual(1);
    }
  });
});
