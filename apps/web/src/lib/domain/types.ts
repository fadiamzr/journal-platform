export type Role = "author" | "reviewer" | "editor" | "admin";

export type Locale = "en" | "fr" | "ar";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "revisions_requested"
  | "accepted"
  | "rejected"
  | "published";

export type ExtractionStatus = "not_started" | "pending" | "succeeded" | "failed";

export type AssignmentStatus = "invited" | "accepted" | "declined" | "completed";

export type Recommendation = "accept" | "minor_revisions" | "major_revisions" | "reject";

export type MultilingualText = Partial<Record<Locale, string>>;

export type Keywords = Partial<Record<Locale, string[]>>;

export interface Author {
  fullName: string;
  affiliations: string[];
  email?: string;
  orcid?: string;
  isCorresponding?: boolean;
}

export interface SubmissionVersion {
  round: number;
  hasManuscript: boolean;
  hasBlindCopy: boolean;
  blindCopyVerified: boolean;
  blindCopyReviewNote?: string;
  sizeBytes?: number;
  responseToReviewers?: string;
}

export interface StatusEvent {
  from: SubmissionStatus;
  to: SubmissionStatus;
  at: string;
}

export interface Submission {
  id: string;
  authorId: string;
  status: SubmissionStatus;
  manuscriptLanguage: Locale;
  title: MultilingualText;
  abstract: MultilingualText;
  keywords: Keywords;
  authors: Author[];
  currentRound: number;
  versions?: SubmissionVersion[];
  extractionStatus: ExtractionStatus;
  extractionError?: string;
  decisionNote?: string;
  createdAt: string;
  submittedAt?: string;
  decidedAt?: string;
  publishedAt?: string;
  issueId?: string;
  articleOrder?: number;
  doi?: string;
  history?: StatusEvent[];
}

export interface JournalSettings {
  journalName: string;
  issnPrint: string;
  issnOnline: string;
  publisherName: string;
  contactEmail: string;
  allowOpenSubmissions: boolean;
}

export interface ExtractionResult {
  status: "not_started" | "pending" | "succeeded" | "failed";
  title?: MultilingualText;
  abstract?: MultilingualText;
  keywords?: Keywords;
  authors?: Author[];
  error?: string;
}

export interface ReviewAssignment {
  id: string;
  submissionId: string;
  round: number;
  reviewerId: string;
  status: AssignmentStatus;
  dueAt: string;
  invitedAt: string;
}

export interface ReviewScores {
  originality: number; // 1-5
  methodology: number; // 1-5
  clarity: number; // 1-5
  significance: number; // 1-5
  relevance: number; // 1-5
}

export interface Review {
  assignmentId: string;
  scores: ReviewScores;
  recommendation: Recommendation;
  commentsToAuthor: string;
  confidentialCommentsToEditor: string;
  submittedAt?: string;
}

export type IssueStatus = "draft" | "published";

export interface Issue {
  id: string;
  volume: number;
  number: number;
  year: number;
  title?: MultilingualText;
  status: IssueStatus;
  publishedAt?: string;
  articles?: Article[];
}

/**
 * Public view of a published submission.
 */
export interface Article {
  id: string;
  submissionId: string;
  issueId?: string;
  doi?: string;
  title: MultilingualText;
  abstract: MultilingualText;
  keywords: Keywords;
  manuscriptLanguage: Locale;
  authors: Author[];
  publishedAt: string;
  volume?: number;
  number?: number;
  year?: number;
  pdfUrl: string;
  order?: number;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  preferredLocale: Locale;
  affiliation?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   DOUBLE-BLIND SEPARATION TYPES
   Enforce double-blind privacy at compile-time:
   • Reviewers NEVER receive author identity (no author fields).
   • Authors NEVER receive reviewer identity or confidential editor comments.
────────────────────────────────────────────────────────────────────────────── */

export interface ReviewerSubmissionView {
  assignmentId: string;
  submissionId: string;
  round: number;
  assignmentStatus: AssignmentStatus;
  dueAt: string;
  manuscriptLanguage: Locale;
  title: MultilingualText;
  abstract: MultilingualText;
  keywords: Keywords;
  anonymizedPath?: string;
  blindCopyVerified: boolean;
  // STRICT DOUBLE-BLIND: NO authorId, NO authors list, NO manuscript_path
}

export interface AnonymousReviewFeedbackItem {
  round: number;
  reviewerLabel: string; // "Reviewer 1", "Reviewer 2" (deterministic anonymous label)
  recommendation: Recommendation;
  scores: ReviewScores;
  commentsToAuthor: string;
  submittedAt: string;
  // STRICT DOUBLE-BLIND: NO reviewerId, NO reviewer name, NO confidentialCommentsToEditor
}

export interface AuthorFeedbackView {
  submissionId: string;
  currentRound: number;
  status: SubmissionStatus;
  decisionNote?: string;
  reviews: AnonymousReviewFeedbackItem[];
}
