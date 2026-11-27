# Kanäle

Jeder Serverkanal hat `channel_type: "TextChannel"`: Text, Sprache (mit `voice`), Ankündigung, Forum (mit `forum`) und Thread (mit `parent` und `thread`). Ein Bot sieht auch die Direktnachrichten, an denen er teilnimmt (`DirectMessage`). Gruppen sind nur für Menschen. Die [Ereignisreferenz](/developers/docs/events#channels) listet die Felder und zeigt, wie man eine Direktnachricht von einem Serverkanal unterscheidet.

Die Beispiele nutzen einfaches HTTP. Die SDK-Zeilen danach brauchen `@zrzur/sdk` (`npm install @zrzur/sdk`); siehe [SDKs](/developers/docs/sdk).

## Kanäle erstellen und ändern {#create-and-change-channels}

`POST /servers/{server}/channels` erstellt einen Kanal (braucht „Kanal verwalten“). Ein Ticketkanal nur für das Team, in einer Kategorie:

@@0

| Feld           | Bedeutung                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `type`         | `Text` (Standard), `Voice` oder `Forum`                                                                     |
| `name`         | 1 bis 32 Zeichen                                                                                            |
| `description`  | Bis zu 1024 Zeichen                                                                                         |
| `nsfw`         | Nur für Erwachsene                                                                                          |
| `announcement` | Textkanäle: Nur Mitglieder mit „Nachrichten verwalten“ posten                                               |
| `category`     | ID einer Kategorie dieses Servers. Der Kanal folgt den Berechtigungen der Kategorie. Eine Kategorie, die der Server nicht hat, antwortet `404 NotFound`, und nichts wird erstellt |
| `private`      | `true` verweigert `@everyone` in diesem Kanal „Kanal sehen“, und der Kanal folgt nicht den Berechtigungen seiner Kategorie. Rollen mit „Kanal sehen“, im Server oder in diesem Kanal, sehen ihn weiterhin |

Die Antwort ist der neue Kanal. Prüfe, dass eine Rolle deines Bots „Kanal sehen“ hat, sonst kann dein Bot einen privaten Kanal, den er erstellt hat, nicht nutzen. Um das Team hereinzulassen, gib seiner Rolle „Kanal sehen“ im Kanal mit `PUT /channels/{target}/permissions/{role_id}`.

- `PATCH /channels/{target}` ändert Namen, Beschreibung, langsamen Modus, NSFW-Markierung oder Symbol.
- `DELETE /channels/{target}` löscht einen Serverkanal. Bei einer Direktnachricht schließt es sie für den Bot.
- `PUT /channels/{target}/permissions/{role_id}` und `.../default` setzen Kanal-Überschreibungen (braucht „Berechtigungen verwalten“). Siehe [Rollen und Berechtigungen](/developers/docs/roles).

Ankündigungskanäle nehmen nur Nachrichten von Mitgliedern mit „Nachrichten verwalten“ an.

## Threads {#threads}

Ein Thread ist ein Kanal in einem Textkanal und nutzt dessen Berechtigungen. Starte einen mit Namen und erster Nachricht:

@@1

Die Antwort ist der Thread: ein Kanal mit `parent`. Also schreibt `POST /channels/{target}/messages` hinein. `GET /channels/{target}/threads` listet sie, und `PATCH /channels/{target}/thread` archiviert oder sperrt einen.

`POST /channels/{target}/threads` beginnt einen aus einer Nachricht (`message`), mit einer ersten Nachricht (`content`) oder leer (nur `name`). Eine neue Nachricht öffnet einen archivierten Thread wieder. Sperren braucht „Nachrichten verwalten“.

Die erste Nachricht folgt den Regeln jeder Nachricht, die dein Bot sendet:

- Sie nimmt `content` (bis zu 2000 Zeichen), `embeds` und `components`. Andere Nachrichtenfelder wie `attachments` werden ohne Fehler ignoriert. Embeds brauchen „Embeds senden“. Ein Forenbeitrag braucht weiterhin `content`.
- „Nachrichten senden“ und die Erwähnungsregeln gelten. Eine Rollenerwähnung ohne „Rollen erwähnen“ oder `@everyone` ohne „Alle erwähnen“ lehnt den ganzen Aufruf mit `403 MissingPermission` ab, und kein Thread bleibt. Der Thread wird erst angelegt und dann wieder entfernt, dein Bot kann also `ChannelCreate` und danach `ChannelDelete` dafür bekommen. Starte den Thread ohne die Erwähnung und erwähne in einer zweiten Nachricht.
- Auf einem selbst gehosteten Server, dessen Betreiber `mass_mentions_enabled = false` gesetzt hat, werden Rollen-, `@everyone`- und `@here`-Erwähnungen nicht abgelehnt: Die Nachricht geht raus, und niemand wird benachrichtigt.

Eine Karte mit Schaltflächen kann die erste Nachricht eines Threads sein:

@@2

Mit dem SDK:

@@3

Drei Berechtigungen legen fest, wer startet und wer schreibt. Jede wird am übergeordneten Kanal mit seinen Überschreibungen gelesen, und Nachrichten senden ist zusätzlich nötig: `CreateThreads` startet einen Thread in einem Textkanal, `CreateForumPosts` startet einen Beitrag in einem Forum, und `SendMessageInThreads` schreibt in Threads und Forenbeiträgen. Fehlt eine davon, antwortet der Aufruf mit `MissingPermission`. Einen Bot-Befehl in einem Thread zu nutzen zählt als Schreiben dort.

Ein Server kann Threads oder Foren ausschalten: `threads_disabled` und `forums_disabled` in `PATCH /servers/{target}`. Dann kann niemand etwas hinzufügen, auch der Eigentümer nicht: Nachrichten, Bearbeitungen, Reaktionen und Anpinnen antworten mit `ThreadsDisabled` oder `ForumsDisabled`. Alles bleibt lesbar, und man kann weiterhin eigene Nachrichten löschen und Reaktionen entfernen.

## Foren {#forums}

Ein Forum hält nur Beiträge. Jeder Beitrag ist ein Thread mit Titel, erster Nachricht und bis zu fünf Tags. Erstelle ein Forum mit `"type": "Forum"` in `POST /servers/{server}/channels` und poste hinein:

@@4

Ein Beitrag braucht `content`, und seine `tags` müssen Tags dieses Forums sein. Mit dem SDK:

@@5

## Einladungen {#invites}

Bots erstellen und verwalten Einladungen wie Menschen, mit denselben Berechtigungen: „Andere einladen“ zum Erstellen, „Server verwalten“ zum Listen und Entfernen. Sie treten nie selbst damit bei: Das antwortet `IsBot`.

@@6

Die Antwort hat den Einladungscode in `_id`. `GET /servers/{target}/invites` listet sie, und `DELETE /invites/{target}` entfernt eine. Mit dem SDK:

@@7

## Tippen {#typing}

`POST /channels/{target}/typing` zeigt ein paar Sekunden „tippt…“, begrenzt auf 5 pro 10 Sekunden pro Kanal. `bot.typing(channelId)` im SDK nutzt das Gateway, wenn verbunden, und ohne Verbindung diese Route.

## Webhooks {#webhooks}

Ein Webhook schreibt in einen Kanal, ohne Bot und ohne Gateway-Verbindung: ein CI-Job, ein Formular, ein Feed. Erstellen, Senden, Limits und Ereignisse stehen auf einer eigenen Seite: [Webhooks](/developers/docs/webhooks).

## Referenz {#reference}

@@8
