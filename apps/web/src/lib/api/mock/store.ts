import type {
  Article,
  ExtractionResult,
  Issue,
  JournalSettings,
  Review,
  ReviewAssignment,
  Submission,
  SubmissionStatus,
  User,
} from "@/lib/domain/types";
import { ApiError } from "@/lib/api/client";
import {
  SEED_ARTICLES,
  SEED_ASSIGNMENTS,
  SEED_ISSUES,
  SEED_REVIEWS,
  SEED_SETTINGS,
  SEED_SUBMISSIONS,
  SEED_USERS,
} from "./seed";

const STORAGE_KEY = "journal_platform_mock_v1";

export interface MockStoreData {
  users: User[];
  issues: Issue[];
  articles: Article[];
  submissions: Submission[];
  assignments: ReviewAssignment[];
  reviews: Review[];
  settings: JournalSettings;
  extractions: Record<string, ExtractionResult>;
  currentUserId: string | null;
}

function getDefaultStore(): MockStoreData {
  return {
    users: JSON.parse(JSON.stringify(SEED_USERS)),
    issues: JSON.parse(JSON.stringify(SEED_ISSUES)),
    articles: JSON.parse(JSON.stringify(SEED_ARTICLES)),
    submissions: JSON.parse(JSON.stringify(SEED_SUBMISSIONS)),
    assignments: JSON.parse(JSON.stringify(SEED_ASSIGNMENTS)),
    reviews: JSON.parse(JSON.stringify(SEED_REVIEWS)),
    settings: JSON.parse(JSON.stringify(SEED_SETTINGS)),
    extractions: {},
    currentUserId: "usr-author-01", // Default preview persona is Author
  };
}

let inMemoryStore: MockStoreData = getDefaultStore();

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadStore(): MockStoreData {
  if (!isBrowser()) {
    return inMemoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultStore();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as MockStoreData;
  } catch {
    return inMemoryStore;
  }
}

export function saveStore(store: MockStoreData): void {
  inMemoryStore = store;
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn("Failed to persist mock store to localStorage", err);
  }
}

export function resetDemoData(): void {
  const fresh = getDefaultStore();
  saveStore(fresh);
}

export async function simulateLatency(min: number = 200, max: number = 600): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/* ─────────────────────────────────────────────────────────────────────────────
   STATE MACHINE TRANSITION VALIDATOR
   Enforces identical lifecycle rules as the backend:
   • draft -> submitted (requires manuscript uploaded)
   • submitted -> in_review (requires blind copy verified by editor)
   • in_review -> revisions_requested | accepted | rejected
   • revisions_requested -> submitted (increments round)
   • accepted -> published (via issue publishing)
────────────────────────────────────────────────────────────────────────────── */

export function validateStatusTransition(
  submission: Submission,
  nextStatus: SubmissionStatus,
  options?: { responseToReviewers?: string }
): void {
  const current = submission.status;

  if (current === nextStatus) return;

  switch (current) {
    case "draft":
      if (nextStatus !== "submitted") {
        throw new ApiError(
          `Invalid transition from draft to ${nextStatus}. Drafts can only be submitted.`,
          422,
          "INVALID_TRANSITION"
        );
      }
      const round1 = submission.versions?.find((v) => v.round === submission.currentRound);
      if (!round1?.hasManuscript) {
        throw new ApiError(
          "Cannot submit without an uploaded manuscript file.",
          400,
          "MANUSCRIPT_REQUIRED"
        );
      }
      break;

    case "submitted":
      if (nextStatus === "in_review") {
        const v = submission.versions?.find((ver) => ver.round === submission.currentRound);
        if (!v?.hasBlindCopy || !v?.blindCopyVerified) {
          throw new ApiError(
            "Cannot move submission to in_review without an editor-verified blind copy.",
            400,
            "UNVERIFIED_BLIND_COPY"
          );
        }
      } else if (nextStatus === "rejected") {
        // Direct rejection on triage is permitted
      } else {
        throw new ApiError(
          `Invalid transition from submitted to ${nextStatus}.`,
          422,
          "INVALID_TRANSITION"
        );
      }
      break;

    case "in_review":
      if (
        nextStatus !== "revisions_requested" &&
        nextStatus !== "accepted" &&
        nextStatus !== "rejected"
      ) {
        throw new ApiError(
          `Invalid transition from in_review to ${nextStatus}. Expected revisions_requested, accepted, or rejected.`,
          422,
          "INVALID_TRANSITION"
        );
      }
      break;

    case "revisions_requested":
      if (nextStatus !== "submitted") {
        throw new ApiError(
          `Invalid transition from revisions_requested to ${nextStatus}. Submissions must be resubmitted.`,
          422,
          "INVALID_TRANSITION"
        );
      }
      if (!options?.responseToReviewers || options.responseToReviewers.trim().length === 0) {
        throw new ApiError(
          "A response to reviewers note is required upon resubmission.",
          400,
          "RESPONSE_NOTE_REQUIRED"
        );
      }
      break;

    case "accepted":
      if (nextStatus !== "published") {
        throw new ApiError(
          `Invalid transition from accepted to ${nextStatus}. Accepted submissions can only be published.`,
          422,
          "INVALID_TRANSITION"
        );
      }
      break;

    case "rejected":
    case "published":
      throw new ApiError(
        `Submissions in terminal status "${current}" cannot be transitioned.`,
        422,
        "TERMINAL_STATE"
      );

    default:
      throw new ApiError(
        `Unknown submission status: ${current}`,
        422,
        "INVALID_STATUS"
      );
  }
}
