/**
 * The address of one design: designs.zrzur.com/<slug> on the public site,
 * /designs/<slug> in the app.
 *
 *   look-<id>, decoration-<id>, nameplate-<id>, colours-<id>   built in
 *   <26-character id>                                         community
 */
export type DesignRef =
  | { kind: "look" | "decoration" | "nameplate" | "colours"; id: string }
  | { kind: "community"; id: string };

const BUILT_IN = ["look", "decoration", "nameplate", "colours"] as const;
const COMMUNITY_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function parseDesignSlug(slug: string): DesignRef | undefined {
  if (COMMUNITY_ID.test(slug)) return { kind: "community", id: slug };
  const dash = slug.indexOf("-");
  if (dash < 1) return undefined;
  const kind = slug.slice(0, dash);
  const id = slug.slice(dash + 1);
  if (!id || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return undefined;
  return (BUILT_IN as readonly string[]).includes(kind)
    ? { kind: kind as (typeof BUILT_IN)[number], id }
    : undefined;
}

export function designSlug(ref: DesignRef) {
  return ref.kind === "community" ? ref.id : `${ref.kind}-${ref.id}`;
}

export const isDesignSlug = (slug: string) => !!parseDesignSlug(slug);
