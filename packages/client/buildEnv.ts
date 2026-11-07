type BuildEnv = Record<string, string | undefined>;

/** Reject Stoat/Revolt hosts in build-time env (mirrors runtime hostname checks). */
export function assertBuildEnvSafe(
  command: "build" | "serve",
  env: BuildEnv = process.env,
) {
  if (command !== "build") return;

  const host = env.VITE_HOST?.trim();
  const api = env.VITE_API_URL?.trim();
  // invite links use the short host (https://zrzur.cc/{code}); the Docker image
  // builds with "__VITE_INVITE_ORIGIN__" and docker/inject.js fills it at start
  const invite = env.VITE_INVITE_ORIGIN?.trim();
  if (!host || !api || !invite) {
    throw new Error(
      "Zrzur: production vite build requires VITE_HOST, VITE_API_URL and VITE_INVITE_ORIGIN (fail closed; no Stoat/Revolt fallback).",
    );
  }

  const prohibited =
    /\b(stoat\.chat|revolt\.chat|stoatusercontent\.com|gifbox\.me|stt\.gg|rvlt\.gg)\b/i;
  for (const [label, value] of [
    ["VITE_HOST", host],
    ["VITE_EMOJI_CDN", env.VITE_EMOJI_CDN],
    ["VITE_API_URL", api],
    ["VITE_INVITE_ORIGIN", invite],
    ["VITE_DEV_WS_URL", env.VITE_DEV_WS_URL],
    ["VITE_DEV_MEDIA_URL", env.VITE_DEV_MEDIA_URL],
    ["VITE_DEV_PROXY_URL", env.VITE_DEV_PROXY_URL],
    ["VITE_DEV_GIFBOX_URL", env.VITE_DEV_GIFBOX_URL],
    ["VITE_RNNOISE_WORKLET_CDN_URL", env.VITE_RNNOISE_WORKLET_CDN_URL],
  ] as const) {
    if (value && prohibited.test(value)) {
      throw new Error(
        `Zrzur: ${label} must not point at upstream Stoat/Revolt (${value}).`,
      );
    }
  }
}
