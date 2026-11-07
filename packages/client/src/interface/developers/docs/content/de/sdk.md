# SDKs

`@zrzur/sdk` ist die offizielle Zrzur-Bibliothek für Apps und Bots: TypeScript, ESM, Node 22 oder neuer (oder Deno, oder ein Browser). Ein Paket, drei Einstiege:

| Import             | Was                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `@zrzur/sdk/bot`   | Bots: Slash-Befehle, Schaltflächen, Menüs, Formulare, Autovervollständigung, private und aufgeschobene Antworten, Embeds, Collector, Uploads |
| `@zrzur/sdk`       | Der Kern: der HTTP-Client (jede Route aus OpenAPI typisiert), das Gateway, die API-Typen, Ereignisse |
| `@zrzur/sdk/solid` | Der Live-Client der Zrzur-App (SolidJS): Stores für Server, Kanäle und Nachrichten           |

SolidJS braucht nur `@zrzur/sdk/solid`; ein Bot lädt es nie herunter.

> **Du kannst es noch nicht herunterladen.** `@zrzur/sdk` ist nicht auf npm, und sein Repository ist noch nicht öffentlich. Diese Seite zeigt, was es bieten wird. Baue bis dahin allein mit Node: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot) braucht keine Bibliothek, und [Ohne Bibliothek](/developers/docs/raw-http) hat jeden Aufruf.

Es gibt auch `@zrzur/bot`, eine ältere, kleinere Bibliothek mit derselben Schnittstelle für Bots. Auch sie ist nicht veröffentlicht. Neue Bots sollten auf `@zrzur/sdk/bot` warten.

## @zrzur/sdk/bot (für Bots) {#zrzur-sdk-bot-for-bots}

@@0

| Bereich         | Methoden                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Befehle         | `client.command`, `client.component`, `client.modal`, `client.autocomplete`, `client.syncCommands`, `client.fetchCommands` |
| Antworten       | `i.reply`, `i.defer`, `i.update`, `i.deferUpdate`, `i.showModal`, `i.respond`, `i.editReply`, `i.followUp`, `i.deleteReply` |
| Ereignisse      | `client.on(type)`, `client.onMessage`, `client.onMemberJoin`, `client.onMemberLeave`, `client.onReaction` |
| Nachrichten     | `client.messages.send`, `reply`, `fetch`, `fetchMany`, `edit`, `delete`, `bulkDelete`, `react`, `unreact`, `clearReactions`, `pin`, `unpin` |
| Mitglieder      | `client.members.fetch`, `fetchAll`, `edit`, `addRole`, `removeRole`, `timeout`, `kick`, `ban`, `unban`    |
| Rollen, Kanäle  | `client.roles.*`, `client.channels.*`                                                                     |
| Benutzer        | `client.users.fetch`, `openDM`, `sendDM`                                                                  |
| Webhooks        | `client.webhooks.create`, `list`, `listForServer`, `fetch`, `fetchWithToken`, `edit`, `regenerateToken`, `delete`, `send`, `sendSlack`, `fetchMessage`, `editMessage`, `deleteMessage` |
| Collector       | `message.createMessageComponentCollector`, `message.awaitMessageComponent`, `interaction.awaitModalSubmit` |
| Emojis          | `client.emojis.list`, `fetch`, `find`, `create`, `delete`                                                 |
| Sprache         | `client.voice.nodes`, `client.voice.join`                                                                 |
| Alles andere    | `client.rest.get(path)`, `post`, `put`, `patch`, `delete` (für jede Route typisiert), `client.rest.uploadFile(tag, data, name, type)` |

Fehler der API kommen als `ApiError` mit `status`, `type`, `detail` und nach einem 429 `retryAfter`. Kurze Ratenlimits werden abgewartet; nach einem globalen Limit wartet jede Anfrage, bis es zurückgesetzt ist. Das Gateway packt `Bulk`-Pakete aus und verbindet mit wachsender Wartezeit neu.

Jeder Endpunkt in dieser Referenz nennt die SDK-Methode, die ihn aufruft, wenn es eine gibt.

## @zrzur/sdk (der Kern) {#zrzur-sdk-the-core}

@@1

Nutze es für Werkzeuge, die nur die HTTP-API oder das Gateway brauchen, in jedem Framework.

## @zrzur/sdk/solid (für Apps) {#zrzur-sdk-solid-for-apps}

Der Client, auf dem die Zrzur-App aufbaut: ein Benutzer-Client mit Live-Stores für Server, Kanäle und Nachrichten. Er kann sich mit einem Bot-Token anmelden, hat aber keine Interaktions-API (Befehle, Komponenten, Formulare). Nutze ihn für Werkzeuge, die sich wie eine App verhalten; nutze `@zrzur/sdk/bot` für Bots.

## Ohne SDK {#without-an-sdk}

Jede Funktion ist einfaches HTTP und WebSocket. Siehe [Ohne Bibliothek](/developers/docs/raw-http).
