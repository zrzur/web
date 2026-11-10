# Nachrichten

Ein Bot sendet, bearbeitet und löscht eigene Nachrichten, reagiert, heftet an und löscht mit **Nachrichten verwalten** auch die anderer.

## Eine Nachricht senden {#send-a-message}

@@0

- **Limits**: `GET /` listet sie für jeden Server (standardmäßig 2000 Zeichen, 5 Anhänge, 10 Embeds, 5 Antworten, 20 verschiedene Reaktionen pro Nachricht).
- **Idempotenz**: Sende einen Header `Idempotency-Key` mit eindeutigem Wert. Wird die Anfrage mit demselben Schlüssel wiederholt, geht die Nachricht nicht zweimal hinaus.
- **Stille Nachrichten**: `flags: 1` sendet ohne Benachrichtigungen.
- **Maskerade**: `masquerade: { name, avatar }` zeigt einen anderen Namen und Avatar auf der Nachricht (braucht Masquerade; `colour` braucht auch „Rollen verwalten“).
- **Komponenten**: Schaltflächen, Menüs und Layoutblöcke; nur Bots können sie senden. Siehe [Schaltflächen, Menüs und Formulare](/developers/docs/components).
- **Erwähnungen**: `<@user id>` erwähnt einen Benutzer, `<%role id>` eine Rolle (braucht Mention Roles), `@everyone` und `@online` brauchen Mention Everyone. Ohne die Berechtigung wird die ganze Nachricht mit `MissingPermission` abgelehnt; sie geht nicht ohne die Erwähnung raus. Auf einem selbst gehosteten Server mit `mass_mentions_enabled = false` gehen Rollen-, `@everyone`- und `@online`-Erwähnungen stattdessen ohne Benachrichtigung raus.
- **Kanal-Links**: `<#channel id>` zeigt einen Link auf einen Kanal oder Thread. Er benachrichtigt niemanden.

## Antworten {#reply}

`replies` antwortet auf frühere Nachrichten, bis zu 5. `id` ist die Nachricht, `mention` sagt, ob ihr Autor erwähnt wird, und `fail_if_not_exists: false` sendet auch dann, wenn die Nachricht weg ist.

@@1

## Bearbeiten und löschen {#edit}

`PATCH /channels/{target}/messages/{msg}` nimmt `content`, `embeds` und `components`. Ein Bot bearbeitet nur eigene Nachrichten. `DELETE /channels/{target}/messages/{msg}` löscht eigene, oder jede mit „Nachrichten verwalten“. Eine Bearbeitung benachrichtigt nie erneut.

## Embeds {#embeds}

Ein Embed ist eine Karte unter der Nachricht. Senden braucht Send Embeds.

| Feld            | Bedeutung                                     |
| --------------- | --------------------------------------------- |
| `title`         | Titel                                         |
| `description`   | Text, mit Markdown                            |
| `url`           | Adresse, auf die der Titel zeigt              |
| `colour`        | Eine CSS-Farbe, etwa `#E0195F`                |
| `icon_url`      | Kleines Bild neben dem Titel                  |
| `media`         | ID einer hochgeladenen Datei, als Bild gezeigt |
| `image_url`     | Adresse eines großen Bildes                   |
| `thumbnail_url` | Adresse eines kleinen Bildes an der Seite     |
| `author`        | `name`, `url`, `icon_url`                     |
| `fields`        | Bis zu 25, je mit `name`, `value`, `inline`   |
| `footer`        | `text`, `icon_url`                            |
| `timestamp`     | Ein Datum, unten gezeigt                      |

Die genauen Felder und Limits stehen in der [Referenz unten](/developers/docs/messages#post-channels-target-messages).

## Anhänge {#attachments}

Eine Nachricht verweist per ID auf Dateien. Erst hochladen, dann senden. Jede ID geht einmal: Eine zweite Nutzung antwortet `404 NotFound`. Senden braucht Upload Files. Eine Datei, die eine Person deinem Bot über die Option `Attachment` eines Befehls gegeben hat, ist von diesem Befehl schon verwendet; siehe [Slash-Befehle](/developers/docs/commands#attachments).

@@2

Größen und Typen stehen unter [Dateien](/developers/docs/files).

## Nachrichten lesen {#read-messages}

`GET /channels/{target}/messages` liefert 50 Nachrichten, mit `limit` bis zu 100. Lesen braucht „Kanal sehen“ und „Ältere Nachrichten lesen“.

| Query-Parameter | Bedeutung                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------- |
| `limit`         | 1 bis 100. Standard 50                                                                    |
| `before`        | Eine Nachrichten-ID: nur ältere Nachrichten                                               |
| `after`         | Eine Nachrichten-ID: nur neuere Nachrichten                                               |
| `sort`          | `Latest` (Standard, neueste zuerst) oder `Oldest` (älteste zuerst). `Relevance` antwortet `InvalidOperation` |
| `nearby`        | Eine Nachrichten-ID: Nachrichten um sie herum, sie selbst eingeschlossen. `before`, `after` und `sort` werden ignoriert |
| `include_users` | `true` fügt die Autoren hinzu                                                             |

Die Antwort ist eine Liste von Nachrichten. Mit `include_users=true` ist sie stattdessen ein Objekt: `{ "messages": [...], "users": [...], "members": [...] }`. `members` gibt es nur in Serverkanälen.

Um nach einem Neuverbinden aufzuholen, frage nach `after` deiner letzten Nachricht mit `sort=Oldest`: Du bekommst die nächsten Nachrichten der Reihe nach. Mit der Standardreihenfolge kämen die neuesten, und in der Mitte bliebe eine Lücke. Wiederhole mit der ID der letzten erhaltenen Nachricht, bis weniger als `limit` zurückkommen.

@@3

Textsuche ist nur für Menschen; Bots bekommen `IsBot`, denn sonst könnten sie lesen, was ihre Intents verbergen. Bots können angeheftete Nachrichten listen (siehe [Anheften und Reaktionen](/developers/docs/messages#pins-and-reactions)). Auch der Erwähnungseingang ist nur für Menschen.

## Massenlöschung {#bulk-delete}

`DELETE /channels/{target}/messages/bulk` löscht bis zu 100 Nachrichten auf einmal. Nachrichten, die älter als eine Woche sind, gehen nicht in Masse; lösche sie einzeln.

## Direktnachrichten {#direct-messages}

`GET /users/{target}/dm` öffnet den DM-Kanal mit einem Benutzer oder liefert ihn. Ob der Bot dort schreiben darf, hängt von Privatsphäre-Einstellungen und Blockierungen ab, siehe [Benutzer und Mitglieder](/developers/docs/users#privacy-limits).

## Referenz {#reference}

@@4

## Anheften und Reaktionen {#pins-and-reactions}

`PUT /channels/{target}/messages/{msg}/reactions/{emoji}` fügt die Reaktion des Bots hinzu, `DELETE` auf demselben Pfad entfernt sie. Das Emoji steht URL-kodiert im Pfad (`%F0%9F%91%8D` für Daumen hoch) oder als ID eines eigenen Emojis. `POST /channels/{target}/messages/{msg}/pin` heftet an. `POST /channels/{target}/search` mit `pinned: true` listet angeheftete Nachrichten. Andere Suche ist nur für Menschen: Bots bekommen `IsBot`, denn sonst könnten sie lesen, was ihre Intents verbergen.

## Umfragen {#polls}

Eine Nachricht kann eine Umfrage tragen (`poll` in der gesendeten Nachricht: eine Frage, 2 bis 10 Antworten, eine Dauer von 1 bis 336 Stunden, eine oder mehrere Antworten wählbar). Zum Posten braucht es Nachrichten senden und Embeds senden. `poll` einer Nachricht zeigt, wie viele jede Antwort gewählt haben; `poll.me` nennt die Antworten der lesenden Person.

Wer abgestimmt hat, geht nie an alle: Umfrage-Events (`MessagePollVoteAdd`, `MessagePollVoteRemove`, `MessagePollEnd`) tragen nur Zahlen. `/channels/{target}/messages/{msg}/polls/answers/{answer}/voters` (GET) listet seitenweise, wer eine Antwort gewählt hat, für alle, die die Nachricht lesen können (Kanal ansehen und Nachrichtenverlauf lesen); eine Stimme ist also für alle im Kanal sichtbar, die nachsehen. Bots können nicht abstimmen (`IsBot`); sie können Abstimmende lesen und eigene Umfragen beenden (`/channels/{target}/messages/{msg}/polls/end`, POST). Eine Stimme in einer beendeten Umfrage ergibt `PollEnded`.
