# RNNoise worklet (noise suppression in calls)

Served by the app itself at `/assets/rnnoise/` (copied there by
`scripts/copyAssets.mjs`), so calls load no script from a public CDN and
the page policy needs no third-party script host.

The npm package `livekit-rnnoise-processor@3.0.2` ships only the loader; its
`RNNoiseNode.loadModule` fetched these two files from jsDelivr at the commit
below. `rnnoise.wasm` is the same bytes; `RNNoiseWorklet.js` carries one
change of ours (2026-11-27), see "Changes" below.

| File | Source | SHA-256 |
|---|---|---|
| `RNNoiseWorklet.js` | https://github.com/Dadadah/livekit-rnnoise-processor/blob/5edbd8a06a95c2c1736d38458ed34793e8d90bae/dist/RNNoiseWorklet.js (upstream `14fbc044a0f81cf7880c66e1bfb4162bf4d0a15935104d2a63ec66b268c619d7`) | `b7f37581e2b3bcb0b065c5caf903c25acc8d9d7a19bc2ca65d02941894d215d5` |
| `rnnoise.wasm` | https://github.com/Dadadah/livekit-rnnoise-processor/blob/5edbd8a06a95c2c1736d38458ed34793e8d90bae/dist/rnnoise.wasm | `f4a9474de4b1dcf53c5a8f96ec5dfb8034f92aae87fd5dbeb10fe5570d079d9a` |
| `LICENSE` | the same repository, same commit | `a6cba85bc92e0cff7a450b1d873c0eaa2e9fc96bf472df0247a26bec77bf3ff9` |

Licence: Apache-2.0 (`LICENSE`). The WebAssembly module is built from
RNNoise by Xiph.Org / Jean-Marc Valin (BSD-3-Clause,
https://github.com/xiph/rnnoise).

To update: take both files from the commit the new package version uses
(`defaultCDNURL` in `node_modules/livekit-rnnoise-processor/lib/RNNoiseNode.js`),
update the table and `vendor/rnnoise.test.ts` checks the hashes.

## Changes

`RNNoiseWorklet.js`: RNNoise rates every 10 ms frame for how likely it is
speech (its return value, unused upstream). A message
`{ message: "SET_VAD_GATE", threshold }` (0 to 1, 0 = off) makes the worklet
quieten frames below that rating to 5 % (-26 dB), opening in about 20 ms
and closing 200 ms after the last speech frame, so the ends of words stay.
This is the "Strong" noise suppression setting; with threshold 0 the output
is the upstream output.

