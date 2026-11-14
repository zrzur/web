# Auf Interaktionen antworten

Jede Nutzung eines Slash-Befehls, Menübefehls, einer Schaltfläche, eines Auswahlmenüs, Formulars oder der Autovervollständigung erreicht deinen Bot als **Interaktion**. Diese Seite zeigt, wie du rechtzeitig antwortest.

## Das brauchst du {#you-will-need}

Eine laufende Gateway-Verbindung mit dem Intent `INTERACTIONS` oder eine [HTTP-Adresse](/developers/docs/http-interactions). Befehle funktionieren in Serverkanälen und, für die globalen Befehle des Bots ohne Serverberechtigung, in einer Direktnachricht mit ihm. Schaltflächen, Auswahlmenüs und Formulare funktionieren in dieser Direktnachricht auch; `server_id` und `member` fehlen dann.

## Die Zeitlimits {#time-limits}

| Limit                                | Zeit       | Was danach passiert                                                     |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------- |
| Erste Antwort                        | 3 Sekunden | Die Person sieht, dass der Bot nicht geantwortet hat. Eine späte Antwort bekommt `InteractionExpired` |
| Änderungen und Folgenachrichten      | 15 Minuten | Das Token hört auf: `InteractionExpired` oder `UnknownInteraction`      |

Das Ereignis trägt beide als `respond_by` und `expires_at`. Richte dich nach den Zeiten des Ereignisses, nicht nach deiner Uhr.

Dauert die Arbeit mehr als einen Moment, antworte zuerst `DeferredMessage`. Das zeigt „denkt nach“ und gibt dir die 15 Minuten.

Ist dein Bot nicht verbunden, wenn jemand einen Befehl nutzt, wird nichts für später aufbewahrt: Die Person erfährt sofort, dass der Bot offline ist (die App bekommt `503 ApplicationOffline`).

## Das Ereignis {#the-event}

@@0

| Feld                      | Bedeutung                                                                      |
| ------------------------- | ------------------------------------------------------------------------------ |
| `type`                    | `Command`, `Component`, `ModalSubmit` oder `Autocomplete`                      |
| `token`                   | Gilt nur für diese Interaktion. Behandle es bis `expires_at` wie ein Passwort  |
| `user`, `member`          | Wer es getan hat                                                               |
| `user_permissions_string` | Ihre Berechtigungen in diesem Kanal. Nimm das in JavaScript, nicht `user_permissions` |
| `app_permissions_string`  | Die Berechtigungen deines Bots in diesem Kanal                                 |
| `locale`                  | Ihre Sprache, falls die App sie gesendet hat                                   |
| `command`                 | Bei `Command` und `Autocomplete`: `name`, `options`, `resolved`, `target_id`, `focused` |
| `component`               | Bei `Component`: `custom_id`, `component_type`, `values`, `resolved`           |
| `modal`                   | Bei `ModalSubmit`: `custom_id`, `fields`, `resolved`                           |
| `message_id`              | Die Nachricht, auf der die Komponente sitzt                                    |
| `message_ephemeral`       | `true`, wenn diese Nachricht privat ist                                        |

Die Berechtigungszahlen sind zu groß für eine JavaScript-Zahl, also lies sie als `BigInt`:

@@1

## Antworten {#answer}

Sende eine erste Antwort. Es braucht keinen Token-Header: Der Pfad enthält das Token.

@@2

| Antwort `type`       | Wann                                                                     | Text                                |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| `Message`            | Jetzt antworten                                                          | `data`                              |
| `DeferredMessage`    | Die Arbeit dauert länger als 3 Sekunden. Zeigt „denkt nach“              | `data.ephemeral`, wenn es privat bleibt |
| `UpdateMessage`      | Schaltflächen und Menüs: die Nachricht der Komponente ändern             | `data`                              |
| `DeferredUpdate`     | Schaltflächen und Menüs: jetzt bestätigen, Nachricht später ändern       | keiner                              |
| `Modal`              | Ein Formular öffnen. Nicht als Antwort auf ein Formular oder Autovervollständigung | `modal`                   |
| `AutocompleteResult` | Vorschläge. Die einzige Antwort auf `Autocomplete`                       | `choices`, bis zu 25                |

`data` nimmt `content`, `embeds`, `components` und `ephemeral`. Zweimal antworten ergibt `InteractionAlreadyAcknowledged`.

## Private Antworten {#ephemeral}

`"ephemeral": true` zeigt eine Antwort nur dieser Person. Sie wird nie im Kanal gespeichert und verschwindet beim Neuladen. Die Wahl fällt einmal: Eine aufgeschobene Antwort bleibt so privat, wie du beim Aufschieben gesagt hast.

## Aufgeschobene Antworten {#deferred}

@@3

## Folgenachrichten {#follow-ups}

Nach der ersten Antwort kannst du bis zu 5 weitere Nachrichten zur selben Interaktion senden, bis das Token endet:

@@4

Die Antwort enthält die `_id` der neuen Nachricht. Eine Folgenachricht hat ihre eigene `ephemeral`-Wahl und kann nicht nach einer `Modal`-Antwort kommen.

| Um                         | Route                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| Die erste Antwort zu ändern | `PATCH /interactions/{interaction_id}/{token}/original`              |
| Die erste Antwort zu löschen | `DELETE /interactions/{interaction_id}/{token}/original`            |
| Eine Folgenachricht zu ändern | `PATCH /interactions/{interaction_id}/{token}/messages/{message_id}` |
| Eine Folgenachricht zu löschen | `DELETE /interactions/{interaction_id}/{token}/messages/{message_id}` |

## Autovervollständigung {#autocomplete}

Eine Option mit `"autocomplete": true` fragt deinen Bot beim Tippen nach Vorschlägen. `command.focused` nennt die Option, und ihr `value` enthält den bisherigen Text, bis zu 100 Zeichen.

@@5

Antworte schnell, denn jeder Tastendruck kann eine Anfrage senden. Eine `Autocomplete`-Interaktion nimmt nur diese Antwort, und keine andere nimmt sie.

## Häufige Fehler {#errors}

| Fehler                           | Ursache                                           | Lösung                             |
| -------------------------------- | ------------------------------------------------- | ---------------------------------- |
| `InteractionExpired`             | Über die 3 Sekunden oder die 15 Minuten           | Zuerst aufschieben                 |
| `InteractionAlreadyAcknowledged` | Eine zweite erste Antwort                         | Folgenachricht oder Änderung       |
| `InvalidOperation`               | Die Antwort passt nicht, etwa `UpdateMessage` auf einen Befehl | Prüfe die Tabelle oben |
| `TooManyFollowups`               | Mehr als 5                                        | Ändere stattdessen eine Nachricht  |
| `UnknownInteraction`             | Falsche ID oder falsches Token                    | Nimm die Werte des Ereignisses     |

## Referenz {#reference}

@@6

## Weiter {#next}

- [Schaltflächen, Menüs und Formulare](/developers/docs/components)
- [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot)
