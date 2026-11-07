import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

/**
 * The product name as text: «زرزور» in the Arabic interface, "Zrzur" in
 * every other language (brand.md section 2). Real text, so it follows the
 * theme colour and the page direction; the old SVG wordmark could only say
 * "Zrzur" in Latin letters.
 */
export function BrandName() {
  return (
    <Name>
      <Trans>Zrzur</Trans>
    </Name>
  );
}

const Name = styled("span", {
  base: {
    display: "inline-block",
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: "30px",
    color: "var(--z-header-primary, currentColor)",
    whiteSpace: "nowrap",
  },
});
