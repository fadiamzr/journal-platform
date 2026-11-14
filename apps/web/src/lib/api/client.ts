import type {
  Article,
  Author,
  AuthorFeedbackView,
  ExtractionResult,
  Issue,
  JournalSettings,
  Keywords,
  Locale,
  MultilingualText,
  Recommendation,
  Review,
  ReviewAssignment,
  ReviewScores,
  ReviewerSubmissionView,
  Role,
  Submission,
  User,
} from "@/lib/domain/types";

export type { ExtractionResult, JournalSettings };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = "BAD_REQUEST",
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ArticleFilters {
  language?: Locale;
  year?: number;
  issueId?: string;
}

export interface SearchParams {
  query?: string;
  language?: Locale;
  year?: number;
  issueId?: string;
}

export interface SignInCredentials {
  email?: string;
  password?: string;
  persona?: Role; // Mock preview mode shortcut
}

export interface CreateDraftPayload {
  manuscriptLanguage: Locale;
  title: MultilingualText;
}

export interface ApiClient {
  // ── Public Site Operations ───────────────────────────────────────────────────
  listIssues(): Promise<Issue[]>;
  getIssue(id: string): Promise<Issue | null>;
  listArticles(filters?: ArticleFilters): Promise<Article[]>;
  getArticle(id: string): Promise<Article | null>;
  searchArticles(params: SearchParams): Promise<Article[]>;

  // ── Authentication & Session ─────────────────────────────────────────────────
  signIn(credentials: SignInCredentials): Promise<User>;
  signOut(): Promise<void>;
  getSession(): Promise<User | null>;
  register(payload: {
    fullName: string;
    email: string;
    password?: string;
    preferredLocale?: Locale;
    affiliation?: string;
  }): Promise<User>;

  // ── Author Portal Operations ─────────────────────────────────────────────────
  listMySubmissions(): Promise<Submission[]>;
  createDraft(payload: CreateDraftPayload): Promise<Submission>;
  getSubmission(id: string): Promise<Submission | null>;
  uploadManuscript(submissionId: string, file: File | { name: string; size: number }): Promise<Submission>;
  uploadBlindCopy(submissionId: string, file: File | { name: string; size: number }): Promise<Submission>;
  runExtraction(submissionId: string): Promise<ExtractionResult>;
  getExtraction(submissionId: string): Promise<ExtractionResult>;
  updateMetadata(
    submissionId: string,
    metadata: {
      title?: MultilingualText;
      abstract?: MultilingualText;
      keywords?: Keywords;
      manuscriptLanguage?: Locale;
    }
  ): Promise<Submission>;
  updateAuthors(submissionId: string, authors: Author[]): Promise<Submission>;
  submit(submissionId: string): Promise<Submission>;
  getFeedback(submissionId: string): Promise<AuthorFeedbackView | null>;
  resubmitRevision(submissionId: string, responseToReviewers: string): Promise<Submission>;

  // ── Reviewer Portal Operations ───────────────────────────────────────────────
  listAssignments(): Promise<ReviewerSubmissionView[]>;
  getAssignment(assignmentId: string): Promise<ReviewerSubmissionView | null>;
  respondToInvitation(assignmentId: string, accept: boolean): Promise<ReviewAssignment>;
  getReview(assignmentId: string): Promise<Review | null>;
  saveReviewDraft(
    assignmentId: string,
    draft: {
      scores?: Partial<ReviewScores>;
      recommendation?: Recommendation;
      commentsToAuthor?: string;
      confidentialCommentsToEditor?: string;
    }
  ): Promise<Review>;
  submitReview(
    assignmentId: string,
    review: {
      scores: ReviewScores;
      recommendation: Recommendation;
      commentsToAuthor: string;
      confidentialCommentsToEditor: string;
    }
  ): Promise<Review>;

  // ── Editor Portal Operations ─────────────────────────────────────────────────
  listPipeline(): Promise<Submission[]>;
  getSubmissionAdmin(id: string): Promise<Submission | null>;
  verifyBlindCopy(submissionId: string, round: number): Promise<Submission>;
  rejectBlindCopy(submissionId: string, round: number, note: string): Promise<Submission>;
  startReview(submissionId: string): Promise<Submission>;
  listReviewerCandidates(): Promise<User[]>;
  assignReviewer(submissionId: string, round: number, reviewerId: string): Promise<ReviewAssignment>;
  getReviews(submissionId: string, round: number): Promise<Review[]>;
  decide(
    submissionId: string,
    decision: "accepted" | "revisions_requested" | "rejected",
    decisionNote: string
  ): Promise<Submission>;
  listIssuesAdmin(): Promise<Issue[]>;
  createIssue(payload: { volume: number; number: number; year: number; title?: MultilingualText }): Promise<Issue>;
  addToIssue(issueId: string, submissionId: string): Promise<void>;
  removeFromIssue(issueId: string, submissionId: string): Promise<void>;
  reorderIssue(issueId: string, orderedArticleIds: string[]): Promise<void>;
  publishIssue(issueId: string): Promise<Issue>;

  // ── Admin Operations ─────────────────────────────────────────────────────────
  listUsers(): Promise<User[]>;
  setUserRole(userId: string, role: Role): Promise<User>;
  inviteUser(payload: { email: string; fullName: string; role: Role }): Promise<User>;
  getSettings(): Promise<JournalSettings>;
  updateSettings(settings: Partial<JournalSettings>): Promise<JournalSettings>;
}
