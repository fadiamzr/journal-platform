import { describe, it, expect, beforeEach } from "vitest";
import { resetDemoData } from "@/lib/api/mock/store";
import { mockApiClient } from "@/lib/api/mock/client";

describe("Mock AI Extraction Engine", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("initiates extraction and returns pending status", async () => {
    await mockApiClient.signIn({ persona: "author" });
    const draft = await mockApiClient.createDraft({
      manuscriptLanguage: "en",
      title: { en: "AI Assisted Epistemology Study" },
    });

    const extraction = await mockApiClient.runExtraction(draft.id);
    expect(extraction.status).toBe("pending");

    const polled = await mockApiClient.getExtraction(draft.id);
    expect(["pending", "succeeded"]).toContain(polled.status);
  });

  it("handles corrupted/failed document trigger fixture", async () => {
    await mockApiClient.signIn({ persona: "author" });
    const draft = await mockApiClient.createDraft({
      manuscriptLanguage: "fr",
      title: { fr: "Corrupted Scan fail_extraction document" },
    });

    const failed = await mockApiClient.runExtraction(draft.id);
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("unparseable");
  });
});
