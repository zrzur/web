# Kanäle und Webhooks

Jeder Serverkanal hat `channel_type: "TextChannel"`: Text, Sprache (mit `voice`), Ankündigung, Forum (mit `forum`) und Thread (mit `parent` und `thread`). Ein Bot sieht auch die Direktnachrichten, an denen er teilnimmt (`DirectMessage`). Gruppen sind nur für Menschen. Die [Ereignisreferenz](/developers/docs/events#channels) listet die Felder und zeigt, wie man eine Direktnachricht von einem Serverkanal unterscheidet.

Die Beispiele nutzen einfaches HTTP. Die SDK-Zeilen danach brauchen das SDK, das noch nicht veröffentlicht ist; siehe [SDKs](/developers/docs/sdk).

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

- Sie nimmt nur `content`, bis zu 2000 Zeichen. Andere Felder wie `embeds`, `components` oder `attachments` werden ohne Fehler ignoriert: Der Thread beginnt nur mit dem Text. `embeds` und `components` kommen in der nächsten Version (siehe [Änderungsprotokoll](/developers/docs/changelog#upcoming)).
- „Nachrichten senden“ und die Erwähnungsregeln gelten. Eine Rollenerwähnung ohne Mention Roles oder `@everyone` ohne Mention Everyone lehnt den ganzen Aufruf mit `403 MissingPermission` ab, und kein Thread bleibt. Der Thread wird erst angelegt und dann wieder entfernt, dein Bot kann also `ChannelCreate` und danach `ChannelDelete` dafür bekommen. Starte den Thread ohne die Erwähnung und erwähne in einer zweiten Nachricht.
- Auf einem selbst gehosteten Server, dessen Betreiber `mass_mentions_enabled = false` gesetzt hat, werden Rollen-, `@everyone`- und `@online`-Erwähnungen nicht abgelehnt: Die Nachricht geht raus, und niemand wird benachrichtigt.

Für eine Karte mit Schaltflächen oben im Thread starte den Thread nur mit einem Namen und sende die Karte dann hinein:

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

Ein Webhook postet ohne Gateway-Verbindung in einen Kanal. Erstelle ihn mit einem Bot-Token oder in den Servereinstellungen (braucht „Webhooks verwalten“). Die Antwort hat `token` und `url`. Sie erscheinen einmal: Der Server behält nur einen Hash, also speichere sie jetzt. Ein verlorenes Token lässt sich nur ersetzen.

@@8

Wer die Adresse hat, kann posten, also behandle sie wie ein Passwort. Tokens beginnen mit `zrzur_wh_`, damit Secret-Scanner durchgesickerte finden. `POST /webhooks/{webhook_id}/token` erzeugt ein neues Token; das alte stoppt sofort.

### Senden {#sending}

`POST /webhooks/{webhook_id}/{token}` antwortet `204`. Mit `?wait=true` liefert es die Nachricht.

| Feld               | Bedeutung                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `content`          | Bis zu 2000 Zeichen. Eine Nachricht braucht mindestens eins von `content`, `embeds`, `attachments`, `components` |
| `username`         | Name auf dieser Nachricht, 1 bis 80 Zeichen. Die Webhook-Markierung bleibt                         |
| `avatar_url`       | Avatar auf dieser Nachricht, eine öffentliche Webadresse. Apps laden ihn über den Medien-Proxy, der ihn prüft |
| `embeds`           | Bis zu 10, insgesamt 6000 Zeichen. `type` wird ignoriert: Embeds sind immer reich                  |
| `allowed_mentions` | Welche Erwähnungen benachrichtigen dürfen. `{ "parse": [] }` schaltet alle aus                     |
| `flags`            | `4` versteckt Linkvorschauen, `4096` sendet ohne Benachrichtigung                                  |
| `thread_id`        | Query-Parameter: in diesen Thread des Webhook-Kanals posten                                        |
| `thread_name`      | Forum: einen Thread mit diesem Namen beginnen. `applied_tags` setzt seine Tags. Ein Forum ohne beides antwortet `ForumThreadRequired` |

Embeds nehmen `title` (256), `description` (4096), `url`, `color` (Zahl) oder `colour` (CSS-Text), `timestamp`, `author` (Name 256), `footer` (Text 2048), bis zu 25 `fields` (Name 256, Wert 1024), `image.url`, `thumbnail.url`.

Um Dateien zu senden, nimm `multipart/form-data` mit `files[0]`, `files[1]`, ... und dem JSON in `payload_json`. Jede Datei durchläuft dieselben Prüfungen wie der Upload eines Mitglieds. Bis zu 5 Dateien mit 20 MB; verweise aus einem Embed mit `attachment://name.png`. Ein Webhook ohne Upload Files bekommt `403`, nie eine Nachricht ohne ihre Dateien.

`@everyone`, `@online` und Rollenerwähnungen benachrichtigen nur, wenn der Webhook die passende Berechtigung hat und `allowed_mentions` sie erlaubt. Neue Webhooks haben keine von beiden, und der Text wird trotzdem gepostet. Bearbeitungen benachrichtigen nie.

Interaktive Komponenten funktionieren nur auf Webhooks, die ein Bot erstellt hat, und Klicks gehen an diesen Bot. Andere Webhooks können Links, Text und Medien posten.

### Einen Webhook bearbeiten {#editing-a-webhook}

`PATCH /webhooks/{webhook_id}` mit „Webhooks verwalten“ ändert Namen, Avatar, Berechtigungen und Kanal und nimmt `X-Audit-Log-Reason`. Mit dem Token ändert `PATCH /webhooks/{webhook_id}/{token}` nur Namen und Avatar; `permissions` oder `channel_id` antworten dort `403`. `GET` mit dem Token lässt weg, wer ihn erstellt hat. Namen haben 1 bis 80 Zeichen und dürfen weder versteckte Zeichen enthalten noch sich als Zrzur, sein Team oder einen bestätigten Bot ausgeben.

### Seine eigenen Nachrichten {#its-own-messages}

`GET`, `PATCH` und `DELETE /webhooks/{webhook_id}/{token}/messages/{message_id}` funktionieren auf Nachrichten, die dieser Webhook gesendet hat, und sonst keinen.

In einem Thread braucht ein Webhook `SendMessageInThreads`, und `CreateForumPosts`, um einen Forenbeitrag zu starten. Was die Rollen seines Erstellers verbieten, ist auch ihm verboten. Wo Threads oder Foren ausgeschaltet sind, kann er weder senden noch bearbeiten, seine eigenen Nachrichten aber löschen.

### Limits {#limits}

Jeder Kanal hat bis zu 15 Webhooks (`TooManyChannelWebhooks`) und jeder Server bis zu 1000 (`TooManyServerWebhooks`).

Ein Webhook sendet 5 Nachrichten in 2 Sekunden, und alle Webhooks eines Kanals 30 pro Minute. Darüber ist die Antwort `429` mit `{ "type": "RateLimited", "retry_after": 1200, "global": false }` (Millisekunden) und den Headern `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset-After` und `Retry-After`. Nach 20 falschen Tokens in einer Minute wartet eine Adresse, auch mit richtigem Token.

AutoMod liest Webhook-Nachrichten und ihre Embeds, auch bei Bearbeitungen. Die Moderation kann sie löschen und melden wie jede Nachricht.

### Andere Formate {#other-formats}

- `POST /webhooks/{webhook_id}/{token}/github` nimmt GitHub-Zustellungen: Setze den Inhaltstyp auf `application/json` oder Formular. Es zeigt `commit_comment`, `create`, `delete`, `fork`, `issue_comment`, `issues`, `member`, `public`, `pull_request`, `pull_request_review`, `pull_request_review_comment`, `push`, `release`, `watch`, `check_run`, `check_suite`, `discussion`, `discussion_comment` und `star`. Jedes andere Ereignis antwortet `204`.
- `POST /webhooks/{webhook_id}/{token}/slack` nimmt `text`, `attachments`, `blocks`, `username` und `icon_url`. Es liefert die Nachricht, außer mit `?wait=false`.

Nichts aus diesen beiden Formaten benachrichtigt jemanden.

## Referenz {#reference}

@@9
