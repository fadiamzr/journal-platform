import type {
  Article,
  AuthorFeedbackView,
  Issue,
  JournalSettings,
  Review,
  ReviewAssignment,
  ReviewerSubmissionView,
  Role,
  Locale,
  Submission,
  User,
} from "@/lib/domain/types";
import {
  ApiClient,
  ApiError,
  ArticleFilters,
  CreateDraftPayload,
  ExtractionResult,
  SearchParams,
  SignInCredentials,
} from "@/lib/api/client";
import {
  loadStore,
  saveStore,
  simulateLatency,
  validateStatusTransition,
} from "./store";

function getCurrentUser(store: ReturnType<typeof loadStore>): User | null {
  if (!store.currentUserId) return null;
  return store.users.find((u) => u.id === store.currentUserId) || null;
}

function requireAuth(store: ReturnType<typeof loadStore>): User {
  const user = getCurrentUser(store);
  if (!user) {
    throw new ApiError("Authentication required.", 401, "UNAUTHORIZED");
  }
  return user;
}

function requireRole(store: ReturnType<typeof loadStore>, roles: Role[]): User {
  const user = requireAuth(store);
  if (!roles.includes(user.role)) {
    throw new ApiError(
      `Permission denied. Allowed roles: ${roles.join(", ")}`,
      403,
      "FORBIDDEN"
    );
  }
  return user;
}

export const mockApiClient: ApiClient = {
  // ── Public Site Operations ───────────────────────────────────────────────────

  async listIssues(): Promise<Issue[]> {
    await simulateLatency(150, 300);
    const store = loadStore();
    return store.issues
      .filter((i) => i.status === "published")
      .sort((a, b) => b.year - a.year || b.volume - a.volume || b.number - a.number);
  },

  async getIssue(id: string): Promise<Issue | null> {
    await simulateLatency(150, 300);
    const store = loadStore();
    const issue = store.issues.find((i) => i.id === id);
    if (!issue) return null;

    const issueArticles = store.articles
      .filter((a) => a.issueId === id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return {
      ...issue,
      articles: issueArticles,
    };
  },

  async listArticles(filters?: ArticleFilters): Promise<Article[]> {
    await simulateLatency(150, 300);
    const store = loadStore();
    let result = [...store.articles];

    if (filters?.issueId) {
      result = result.filter((a) => a.issueId === filters.issueId);
    }
    if (filters?.year) {
      result = result.filter((a) => a.year === filters.year);
    }
    if (filters?.language) {
      result = result.filter((a) => a.manuscriptLanguage === filters.language);
    }

    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  async getArticle(id: string): Promise<Article | null> {
    await simulateLatency(150, 300);
    const store = loadStore();
    const article = store.articles.find((a) => a.id === id || a.doi === id);
    return article ?? null;
  },

  async searchArticles(params: SearchParams): Promise<Article[]> {
    await simulateLatency(200, 400);
    const store = loadStore();
    let results = [...store.articles];

    if (params.year) {
      results = results.filter((a) => a.year === params.year);
    }
    if (params.issueId) {
      results = results.filter((a) => a.issueId === params.issueId);
    }
    if (params.language) {
      results = results.filter((a) => a.manuscriptLanguage === params.language);
    }

    if (params.query && params.query.trim().length > 0) {
      const q = params.query.trim().toLowerCase();
      results = results.filter((art) => {
        // Match in any language title
        const titleMatches = Object.values(art.title).some((t) =>
          t?.toLowerCase().includes(q)
        );
        // Match in any language abstract
        const abstractMatches = Object.values(art.abstract).some((ab) =>
          ab?.toLowerCase().includes(q)
        );
        // Match in authors
        const authorMatches = art.authors.some(
          (au) =>
            au.fullName.toLowerCase().includes(q) ||
            au.affiliations.some((aff) => aff.toLowerCase().includes(q))
        );
        // Match in keywords
        const keywordMatches = Object.values(art.keywords).some((kwList) =>
          kwList?.some((kw) => kw.toLowerCase().includes(q))
        );

        return titleMatches || abstractMatches || authorMatches || keywordMatches;
      });
    }

    return results;
  },

  // ── Authentication & Session ─────────────────────────────────────────────────

  async signIn(credentials: SignInCredentials): Promise<User> {
    await simulateLatency(200, 400);
    const store = loadStore();

    // 1. Mock preview persona shortcut
    if (credentials.persona) {
      const match = store.users.find((u) => u.role === credentials.persona);
      if (!match) {
        throw new ApiError(`Persona ${credentials.persona} not found.`, 404, "NOT_FOUND");
      }
      store.currentUserId = match.id;
      saveStore(store);
      return match;
    }

    // 2. Email login against mock users
    if (credentials.email) {
      const match = store.users.find(
        (u) => u.email.toLowerCase() === credentials.email?.toLowerCase().trim()
      );
      if (!match) {
        throw new ApiError("The email address or password entered is incorrect.", 401, "INVALID_CREDENTIALS");
      }
      store.currentUserId = match.id;
      saveStore(store);
      return match;
    }

    throw new ApiError("Email or demo persona required.", 400, "MISSING_CREDENTIALS");
  },

  async signOut(): Promise<void> {
    await simulateLatency(100, 200);
    const store = loadStore();
    store.currentUserId = null;
    saveStore(store);
  },

  async getSession(): Promise<User | null> {
    const store = loadStore();
    return getCurrentUser(store);
  },

  async register(payload: {
    fullName: string;
    email: string;
    password?: string;
    preferredLocale?: Locale;
    affiliation?: string;
  }): Promise<User> {
    await simulateLatency(250, 450);
    const store = loadStore();

    const existing = store.users.find(
      (u) => u.email.toLowerCase() === payload.email.toLowerCase().trim()
    );
    if (existing) {
      throw new ApiError("An account with this email address already exists.", 409, "USER_EXISTS");
    }

    const newUser: User = {
      id: `usr-author-${Date.now()}`,
      fullName: payload.fullName,
      email: payload.email.trim(),
      role: "author",
      preferredLocale: payload.preferredLocale || "en",
      affiliation: payload.affiliation,
    };

    store.users.push(newUser);
    store.currentUserId = newUser.id;
    saveStore(store);
    return newUser;
  },

  // ── Author Portal Operations ─────────────────────────────────────────────────

  async listMySubmissions(): Promise<Submission[]> {
    await simulateLatency(200, 400);
    const store = loadStore();
    const user = requireAuth(store);
    return store.submissions.filter((s) => s.authorId === user.id);
  },

  async createDraft(payload: CreateDraftPayload): Promise<Submission> {
    await simulateLatency(200, 400);
    const store = loadStore();
    const user = requireAuth(store);

    const newSub: Submission = {
      id: `sub-${Date.now()}`,
      authorId: user.id,
      status: "draft",
      manuscriptLanguage: payload.manuscriptLanguage,
      title: payload.title,
      abstract: {},
      keywords: {},
      authors: [
        {
          fullName: user.fullName,
          affiliations: user.affiliation ? [user.affiliation] : [],
          email: user.email,
          isCorresponding: true,
        },
      ],
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

    store.submissions.unshift(newSub);
    saveStore(store);
    return newSub;
  },

  async getSubmission(id: string): Promise<Submission | null> {
    await simulateLatency(150, 300);
    const store = loadStore();
    const user = requireAuth(store);

    const sub = store.submissions.find((s) => s.id === id);
    if (!sub) return null;

    // Authors may only see their own submissions
    if (user.role === "author" && sub.authorId !== user.id) {
      throw new ApiError("Permission denied: You do not own this submission.", 403, "FORBIDDEN");
    }

    return sub;
  },

  async uploadManuscript(
    submissionId: string,
    file: File | { name: string; size: number }
  ): Promise<Submission> {
    await simulateLatency(300, 600);
    const store = loadStore();
    const user = requireAuth(store);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");
    if (user.role === "author" && sub.authorId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    const version = sub.versions?.find((v) => v.round === sub.currentRound);
    if (version) {
      version.hasManuscript = true;
      version.sizeBytes = file.size;
    }

    saveStore(store);
    return sub;
  },

  async uploadBlindCopy(
    submissionId: string,
    file: File | { name: string; size: number }
  ): Promise<Submission> {
    await simulateLatency(300, 600);
    const store = loadStore();
    const user = requireAuth(store);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");
    if (user.role === "author" && sub.authorId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    const version = sub.versions?.find((v) => v.round === sub.currentRound);
    if (version) {
      version.hasBlindCopy = true;
      version.sizeBytes = file.size;
      // Resets verification when re-uploaded
      version.blindCopyVerified = false;
      version.blindCopyReviewNote = undefined;
    }

    saveStore(store);
    return sub;
  },

  async runExtraction(submissionId: string): Promise<ExtractionResult> {
    const store = loadStore();
    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");

    // Demo failure condition: if filename or title contains fail_extraction
    const titleText = Object.values(sub.title).join(" ").toLowerCase();
    if (titleText.includes("fail_extraction") || titleText.includes("corrupt")) {
      const failedResult: ExtractionResult = {
        status: "failed",
        error: "AI metadata extraction failed: document contains unparseable raster scan.",
      };
      sub.extractionStatus = "failed";
      sub.extractionError = failedResult.error;
      store.extractions[submissionId] = failedResult;
      saveStore(store);
      return failedResult;
    }

    // Set pending
    sub.extractionStatus = "pending";
    const pendingResult: ExtractionResult = { status: "pending" };
    store.extractions[submissionId] = pendingResult;
    saveStore(store);

    // Simulated async completion after delay
    setTimeout(() => {
      const updatedStore = loadStore();
      const targetSub = updatedStore.submissions.find((s) => s.id === submissionId);
      if (targetSub) {
        targetSub.extractionStatus = "succeeded";
        // Pre-fill extracted metadata
        const extracted: ExtractionResult = {
          status: "succeeded",
          title: {
            ...targetSub.title,
            en: targetSub.title.en || "Extracted Title: Maritime Transits in Mediterranean History",
            fr: targetSub.title.fr || "Titre extrait : Transits maritimes dans l'histoire méditerranéenne",
          },
          abstract: {
            en: "Extracted abstract demonstrating AI parsing of manuscript headers, references, and archival citations.",
          },
          keywords: {
            en: ["Mediterranean history", "maritime trade", "archival methodology"],
          },
        };
        targetSub.title = extracted.title!;
        targetSub.abstract = extracted.abstract!;
        targetSub.keywords = extracted.keywords!;
        updatedStore.extractions[submissionId] = extracted;
        saveStore(updatedStore);
      }
    }, 4000);

    return pendingResult;
  },

  async getExtraction(submissionId: string): Promise<ExtractionResult> {
    const store = loadStore();
    return store.extractions[submissionId] || { status: "not_started" };
  },

  async updateMetadata(submissionId, metadata): Promise<Submission> {
    await simulateLatency(150, 300);
    const store = loadStore();
    const user = requireAuth(store);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");
    if (user.role === "author" && sub.authorId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    if (metadata.title) sub.title = { ...sub.title, ...metadata.title };
    if (metadata.abstract) sub.abstract = { ...sub.abstract, ...metadata.abstract };
    if (metadata.keywords) sub.keywords = { ...sub.keywords, ...metadata.keywords };
    if (metadata.manuscriptLanguage) sub.manuscriptLanguage = metadata.manuscriptLanguage;

    saveStore(store);
    return sub;
  },

  async updateAuthors(submissionId, authors): Promise<Submission> {
    await simulateLatency(150, 300);
    const store = loadStore();
    const user = requireAuth(store);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");
    if (user.role === "author" && sub.authorId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    sub.authors = authors;
    saveStore(store);
    return sub;
  },

  async submit(submissionId: string): Promise<Submission> {
    await simulateLatency(200, 400);
    const store = loadStore();
    const user = requireAuth(store);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");
    if (user.role === "author" && sub.authorId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    validateStatusTransition(sub, "submitted");

    sub.status = "submitted";
    sub.submittedAt = new Date().toISOString();
    saveStore(store);
    return sub;
  },

  async getFeedback(submissionId: string): Promise<AuthorFeedbackView | null> {
    await simulateLatency(150, 300);
    const store = loadStore();
    const user = requireAuth(store);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) return null;
    if (user.role === "author" && sub.authorId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    // Double-blind feedback synthesis:
    // Reviewers are labelled deterministically ("Reviewer 1", "Reviewer 2")
    // Strictly omit reviewerId, reviewer names, and confidentialCommentsToEditor!
    const subAssignments = store.assignments.filter((a) => a.submissionId === submissionId);
    const anonymizedReviews = subAssignments
      .filter((a) => a.status === "completed")
      .map((a, idx) => {
        const rev = store.reviews.find((r) => r.assignmentId === a.id);
        if (!rev || !rev.submittedAt) return null;

        return {
          round: a.round,
          reviewerLabel: `Reviewer ${idx + 1}`,
          recommendation: rev.recommendation,
          scores: rev.scores,
          commentsToAuthor: rev.commentsToAuthor,
          submittedAt: rev.submittedAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      submissionId: sub.id,
      currentRound: sub.currentRound,
      status: sub.status,
      decisionNote: sub.decisionNote,
      reviews: anonymizedReviews,
    };
  },

  async resubmitRevision(submissionId: string, responseToReviewers: string): Promise<Submission> {
    await simulateLatency(250, 500);
    const store = loadStore();
    const user = requireAuth(store);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");
    if (user.role === "author" && sub.authorId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    validateStatusTransition(sub, "submitted", { responseToReviewers });

    sub.currentRound += 1;
    sub.status = "submitted";
    sub.submittedAt = new Date().toISOString();

    if (!sub.versions) sub.versions = [];
    sub.versions.push({
      round: sub.currentRound,
      hasManuscript: true,
      hasBlindCopy: true,
      blindCopyVerified: false, // New round requires re-verification
      responseToReviewers,
    });

    saveStore(store);
    return sub;
  },

  // ── Reviewer Portal Operations ───────────────────────────────────────────────

  async listAssignments(): Promise<ReviewerSubmissionView[]> {
    await simulateLatency(200, 400);
    const store = loadStore();
    const user = requireRole(store, ["reviewer", "editor", "admin"]);

    const myAssignments = store.assignments.filter((a) => a.reviewerId === user.id);

    return myAssignments.map((a) => {
      const sub = store.submissions.find((s) => s.id === a.submissionId)!;
      const ver = sub.versions?.find((v) => v.round === a.round);
      const isVerified = ver?.blindCopyVerified ?? false;
      const isAcceptedOrCompleted = a.status === "accepted" || a.status === "completed";

      return {
        assignmentId: a.id,
        submissionId: sub.id,
        round: a.round,
        assignmentStatus: a.status,
        dueAt: a.dueAt,
        manuscriptLanguage: sub.manuscriptLanguage,
        title: sub.title,
        abstract: sub.abstract,
        keywords: sub.keywords,
        blindCopyVerified: isVerified,
        // Anonymized path revealed ONLY when assignment is accepted/completed AND blind copy is verified
        anonymizedPath:
          isAcceptedOrCompleted && isVerified
            ? `/mock-storage/anonymized/${sub.id}/v${a.round}.pdf`
            : undefined,
        // STRICT DOUBLE BLIND: NO authorId, NO authors list, NO manuscript_path
      };
    });
  },

  async getAssignment(assignmentId: string): Promise<ReviewerSubmissionView | null> {
    await simulateLatency(150, 300);
    const store = loadStore();
    const user = requireRole(store, ["reviewer", "editor", "admin"]);

    const a = store.assignments.find((asg) => asg.id === assignmentId);
    if (!a) return null;
    if (user.role === "reviewer" && a.reviewerId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    const sub = store.submissions.find((s) => s.id === a.submissionId)!;
    const ver = sub.versions?.find((v) => v.round === a.round);
    const isVerified = ver?.blindCopyVerified ?? false;
    const isAcceptedOrCompleted = a.status === "accepted" || a.status === "completed";

    return {
      assignmentId: a.id,
      submissionId: sub.id,
      round: a.round,
      assignmentStatus: a.status,
      dueAt: a.dueAt,
      manuscriptLanguage: sub.manuscriptLanguage,
      title: sub.title,
      abstract: sub.abstract,
      keywords: sub.keywords,
      blindCopyVerified: isVerified,
      anonymizedPath:
        isAcceptedOrCompleted && isVerified
          ? `/mock-storage/anonymized/${sub.id}/v${a.round}.pdf`
          : undefined,
    };
  },

  async respondToInvitation(assignmentId: string, accept: boolean): Promise<ReviewAssignment> {
    await simulateLatency(200, 400);
    const store = loadStore();
    const user = requireRole(store, ["reviewer", "editor", "admin"]);

    const a = store.assignments.find((asg) => asg.id === assignmentId);
    if (!a) throw new ApiError("Assignment not found", 404, "NOT_FOUND");
    if (user.role === "reviewer" && a.reviewerId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    a.status = accept ? "accepted" : "declined";
    saveStore(store);
    return a;
  },

  async getReview(assignmentId: string): Promise<Review | null> {
    await simulateLatency(150, 300);
    const store = loadStore();
    const rev = store.reviews.find((r) => r.assignmentId === assignmentId);
    return rev ?? null;
  },

  async saveReviewDraft(assignmentId, draft): Promise<Review> {
    await simulateLatency(200, 400);
    const store = loadStore();
    let rev = store.reviews.find((r) => r.assignmentId === assignmentId);

    if (!rev) {
      rev = {
        assignmentId,
        scores: { originality: 3, methodology: 3, clarity: 3, significance: 3, relevance: 3 },
        recommendation: "minor_revisions",
        commentsToAuthor: "",
        confidentialCommentsToEditor: "",
      };
      store.reviews.push(rev);
    }

    if (draft.scores) rev.scores = { ...rev.scores, ...draft.scores };
    if (draft.recommendation) rev.recommendation = draft.recommendation;
    if (draft.commentsToAuthor !== undefined) rev.commentsToAuthor = draft.commentsToAuthor;
    if (draft.confidentialCommentsToEditor !== undefined) {
      rev.confidentialCommentsToEditor = draft.confidentialCommentsToEditor;
    }

    saveStore(store);
    return rev;
  },

  async submitReview(assignmentId, review): Promise<Review> {
    await simulateLatency(250, 500);
    const store = loadStore();
    const assignment = store.assignments.find((a) => a.id === assignmentId);
    if (!assignment) throw new ApiError("Assignment not found", 404, "NOT_FOUND");

    let rev = store.reviews.find((r) => r.assignmentId === assignmentId);
    if (!rev) {
      rev = { assignmentId, ...review, submittedAt: new Date().toISOString() };
      store.reviews.push(rev);
    } else {
      Object.assign(rev, review, { submittedAt: new Date().toISOString() });
    }

    assignment.status = "completed";
    saveStore(store);
    return rev;
  },

  // ── Editor Portal Operations ─────────────────────────────────────────────────

  async listPipeline(): Promise<Submission[]> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);
    return store.submissions;
  },

  async getSubmissionAdmin(id: string): Promise<Submission | null> {
    await simulateLatency(150, 300);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);
    return store.submissions.find((s) => s.id === id) || null;
  },

  async verifyBlindCopy(submissionId: string, round: number): Promise<Submission> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");

    const ver = sub.versions?.find((v) => v.round === round);
    if (!ver) throw new ApiError(`Version round ${round} not found`, 404, "NOT_FOUND");

    ver.blindCopyVerified = true;
    ver.blindCopyReviewNote = undefined;
    saveStore(store);
    return sub;
  },

  async rejectBlindCopy(submissionId: string, round: number, note: string): Promise<Submission> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");

    const ver = sub.versions?.find((v) => v.round === round);
    if (!ver) throw new ApiError(`Version round ${round} not found`, 404, "NOT_FOUND");

    ver.blindCopyVerified = false;
    ver.blindCopyReviewNote = note;
    saveStore(store);
    return sub;
  },

  async startReview(submissionId: string): Promise<Submission> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");

    validateStatusTransition(sub, "in_review");

    sub.status = "in_review";
    saveStore(store);
    return sub;
  },

  async listReviewerCandidates(): Promise<User[]> {
    await simulateLatency(150, 300);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);
    return store.users.filter((u) => u.role === "reviewer");
  },

  async assignReviewer(submissionId: string, round: number, reviewerId: string): Promise<ReviewAssignment> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const newAssignment: ReviewAssignment = {
      id: `asg-${Date.now()}`,
      submissionId,
      round,
      reviewerId,
      status: "invited",
      invitedAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    };

    store.assignments.push(newAssignment);
    saveStore(store);
    return newAssignment;
  },

  async getReviews(submissionId: string, round: number): Promise<Review[]> {
    await simulateLatency(150, 300);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const matchingAssignmentIds = store.assignments
      .filter((a) => a.submissionId === submissionId && a.round === round)
      .map((a) => a.id);

    return store.reviews.filter((r) => matchingAssignmentIds.includes(r.assignmentId));
  },

  async decide(submissionId, decision, decisionNote): Promise<Submission> {
    await simulateLatency(250, 500);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");

    validateStatusTransition(sub, decision);

    sub.status = decision;
    sub.decidedAt = new Date().toISOString();
    sub.decisionNote = decisionNote;
    saveStore(store);
    return sub;
  },

  async listIssuesAdmin(): Promise<Issue[]> {
    await simulateLatency(150, 300);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);
    return store.issues;
  },

  async createIssue(payload): Promise<Issue> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const newIssue: Issue = {
      id: `iss-${payload.year}-v${payload.volume}-n${payload.number}`,
      volume: payload.volume,
      number: payload.number,
      year: payload.year,
      title: payload.title,
      status: "draft",
    };

    store.issues.unshift(newIssue);
    saveStore(store);
    return newIssue;
  },

  async addToIssue(issueId: string, submissionId: string): Promise<void> {
    await simulateLatency(150, 300);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");
    sub.issueId = issueId;
    saveStore(store);
  },

  async removeFromIssue(issueId: string, submissionId: string): Promise<void> {
    await simulateLatency(150, 300);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const sub = store.submissions.find((s) => s.id === submissionId);
    if (!sub) throw new ApiError("Submission not found", 404, "NOT_FOUND");
    if (sub.issueId === issueId) {
      sub.issueId = undefined;
    }
    saveStore(store);
  },

  async reorderIssue(issueId: string, orderedArticleIds: string[]): Promise<void> {
    await simulateLatency(150, 300);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    orderedArticleIds.forEach((id, index) => {
      const art = store.articles.find((a) => a.id === id);
      if (art) art.order = index + 1;
    });

    saveStore(store);
  },

  async publishIssue(issueId: string): Promise<Issue> {
    await simulateLatency(300, 600);
    const store = loadStore();
    requireRole(store, ["editor", "admin"]);

    const issue = store.issues.find((i) => i.id === issueId);
    if (!issue) throw new ApiError("Issue not found", 404, "NOT_FOUND");

    issue.status = "published";
    issue.publishedAt = new Date().toISOString();

    // Convert accepted submissions assigned to this issue into published articles
    const assignedSubs = store.submissions.filter(
      (s) => s.issueId === issueId && s.status === "accepted"
    );

    assignedSubs.forEach((sub, idx) => {
      sub.status = "published";
      sub.publishedAt = issue.publishedAt;
      const doi = `10.5555/journal.${issue.year}.${String(issue.volume).padStart(2, "0")}.${String(issue.number).padStart(2, "0")}.${String(idx + 1).padStart(3, "0")}`;
      sub.doi = doi;

      const newArticle: Article = {
        id: `art-${sub.id}`,
        submissionId: sub.id,
        issueId: issue.id,
        doi,
        volume: issue.volume,
        number: issue.number,
        year: issue.year,
        order: idx + 1,
        manuscriptLanguage: sub.manuscriptLanguage,
        publishedAt: issue.publishedAt!,
        pdfUrl: `/mock-storage/published/${sub.id}.pdf`,
        title: sub.title,
        abstract: sub.abstract,
        keywords: sub.keywords,
        authors: sub.authors,
      };

      store.articles.push(newArticle);
    });

    saveStore(store);
    return issue;
  },

  // ── Admin Operations ─────────────────────────────────────────────────────────

  async listUsers(): Promise<User[]> {
    await simulateLatency(150, 300);
    const store = loadStore();
    requireRole(store, ["admin"]);
    return store.users;
  },

  async setUserRole(userId: string, role: Role): Promise<User> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["admin"]);

    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new ApiError("User not found", 404, "NOT_FOUND");

    user.role = role;
    saveStore(store);
    return user;
  },

  async inviteUser(payload): Promise<User> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["admin"]);

    const newUser: User = {
      id: `usr-${Date.now()}`,
      fullName: payload.fullName,
      email: payload.email,
      role: payload.role,
      preferredLocale: "en",
    };

    store.users.push(newUser);
    saveStore(store);
    return newUser;
  },

  async getSettings(): Promise<JournalSettings> {
    await simulateLatency(100, 200);
    const store = loadStore();
    return store.settings;
  },

  async updateSettings(settings): Promise<JournalSettings> {
    await simulateLatency(200, 400);
    const store = loadStore();
    requireRole(store, ["admin"]);

    store.settings = { ...store.settings, ...settings };
    saveStore(store);
    return store.settings;
  },
};
