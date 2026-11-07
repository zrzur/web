# Where these designs come from

Everything in this folder, and the profile effects in
`components/ui/components/features/profiles/effects/`, was drawn for Zrzur in
code: `packages/client/scripts/designs/decorations.mjs` writes these SVG files. They are
original to Zrzur and licensed AGPL-3.0 with the rest of the web app. No file
from another app, art pack or download was opened, traced, sampled or adapted.
There are no characters, brands, logos or real people.

The nameplates are in `../nameplates/`, with their own `SOURCES.md`: the flags
there come from a third-party package.

## Fonts for display names

The name fonts come from packages the app already has, all SIL Open Font
License 1.1: Outfit, Poppins, Raleway, Montserrat, Lexend, Rubik, Bitter,
IBM Plex Serif, Comic Neue, Space Mono, Fira Code, Nunito, Noto Sans Arabic,
IBM Plex Sans Arabic (`@fontsource/*`; each package carries its licence).
Rubik and Noto Sans Arabic have their own Arabic; the rest fall back to
IBM Plex Sans Arabic for Arabic text.
