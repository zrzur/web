# Webhooks

Ein Webhook schreibt Nachrichten in einen Kanal. Er braucht keinen Bot, keine Gateway-Verbindung und keine Bibliothek: eine HTTP-Anfrage an seine Adresse genügt. Das passt für einen CI-Job, ein Überwachungsskript, ein Formular oder einen Nachrichten-Feed. Auch ein Bot kann Webhooks erstellen, und nur Webhooks eines Bots können Knöpfe und Menüs tragen.

> **Webhooks werden pro Server-Installation eingeschaltet.** `GET /` der API zeigt `features.webhooks`. Wo es `false` ist, antworten das Erstellen und Auflisten von Webhooks mit `FeatureDisabled`, und jede Adresse `/webhooks/...` antwortet `404 NotFound`. Auf `api.zrzur.com` war es `false`, als diese Seite geprüft wurde (2026-11-14).

Ein Webhook postet ohne Gateway-Verbindung in einen Kanal. Erstelle ihn mit einem Bot-Token oder in den Servereinstellungen (braucht „Webhooks verwalten“). Die Antwort hat `token` und `url`. Sie erscheinen einmal: Der Server behält nur einen Hash, also speichere sie jetzt. Ein verlorenes Token lässt sich nur ersetzen.

@@0

Wer die Adresse hat, kann posten, also behandle sie wie ein Passwort. Tokens beginnen mit `zrzur_wh_`, damit Secret-Scanner durchgesickerte finden. `POST /webhooks/{webhook_id}/token` erzeugt ein neues Token; das alte stoppt sofort.

## Senden {#sending}

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

Um Dateien zu senden, nimm `multipart/form-data` mit `files[0]`, `files[1]`, ... und dem JSON in `payload_json`. Jede Datei durchläuft dieselben Prüfungen wie der Upload eines Mitglieds. Bis zu 5 Dateien mit 20 MB; verweise aus einem Embed mit `attachment://name.png`. Ein Webhook ohne „Dateien hochladen“ bekommt `403`, nie eine Nachricht ohne ihre Dateien.

`@everyone`, `@online` und Rollenerwähnungen benachrichtigen nur, wenn der Webhook die passende Berechtigung hat und `allowed_mentions` sie erlaubt. Neue Webhooks haben keine von beiden, und der Text wird trotzdem gepostet. Bearbeitungen benachrichtigen nie.

Interaktive Komponenten funktionieren nur auf Webhooks, die ein Bot erstellt hat, und Klicks gehen an diesen Bot. Andere Webhooks können Links, Text und Medien posten.

## Einen Webhook bearbeiten {#editing-a-webhook}

`PATCH /webhooks/{webhook_id}` mit „Webhooks verwalten“ ändert Namen, Avatar, Berechtigungen und Kanal und nimmt `X-Audit-Log-Reason`. Mit dem Token ändert `PATCH /webhooks/{webhook_id}/{token}` nur Namen und Avatar; `permissions` oder `channel_id` antworten dort `403`. `GET` mit dem Token lässt weg, wer ihn erstellt hat. Namen haben 1 bis 80 Zeichen und dürfen weder versteckte Zeichen enthalten noch sich als Zrzur, sein Team oder einen bestätigten Bot ausgeben.

## Seine eigenen Nachrichten {#its-own-messages}

`GET`, `PATCH` und `DELETE /webhooks/{webhook_id}/{token}/messages/{message_id}` funktionieren auf Nachrichten, die dieser Webhook gesendet hat, und sonst keinen.

In einem Thread braucht ein Webhook `SendMessageInThreads`, und `CreateForumPosts`, um einen Forenbeitrag zu starten. Was die Rollen seines Erstellers verbieten, ist auch ihm verboten. Wo Threads oder Foren ausgeschaltet sind, kann er weder senden noch bearbeiten, seine eigenen Nachrichten aber löschen.

## Limits {#limits}

Jeder Kanal hat bis zu 15 Webhooks (`TooManyChannelWebhooks`) und jeder Server bis zu 1000 (`TooManyServerWebhooks`).

Ein Webhook sendet 5 Nachrichten in 2 Sekunden, und alle Webhooks eines Kanals 30 pro Minute. Darüber ist die Antwort `429` mit `{ "type": "RateLimited", "retry_after": 1200, "global": false }` (Millisekunden) und den Headern `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset-After` und `Retry-After`. Nach 20 falschen Tokens in einer Minute wartet eine Adresse, auch mit richtigem Token.

AutoMod liest Webhook-Nachrichten und ihre Embeds, auch bei Bearbeitungen. Die Moderation kann sie löschen und melden wie jede Nachricht.

## Andere Formate {#other-formats}

- `POST /webhooks/{webhook_id}/{token}/github` nimmt GitHub-Zustellungen: Setze den Inhaltstyp auf `application/json` oder Formular. Es zeigt `commit_comment`, `create`, `delete`, `fork`, `issue_comment`, `issues`, `member`, `public`, `pull_request`, `pull_request_review`, `pull_request_review_comment`, `push`, `release`, `watch`, `check_run`, `check_suite`, `discussion`, `discussion_comment` und `star`. Jedes andere Ereignis antwortet `204`.
- `POST /webhooks/{webhook_id}/{token}/slack` nimmt `text`, `attachments`, `blocks`, `username` und `icon_url`. Es liefert die Nachricht, außer mit `?wait=false`.

Nichts aus diesen beiden Formaten benachrichtigt jemanden.

## Webhooks erstellen und verwalten {#managing}

All das braucht **Webhooks verwalten** im Kanal und geht mit einem Bot-Token oder der Sitzung einer Person.

| Anfrage | Was sie tut |
| --- | --- |
| `POST /channels/{channel_id}/webhooks` | Erstellt einen Webhook: `{ "name": "CI", "avatar": "<file id>" }`. Die Antwort enthält `token` und `url`, nur dieses eine Mal |
| `GET /channels/{channel_id}/webhooks` | Die Webhooks eines Kanals, ohne Tokens |
| `GET /servers/{target}/webhooks` | Die Webhooks aller Kanäle des Servers, in denen du Webhooks verwalten darfst, die neuesten zuerst, ohne Tokens |
| `GET /webhooks/{webhook_id}` | Ein Webhook, mit seinem Ersteller |
| `PATCH /webhooks/{webhook_id}` | Name, Bild, Berechtigungen, oder in einen anderen Kanal des Servers verschieben |
| `POST /webhooks/{webhook_id}/token` | Ein neues Token: das alte gilt sofort nicht mehr. Bewahre das `token` der Antwort auf |
| `POST /webhooks/{webhook_id}/test` | Eine Testnachricht ohne das Token: `{ "content": "Test" }`, 1 bis 200 Zeichen. Sie benachrichtigt und erwähnt niemanden und kommt als Antwort zurück |
| `DELETE /webhooks/{webhook_id}` | Entfernt ihn. Seine Nachrichten bleiben |

Mit dem Token statt einer Anmeldung: `GET`, `PATCH` (nur Name und Bild) und `DELETE /webhooks/{webhook_id}/{token}`.

Ein neues Token und eine Testnachricht zählen in einem eigenen kleinen Kontingent, `webhook_manage`: 5 je 10 Sekunden und Webhook. Sie verbrauchen nicht das Kontingent der Nachrichten, die durch ihn gesendet werden.

## Ereignisse {#events}

Das Gateway sendet `WebhookCreate`, `WebhookUpdate` und `WebhookDelete` nur an diejenigen, die die Webhooks des Kanals verwalten dürfen, und an Bots nur mit dem Intent `SERVERS`. Nachrichten durch einen Webhook kommen als gewöhnliche `Message`-Ereignisse, mit `webhook: { name, avatar }` an der Nachricht. Siehe die [Ereignisreferenz](/developers/docs/events).

## Häufige Fehler {#errors}

| Fehler | Ursache | Lösung |
| --- | --- | --- |
| `401 NotAuthenticated` oder `404 NotFound` | Das Token ist falsch oder wurde ersetzt | Das neueste Token verwenden; ist es verloren, ein neues erstellen |
| `403 MissingPermission` | Kein Webhooks verwalten (Verwalten), oder dem Webhook fehlt Dateien hochladen (Dateien) | Die Berechtigung im Kanal geben |
| `400 TooManyChannelWebhooks` | Der Kanal hat schon 15 Webhooks | Einen nicht mehr genutzten entfernen |
| `429 RateLimited` | Mehr als 5 Nachrichten in 2 Sekunden oder 30 pro Minute im Kanal | `retry_after` Millisekunden warten |
| `400 FeatureDisabled` | Webhooks sind auf dieser Server-Installation ausgeschaltet | Den Betreiber fragen |

## Referenz {#reference}

@@1
