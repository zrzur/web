// Separate from the Changelog window: the start-up code asks for the latest
// entry and must not load the window (and the Markdown renderer) to do so

export interface ChangelogResponse {
  id: string;
  title: string;
  markdown_content: string;
  ios_version?: string;
  android_version?: string;
  web_version?: string;
  published_at: string;
  created_at?: string;
  updated_at?: string;
}

/** Off until Zrzur changelog service exists  */
const CHANGELOG_ENDPOINT = "";

export async function fetchLatestChangelog(): Promise<ChangelogResponse | null> {
  if (!CHANGELOG_ENDPOINT) return null;
  try {
    const response = await fetch(CHANGELOG_ENDPOINT, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Partial<ChangelogResponse>;

    if (
      typeof data?.id !== "string" ||
      typeof data?.title !== "string" ||
      typeof data?.markdown_content !== "string" ||
      typeof data?.published_at !== "string"
    ) {
      return null;
    }

    return data as ChangelogResponse;
  } catch {
    return null;
  }
}
