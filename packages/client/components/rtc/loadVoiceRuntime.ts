/**
 * Load LiveKit with the first call, not with the app
 */
import { releaseRoomsOnDisconnect } from "./roomRelease";

export type VoiceRuntime = typeof import("./livekitRuntime");

let loading: Promise<VoiceRuntime> | undefined;

/**
 * Load LiveKit once (a failed load is tried again next time)
 */
export function loadVoiceRuntime(): Promise<VoiceRuntime> {
  loading ??= import("./livekitRuntime")
    .then((runtime) => {
      // a call's room leaves memory when the call ends (see roomRelease)
      releaseRoomsOnDisconnect(runtime.Room);
      return runtime;
    })
    .catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
