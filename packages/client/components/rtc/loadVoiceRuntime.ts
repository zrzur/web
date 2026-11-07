/**
 * Load LiveKit with the first call, not with the app
 */
export type VoiceRuntime = typeof import("./livekitRuntime");

let loading: Promise<VoiceRuntime> | undefined;

/**
 * Load LiveKit once (a failed load is tried again next time)
 */
export function loadVoiceRuntime(): Promise<VoiceRuntime> {
  loading ??= import("./livekitRuntime").catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
