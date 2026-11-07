# Where these nameplates come from

## Countries (`flag-*.svg`)

Flags from **flag-icons** by Panayiotis Lipiridis, MIT licence, version 7.6.0
(<https://github.com/lipis/flag-icons>, npm tarball sha256
`99d6feb80562dcaa83700ef184094d7c7b6587cc216b3fab1546cb1643e611a9`). The
licence is in `LICENSE-flag-icons.txt` beside this file. The package is not a
dependency of the app. `packages/client/scripts/designs/flags.mjs` compressed each 4x3 flag
with svgo and made it a 448 x 84 plate: the flag, unchanged in design, at full
height and its 4:3 shape at the end of the plate, with the colours of one edge
run on towards the name.

`flag-kurdistan.svg` is not in that package; Zrzur drew it in the same script.
Syria was checked: 7.6.0 already has the current green, white and black flag
with three red stars.

Flags are national symbols: being free to use them here says nothing about
trademark or protocol rules in a given country.

## Zodiac signs and themes

`zodiac-*.svg`, the eight plain themes and `motion/` were drawn for Zrzur in
code by `packages/client/scripts/designs/nameplates.mjs`: original to Zrzur, AGPL-3.0.
