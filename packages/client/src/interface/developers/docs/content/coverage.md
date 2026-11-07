# Status and coverage

## How these docs are made

1. A script reads the server's route code, its permission checks, its error and rate-limit tables, its gateway events, both SDKs and the API's OpenAPI document, and writes the inventory these pages are built from. Nothing here is typed in by hand that the code can say.
2. The doc-accuracy tests create a server, bots and test members on a local Zrzur server, call documented endpoints with a bot token, compare the answers with the documented schemas, and run every tutorial as a real bot.
3. Automated checks fail the build when an endpoint has no documentation, a page links nowhere, an example calls a route that does not exist, or the inventory is out of date.

Every endpoint shows how it was checked:

| Level             | Meaning                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| Verified live     | Called with a bot token on a running server; response matched the schema |
| Local integration | Tested against services started for the test                             |
| Type-checked      | Compiles against the SDK types; not run                                  |
| Mocked            | Run against a fake server                                                |
| Untested          | Known from the source code only                                          |

## Status

```coverage

```

## What bots cannot do

```unsupported

```

Account settings, sessions, multi-factor authentication, billing, Discover listings, plugins, the community gallery and staff tools are not part of the Bot API and are not listed here.
