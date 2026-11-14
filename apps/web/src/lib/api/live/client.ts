import { ApiClient, ApiError } from "@/lib/api/client";

function notImplemented(methodName: string): never {
  throw new ApiError(
    `Live API method "${methodName}" is not implemented yet. Set NEXT_PUBLIC_API_MODE=mock to use the fully functional mock backend.`,
    501,
    "NOT_IMPLEMENTED"
  );
}

/**
 * Live Supabase / FastAPI backend client stub.
 * In a future phase (F2/F3), this connects to the real Supabase Auth and FastAPI REST endpoints.
 */
export const liveApiClient: ApiClient = {
  listIssues: async () => notImplemented("listIssues"),
  getIssue: async () => notImplemented("getIssue"),
  listArticles: async () => notImplemented("listArticles"),
  getArticle: async () => notImplemented("getArticle"),
  searchArticles: async () => notImplemented("searchArticles"),

  signIn: async () => notImplemented("signIn"),
  signOut: async () => notImplemented("signOut"),
  getSession: async () => notImplemented("getSession"),
  register: async () => notImplemented("register"),

  listMySubmissions: async () => notImplemented("listMySubmissions"),
  createDraft: async () => notImplemented("createDraft"),
  getSubmission: async () => notImplemented("getSubmission"),
  uploadManuscript: async () => notImplemented("uploadManuscript"),
  uploadBlindCopy: async () => notImplemented("uploadBlindCopy"),
  runExtraction: async () => notImplemented("runExtraction"),
  getExtraction: async () => notImplemented("getExtraction"),
  updateMetadata: async () => notImplemented("updateMetadata"),
  updateAuthors: async () => notImplemented("updateAuthors"),
  submit: async () => notImplemented("submit"),
  getFeedback: async () => notImplemented("getFeedback"),
  resubmitRevision: async () => notImplemented("resubmitRevision"),

  listAssignments: async () => notImplemented("listAssignments"),
  getAssignment: async () => notImplemented("getAssignment"),
  respondToInvitation: async () => notImplemented("respondToInvitation"),
  getReview: async () => notImplemented("getReview"),
  saveReviewDraft: async () => notImplemented("saveReviewDraft"),
  submitReview: async () => notImplemented("submitReview"),

  listPipeline: async () => notImplemented("listPipeline"),
  getSubmissionAdmin: async () => notImplemented("getSubmissionAdmin"),
  verifyBlindCopy: async () => notImplemented("verifyBlindCopy"),
  rejectBlindCopy: async () => notImplemented("rejectBlindCopy"),
  startReview: async () => notImplemented("startReview"),
  listReviewerCandidates: async () => notImplemented("listReviewerCandidates"),
  assignReviewer: async () => notImplemented("assignReviewer"),
  getReviews: async () => notImplemented("getReviews"),
  decide: async () => notImplemented("decide"),
  listIssuesAdmin: async () => notImplemented("listIssuesAdmin"),
  createIssue: async () => notImplemented("createIssue"),
  addToIssue: async () => notImplemented("addToIssue"),
  removeFromIssue: async () => notImplemented("removeFromIssue"),
  reorderIssue: async () => notImplemented("reorderIssue"),
  publishIssue: async () => notImplemented("publishIssue"),

  listUsers: async () => notImplemented("listUsers"),
  setUserRole: async () => notImplemented("setUserRole"),
  inviteUser: async () => notImplemented("inviteUser"),
  getSettings: async () => notImplemented("getSettings"),
  updateSettings: async () => notImplemented("updateSettings"),
};
