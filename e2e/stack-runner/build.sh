#!/usr/bin/env bash
# Run from packages/client: bash ../../e2e/stack-runner/build.sh (builds the web app for discover-journeys.mjs)
export VITE_HOST=localhost:31070 VITE_API_URL=http://127.0.0.1:14702
export VITE_DEV_WS_URL=ws://127.0.0.1:14703 VITE_DEV_MEDIA_URL=http://127.0.0.1:14704 VITE_DEV_PROXY_URL=http://127.0.0.1:14705
export VITE_INVITE_ORIGIN=https://zrzur.cc VITE_DISCOVER_URL=http://127.0.0.1:31071 VITE_DESIGNS_HOST=designs.localhost
node_modules/.bin/lingui compile --typescript
node_modules/.bin/vite build > ../../e2e/stack-runner/vite-build.log 2>&1
echo "exit $?" >> ../../e2e/stack-runner/vite-build.log
