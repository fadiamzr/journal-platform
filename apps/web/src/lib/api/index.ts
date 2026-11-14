import { ApiClient } from "./client";
import { mockApiClient } from "./mock/client";
import { liveApiClient } from "./live/client";

const apiMode = process.env.NEXT_PUBLIC_API_MODE?.toLowerCase() || "mock";

/**
 * Universal journal platform API client.
 * Defaults to the rich in-memory mock client with simulated latency and local storage persistence.
 */
export const api: ApiClient = apiMode === "live" ? liveApiClient : mockApiClient;

export * from "./client";
export { resetDemoData } from "./mock/store";
