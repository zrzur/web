/**
 * Zrzur's own avatar pack: twenty faces built from the logo (public/avatars).
 * The one source for sample people on Designs, in the app and on the public
 * site, and for the default picture of anyone without one. Nobody is ever a
 * letter on a colour.
 */
const AVATARS = [
  "avatar-01-raspberry",
  "avatar-02-cherry",
  "avatar-03-coral",
  "avatar-04-tangerine",
  "avatar-05-amber",
  "avatar-06-lemon",
  "avatar-07-lime",
  "avatar-08-leaf",
  "avatar-09-mint",
  "avatar-10-teal",
  "avatar-11-cyan",
  "avatar-12-ocean",
  "avatar-13-royal",
  "avatar-14-indigo",
  "avatar-15-violet",
  "avatar-16-lavender",
  "avatar-17-rose",
  "avatar-18-berry",
  "avatar-19-slate",
  "avatar-20-midnight",
];

export const SAMPLE_AVATARS = AVATARS.length;

const avatarFile = (index: number) =>
  `${import.meta.env.BASE_URL}avatars/${AVATARS[index]}.svg`;

/** Address of a sample person's picture; any number wraps round */
export function sampleAvatar(index: number) {
  return avatarFile(Math.abs(Math.trunc(index)) % AVATARS.length);
}

/** The same picture for the same name, every time */
export function sampleAvatarFor(name: string) {
  let sum = 0;
  for (const letter of name) sum = (sum * 31 + letter.charCodeAt(0)) % 9973;
  return sampleAvatar(sum);
}

/**
 * The pack's own choice for an account: FNV-1a over `zrzur-default-v1:<id>`,
 * so the same id always gets the same face, here and in any other client.
 */
export function defaultAvatarIndex(userId: string) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(`zrzur-default-v1:${userId}`)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % AVATARS.length;
}

/** The default picture of an account with none of its own */
export const defaultAvatarFor = (userId: string) =>
  avatarFile(defaultAvatarIndex(userId));

/**
 * Swaps the server's default picture for ours. An address with a query keeps
 * going to the server: `?v=2` is how official accounts get the logo.
 */
export function withDefaultAvatar(src: string | undefined) {
  const id = src?.match(/\/users\/([^/?#]+)\/default_avatar$/)?.[1];
  return id ? defaultAvatarFor(id) : src;
}
