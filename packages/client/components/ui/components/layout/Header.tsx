import { styled } from "styled-system/jsx";

export interface Props {
  readonly placement: "primary" | "secondary";

  readonly topBorder?: boolean;
  readonly bottomBorder?: boolean;
}

/**
 * Header component
 */
export const Header = styled("div", {
  base: {
    gap: "10px",
    flex: "0 auto",
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    fontWeight: 600,
    userSelect: "none",
    overflow: "hidden",
    height: "var(--z-header-height, 56px)",
    borderRadius: 0,
    borderBottom: "1px solid var(--z-border-subtle)",
    "--z-icon-color": "var(--z-nav-icon)",
    // same surface as chat + members — no separate wash
    backgroundColor: "var(--z-bg-shell, var(--z-bg-chat))",

    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    fill: "var(--z-fg-primary, var(--md-sys-color-on-surface))",

    backgroundSize: "cover !important",
    backgroundPosition: "center !important",
    "& svg": {
      flexShrink: 0,
    },
  },
  variants: {
    placement: {
      primary: {
        margin: 0,
        paddingInline: "20px",
        _phone: { paddingInline: "12px" },
      },
      secondary: {
        margin: 0,
        paddingInline: "16px",
        backgroundColor: "var(--z-bg-nav, var(--z-bg-shell))",
      },
    },
    // server banner: full-bleed cover image that fades into the sidebar,
    // with the server name row sitting on the fade (no inset box, no seam)
    image: {
      true: {
        position: "relative",
        color: "white",
        fill: "white",
        // dark base under light banners so they never flash white into the rail
        backgroundColor: "var(--z-bg-nav, var(--z-bg-sidebar))",

        alignItems: "flex-end",
        justifyContent: "stretch",
        height: "auto",
        aspectRatio: "16 / 9",
        boxSizing: "border-box",
        paddingInline: "8px !important",
        paddingBottom: "8px",
        borderBottom: "none",
        backgroundRepeat: "no-repeat !important",
        backgroundSize: "cover !important",
        textShadow: "0 1px 3px rgba(0,0,0,0.75)",
        "--z-icon-color": "rgba(255,255,255,0.9)",

        "&::before": {
          content: "''",
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          // the picture shows at about 85%; the row under the name fades in
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--z-bg-nav, #171925) 15%, transparent) 0%, color-mix(in srgb, var(--z-bg-nav, #171925) 15%, transparent) 45%, color-mix(in srgb, var(--z-bg-nav, #171925) 70%, transparent) 78%, var(--z-bg-nav, #171925) 100%)",
        },
        "& > *": {
          position: "relative",
          zIndex: 1,
          flexGrow: 1,
          marginInline: "0 !important",
        },
      },
    },
    transparent: {
      true: {
        width: "calc(100% - var(--gap-md))",
        zIndex: "10",
      },
    },
  },
  compoundVariants: [
    {
      placement: "secondary",
      image: false,
      css: {
        marginLeft: 0,
      },
    },
  ],
  defaultVariants: {
    placement: "primary",
    image: false,
    transparent: false,
  },
});

/**
 * Position an element below a floating header
 *
 * Ensure you place a div inside to make the positioning work
 */
export const BelowFloatingHeader = styled("div", {
  base: {
    position: "relative",
    zIndex: "10",

    // i guess this works, probably refactor this later
    "& > div > div": {
      width: "100%",
      position: "absolute",
      top: "var(--gap-md)",
    },
  },
});
