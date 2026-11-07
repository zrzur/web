import { isDesignsSite, isDiscoverSite } from "../../siteHost";

/**
 * Whether this address opens Home, not another page or one of the standalone
 * sites, whose root is their own page
 */
export function goingHome(pathname: string) {
  return (
    ["/", "/app"].includes(pathname) && !isDesignsSite() && !isDiscoverSite()
  );
}
