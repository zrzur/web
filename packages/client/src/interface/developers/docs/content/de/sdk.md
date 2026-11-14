# SDKs

`@zrzur/sdk` ist die offizielle Zrzur-Bibliothek für Apps und Bots: TypeScript, ESM, Node 22.3 oder neuer (oder Deno 2.2 oder neuer, oder ein Browser). Ein Paket, drei Einstiege:

| Import             | Was                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `@zrzur/sdk/bot`   | Bots: Slash-Befehle, Schaltflächen, Menüs, Formulare, Autovervollständigung, private und aufgeschobene Antworten, Embeds, Collector, Uploads |
| `@zrzur/sdk`       | Der Kern: der HTTP-Client (jede Route aus OpenAPI typisiert), das Gateway, die API-Typen, Ereignisse |
| `@zrzur/sdk/solid` | Der Live-Client der Zrzur-App (SolidJS): Stores für Server, Kanäle und Nachrichten           |

SolidJS braucht nur `@zrzur/sdk/solid`; ein Bot lädt es nie herunter.

Installiere es von npm, mit Node 22.3 oder neuer:

@@0

Das Paket ist [@zrzur/sdk auf npm](https://www.npmjs.com/package/@zrzur/sdk), der Quelltext liegt auf [github.com/zrzur/sdk-js](https://github.com/zrzur/sdk-js). Ein Bot läuft auch ganz ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot) braucht keine, und [Ohne Bibliothek](/developers/docs/raw-http) hat jeden Aufruf.

Es gibt auch `@zrzur/bot`, eine ältere, kleinere Bibliothek mit derselben Schnittstelle für Bots. Sie ist nicht veröffentlicht und lässt sich nicht installieren; nutze `@zrzur/sdk/bot`.

## @zrzur/sdk/bot (für Bots) {#zrzur-sdk-bot-for-bots}

@@1

| Bereich         | Methoden                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Befehle | `client.command`, `client.component`, `client.modal`, `client.autocomplete`, `client.syncCommands`, `client.fetchCommands`, `client.createCommand`, `client.fetchCommand`, `client.editCommand`, `client.deleteCommand` |
| Antworten       | `i.reply`, `i.defer`, `i.update`, `i.deferUpdate`, `i.showModal`, `i.respond`, `i.editReply`, `i.followUp`, `i.deleteReply` |
| Ereignisse      | `client.on(type)`, `client.onMessage`, `client.onMemberJoin`, `client.onMemberLeave`, `client.onReaction` |
| Nachrichten | `client.messages.send`, `reply`, `fetch`, `fetchMany`, `edit`, `delete`, `bulkDelete`, `react`, `unreact`, `clearReactions`, `pin`, `unpin`, `pins` |
| Mitglieder      | `client.members.fetch`, `fetchAll`, `edit`, `addRole`, `removeRole`, `timeout`, `kick`, `ban`, `unban`    |
| Rollen | `client.roles.create`, `edit`, `setPermissions`, `delete` |
| Kanäle | `client.channels.fetch`, `create`, `edit`, `delete`, `setPermissions`, `setMemberPermissions`, `createInvite`, `typing` |
| Server | `client.servers.fetch`, `ensureCategory` |
| Threads, Foren | `client.threads.create`, `list`, `edit`, `archive`, `reopen`; `client.forums.create`, `post`, `posts`, `setTags` |
| Einladungen | `client.invites.create`, `fetch`, `list`, `delete` |
| Benutzer        | `client.users.fetch`, `openDM`, `sendDM`                                                                  |
| Webhooks        | `client.webhooks.create`, `list`, `listForServer`, `fetch`, `fetchWithToken`, `edit`, `regenerateToken`, `delete`, `send`, `sendSlack`, `fetchMessage`, `editMessage`, `deleteMessage` |
| Collector       | `message.createMessageComponentCollector`, `message.awaitMessageComponent`, `interaction.awaitModalSubmit` |
| Emojis          | `client.emojis.list`, `fetch`, `find`, `create`, `delete`                                                 |
| Sprache         | `client.voice.nodes`, `client.voice.join`                                                                 |
| Verbindung | `client.login`, `client.loginHttp`, `client.listen`, `client.destroy`, `client.setStatus`, `client.typing` |
| Alles andere    | `client.rest.get(path)`, `post`, `put`, `patch`, `delete` (für jede Route typisiert), `client.rest.uploadFile(tag, data, name, type)` |

Fehler der API kommen als `ApiError` mit `status`, `type`, `detail` und nach einem 429 `retryAfter`. Kurze Ratenlimits werden abgewartet; nach einem globalen Limit wartet jede Anfrage, bis es zurückgesetzt ist. Das Gateway packt `Bulk`-Pakete aus und verbindet mit wachsender Wartezeit neu.

Jeder Endpunkt in dieser Referenz nennt die SDK-Methode, die ihn aufruft, wenn es eine gibt.

## @zrzur/sdk (der Kern) {#zrzur-sdk-the-core}

@@2

Nutze es für Werkzeuge, die nur die HTTP-API oder das Gateway brauchen, in jedem Framework.

## @zrzur/sdk/solid (für Apps) {#zrzur-sdk-solid-for-apps}

Der Client, auf dem die Zrzur-App aufbaut: ein Benutzer-Client mit Live-Stores für Server, Kanäle und Nachrichten. Er kann sich mit einem Bot-Token anmelden, hat aber keine Interaktions-API (Befehle, Komponenten, Formulare). Nutze ihn für Werkzeuge, die sich wie eine App verhalten; nutze `@zrzur/sdk/bot` für Bots.

## Ohne SDK {#without-an-sdk}

Jede Funktion ist einfaches HTTP und WebSocket. Siehe [Ohne Bibliothek](/developers/docs/raw-http).
