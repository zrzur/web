import { appUrl } from "@revolt/app/interface/discover/sites";

import { docsBase } from "../../../siteKind";

import { resolveDocsHref } from "./links";

/**
 * A documentation link as it must be written on this page: unchanged in
 * the app, without the /developers/docs prefix on the standalone site
 */
export const hrefHere = (href: string) =>
  resolveDocsHref(href, { base: docsBase(), appOrigin: appUrl() });

/** Links that leave this site (another origin, or a file) */
export const leavesHere = (href: string) =>
  /^https?:\/\//.test(href) || /\.xml$/.test(href);
