# Slash-Befehle

Registriere Befehle, die Menschen als `/name` tippen, mit Optionen, Unterbefehlen und Namen in ihrer Sprache.

## Das brauchst du {#you-will-need}

Dein Bot-Token (`YOUR_BOT_TOKEN`) und seine ID (`YOUR_BOT_ID`). Die ID steht im Entwicklerportal und in `GET /users/@me` als `_id`.

## Global oder pro Server {#scope}

| Bereich | Route                                                             | Erreicht                     |
| ------- | ----------------------------------------------------------------- | ---------------------------- |
| Global  | `PUT /applications/{application_id}/commands`                     | Jeden Server mit dem Bot     |
| Server  | `PUT /applications/{application_id}/servers/{server_id}/commands` | Einen Server                 |

Eine Änderung erreicht Menschen in beiden Bereichen sofort. Nutze beim Bauen einen Testserver, damit niemand sonst halbfertige Befehle sieht. Der Bot muss auf diesem Server installiert sein.

Gibt es denselben Namen in beiden Bereichen, sehen Menschen beide.

## Registrieren {#register}

`PUT` ersetzt die ganze Liste. Das ist der einfachste Weg, Befehle mit deinem Code gleich zu halten: Sende deine Liste bei jedem Start. Unveränderte Befehle behalten ihre IDs. Befehle, die fehlen, werden gelöscht.

@@0

`POST /applications/{application_id}/commands` fügt einen Befehl hinzu, `PATCH /applications/{application_id}/commands/{command_id}` ändert einen, `DELETE` entfernt einen. Ohne Code öffnest du deine Anwendung im Entwicklerportal, Tab **Befehle**, und fügst die JSON-Liste ein.

## Ein Befehl {#fields}

| Feld                        | Bedeutung                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `name`                      | 1 bis 32 Kleinbuchstaben beliebiger Schrift, Ziffern, `-` oder `_`                      |
| `description`               | 1 bis 100 Zeichen. Pflicht für Slash-Befehle, leer für die zwei Menütypen               |
| `type`                      | `ChatInput` (Standard, der `/`-Befehl), `User` oder `Message` (siehe unten)             |
| `options`                   | Bis zu 25 Optionen                                                                      |
| `name_localizations`        | Namen pro Sprache                                                                       |
| `description_localizations` | Beschreibungen pro Sprache                                                              |
| `default_member_permissions` | Berechtigungsbits, die ein Mitglied braucht, um den Befehl zu sehen und zu nutzen      |
| `nsfw`                      | Nur in als nicht jugendfrei markierten Kanälen nutzbar                                  |

Der Server füllt `_id`, `application_id` und `version`. `version` ändert sich mit jeder Änderung. Wer noch eine ältere Version offen hat, wird gebeten, neu zu laden.

## Limits {#limits}

| Was                                                   | Limit |
| ----------------------------------------------------- | ----- |
| Slash-Befehle pro Anwendung und Bereich               | 100   |
| `User`-Befehle, `Message`-Befehle                     | je 5  |
| Optionen pro Ebene                                    | 25    |
| Auswahlwerte einer Option                             | 25    |
| Name, in Zeichen                                      | 32    |
| Beschreibung, Auswahlname, Auswahlwert                | 100   |
| Übersetzte Texte pro Feld                             | 30    |
| Alle Namen, Beschreibungen und Auswahlwerte zusammen, Übersetzungen inklusive | 8000 |

## Optionen {#options}

@@1

| Option `type` | Der Bot bekommt                | Zusatzfelder                                       |
| ------------- | ------------------------------ | -------------------------------------------------- |
| `String`      | Text                           | `min_length`, `max_length` (bis 6000), `choices`, `autocomplete` |
| `Integer`     | eine ganze Zahl                | `min_value`, `max_value`, `choices`, `autocomplete` |
| `Number`      | eine Zahl                      | `min_value`, `max_value`, `choices`, `autocomplete` |
| `Boolean`     | `true` oder `false`            |                                                    |
| `User`        | eine Benutzer-ID               |                                                    |
| `Role`        | eine Rollen-ID                 |                                                    |
| `Channel`     | eine Kanal-ID                  | `channel_types`: `Text`, `Voice`                   |
| `Mentionable` | eine Benutzer- oder Rollen-ID  |                                                    |
| `Attachment`  | eine Datei-ID                  |                                                    |

Regeln, die der Server beim Registrieren prüft:

- `required`-Optionen stehen vor optionalen.
- `choices` und `autocomplete` schließen sich aus.
- Zahlen bleiben innerhalb von 9007199254740991, damit JavaScript sie halten kann.

Der Server prüft Pflichtoptionen, Limits und Auswahlwerte, bevor dein Bot die Interaktion sieht. Für `User`, `Role`, `Channel` und `Attachment` kommen die ganzen Objekte in `command.resolved`.

## Unterbefehle {#sub-commands}

Fasse Aktionen unter einem Namen zusammen: `/note add`, `/note list`.

@@2

Regeln:

- `SubCommand` kann normale Optionen halten. Eine `SubCommandGroup` hält nur Unterbefehle.
- Eine Gruppe steht auf der obersten Ebene. Nichts verschachtelt tiefer als eine Gruppe.
- Unterbefehle und einfache Optionen mischen sich nicht auf einer Ebene.
- Ein Unterbefehl nimmt `name`, `description` und `options`, sonst nichts.

Der gewählte Pfad kommt in den Optionen an, die Werte darin:

@@3

## Namen in anderen Sprachen {#localisation}

Gib jeden Text pro Sprache an. Die Schlüssel sind Sprachtags: `ar`, `de`, `pt-BR`.

@@4

Optionen und Auswahlwerte nehmen dieselben Felder. Übersetzte Namen folgen denselben Regeln wie `name`, arabische Buchstaben sind also erlaubt. Die Interaktion trägt immer den Basisnamen `name`, dein Code hat also einen Fall pro Befehl. Sie trägt auch die Sprache der Person in `locale`, damit du darin antworten kannst.

## Wer einen Befehl nutzen kann {#who}

`default_member_permissions` ist eine Zahl aus [Berechtigungsbits](/developers/docs/roles#permission-bits). Ein Mitglied ohne diese Berechtigungen sieht den Befehl nicht, und eine Anfrage bekommt `MissingPermission`. `256` ist „Mitglieder in Timeout versetzen“. Dein Bot sollte trotzdem `user_permissions` prüfen: Admins können Rollen ändern, und ein Befehl ist keine Sicherheitsmauer für das, was dein Bot selbst tut.

## Menübefehle {#menu-commands}

`"type": "User"` und `"type": "Message"` zeigen einen Befehl im Menü eines Benutzers oder einer Nachricht. Sie haben weder Beschreibung noch Optionen, und ihr Name darf Großbuchstaben und Leerzeichen enthalten. Das Ziel kommt in `command.target_id`.

## Häufige Fehler {#errors}

| Fehler                 | Ursache                                          | Lösung                                  |
| ---------------------- | ------------------------------------------------ | --------------------------------------- |
| `FailedValidation`     | Eine Regel oben ist verletzt; `error` sagt, welche | Korrigiere die Liste. Nichts wurde gespeichert |
| `CommandAlreadyExists` | `POST` mit einem belegten Namen                  | Nutze `PUT` oder `PATCH`                |
| `TooManyCommands`      | Limit erreicht                                   | Lösche Befehle                          |
| `UnknownCommand`       | Die ID ist weg                                   | Hole die Liste mit `GET`                |

## Referenz {#reference}

Die Routen stehen unter [Auf Interaktionen antworten](/developers/docs/interactions#reference).

## Weiter {#next}

- [Auf Interaktionen antworten](/developers/docs/interactions)
- [Befehle mit Optionen](/developers/docs/tutorial-commands)
