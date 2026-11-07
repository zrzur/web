# Kanäle und Webhooks

Serverkanäle sind `TextChannel` (Text, auch Ankündigungskanäle) und `VoiceChannel`. Ein Bot sieht auch die Direktnachrichten, an denen er teilnimmt. Gruppen sind nur für Menschen.

## Kanäle erstellen und ändern {#create-and-change-channels}

- `POST /servers/{server}/channels` erstellt einen Text- oder Sprachkanal (braucht „Kanal verwalten“).
- `PATCH /channels/{target}` ändert Namen, Beschreibung, langsamen Modus, NSFW-Markierung oder Symbol.
- `DELETE /channels/{target}` löscht einen Serverkanal. Bei einer Direktnachricht schließt es sie für den Bot.
- `PUT /channels/{target}/permissions/{role_id}` und `.../default` setzen Kanal-Überschreibungen (braucht „Berechtigungen verwalten“). Siehe [Rollen und Berechtigungen](/developers/docs/roles).

Ankündigungskanäle nehmen nur Nachrichten von Mitgliedern mit „Nachrichten verwalten“ an.

## Threads {#threads}

Ein Thread ist ein Kanal in einem Textkanal und nutzt dessen Berechtigungen.

@@0

Dasselbe mit einfachem HTTP:

@@1

Ein Thread ist ein Kanal, also schreibt `POST /channels/{target}/messages` hinein. `GET /channels/{target}/threads` listet sie, und `PATCH /channels/{target}/thread` archiviert oder sperrt einen.

`POST /channels/{id}/threads` beginnt einen aus einer Nachricht (`message`) oder mit einer ersten Nachricht (`content`). Eine neue Nachricht öffnet einen archivierten Thread wieder. Sperren braucht „Nachrichten verwalten“.

Drei Berechtigungen legen fest, wer startet und wer schreibt. Jede wird am übergeordneten Kanal mit seinen Überschreibungen gelesen, und Nachrichten senden ist zusätzlich nötig: `CreateThreads` startet einen Thread in einem Textkanal, `CreateForumPosts` startet einen Beitrag in einem Forum, und `SendMessageInThreads` schreibt in Threads und Forenbeiträgen. Fehlt eine davon, antwortet der Aufruf mit `MissingPermission`. Einen Bot-Befehl in einem Thread zu nutzen zählt als Schreiben dort.

Ein Server kann Threads oder Foren ausschalten: `threads_disabled` und `forums_disabled` in `PATCH /servers/{target}`. Dann kann niemand etwas hinzufügen, auch der Eigentümer nicht: Nachrichten, Bearbeitungen, Reaktionen und Anpinnen antworten mit `ThreadsDisabled` oder `ForumsDisabled`. Alles bleibt lesbar, und man kann weiterhin eigene Nachrichten löschen und Reaktionen entfernen.

## Foren {#forums}

Ein Forum hält nur Beiträge. Jeder Beitrag ist ein Thread mit Titel, erster Nachricht und bis zu fünf Tags.

@@2

## Einladungen {#invites}

Bots erstellen und verwalten Einladungen wie Menschen, mit denselben Berechtigungen: „Andere einladen“ zum Erstellen, „Server verwalten“ zum Listen und Entfernen. Sie treten nie selbst damit bei: Das antwortet `IsBot`.

@@3

## Tippen {#typing}

`bot.typing(channelId)` zeigt ein paar Sekunden „tippt…“. Es nutzt das Gateway, wenn verbunden. Ohne Gateway-Verbindung ruft es `POST /channels/{id}/typing` auf, begrenzt auf 5 pro 10 Sekunden pro Kanal.

## Webhooks {#webhooks}

Ein Webhook postet ohne Gateway-Verbindung in einen Kanal. Erstelle ihn mit einem Bot-Token oder in den Servereinstellungen (braucht „Webhooks verwalten“). Die Antwort hat `token` und `url`. Sie erscheinen einmal: Der Server behält nur einen Hash, also speichere sie jetzt. Ein verlorenes Token lässt sich nur ersetzen.

@@4

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

@@5
