# Event reference

Every event a bot can receive, with its fields. The samples were recorded from a running server, then ids were replaced.

Events arrive as JSON objects with a `type`. Fields marked as not always there are left out when empty. A few events carry an object directly, so `Message` has `content` next to `type`.

Other events exist for the Zrzur apps. Bots never receive them, so they are not listed here. `GET /gateway/schema` has them all.

```events

```

## Types {#types}

The objects named in the tables above. Dates are ISO 8601 text. Ids are 26 characters long.

```types

```
