/**
 * "Download my data": the three calls of the data export API
 * (GET and POST /auth/account/data-export).
 */

export type DataExportStatus = "none" | "pending" | "ready" | "failed";

export interface DataExportInfo {
  status: DataExportStatus;
  requested_at?: string | null;
  expires_at?: string | null;
  /** Seconds until another copy can be asked for (0 = now) */
  next_request_in_seconds: number;
  /** Days between confirming an account deletion and its erasure */
  deletion_grace_days: number;
  /** Where to write for anything the page can't do */
  contact_email: string;
}

/** The part of the API client these calls need */
export interface RawApi {
  get(path: string): Promise<unknown>;
  post(
    path: string,
    body?: unknown,
    init?: { headers?: Record<string, string> },
  ): Promise<unknown>;
}

const PATH = "/auth/account/data-export";

export function fetchDataExport(api: RawApi): Promise<DataExportInfo> {
  return api.get(PATH) as Promise<DataExportInfo>;
}

/** Needs a fresh confirmation (password or two-factor code) as a ticket */
export function requestDataExport(
  api: RawApi,
  mfaTicketToken: string,
): Promise<DataExportInfo> {
  return api.post(PATH, undefined, {
    headers: { "X-MFA-Ticket": mfaTicketToken },
  }) as Promise<DataExportInfo>;
}

/** Whole hours and minutes left, for "you can ask again in …" */
export function waitParts(seconds: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.ceil(seconds / 60));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** The download button shows only while the file is ready */
export function canDownload(info?: DataExportInfo): boolean {
  return info?.status === "ready";
}

/** What the download needs from the API client */
export interface DownloadApi {
  baseURL: string;
  config: { headers?: Record<string, string> };
}

/**
 * Fetch the ZIP as the signed-in person. The address holds no secret; the
 * session header is the proof, so the file can't be opened from a forwarded
 * link.
 */
export async function fetchDataExportFile(api: DownloadApi): Promise<Blob> {
  const response = await fetch(`${api.baseURL}${PATH}/download`, {
    headers: api.config.headers,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

/** Whether the request button works right now */
export function canRequest(info?: DataExportInfo): boolean {
  if (!info) return false;
  return info.status !== "pending" && info.next_request_in_seconds <= 0;
}
