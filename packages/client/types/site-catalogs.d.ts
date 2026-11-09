/** Small message catalogs of the Discover and Designs sites (scripts/siteCatalogs.mjs) */
declare module "virtual:zrzur-site-catalogs" {
  /** File address by catalog code; empty during development */
  const urls: Record<string, string>;
  export default urls;
}
