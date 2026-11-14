# Schaltflächen, Menüs und Formulare

Setze Schaltflächen und Auswahlmenüs auf eine Nachricht, ordne Inhalte in Blöcken und frage mit einem Formular nach Eingaben. Nur Bots können Komponenten senden.

## Das brauchst du {#you-will-need}

Den Intent `INTERACTIONS`. Jeder Klick kommt als `InteractionCreate` vom Typ `Component`, jedes Formular als `ModalSubmit`. Beide haben dieselben 3 Sekunden wie ein Befehl: siehe [die Zeitlimits](/developers/docs/interactions#time-limits).

## Schaltflächen {#buttons}

Eine Nachricht hat `components`, eine Liste von Blöcken. Eine `ActionRow` hält bis zu fünf Schaltflächen oder ein Auswahlmenü.

@@0

| Feld        | Bedeutung                                                                     |
| ----------- | ----------------------------------------------------------------------------- |
| `style`     | `Primary`, `Secondary`, `Success`, `Danger` oder `Link`                       |
| `label`     | Bis zu 80 Zeichen. Eine Schaltfläche braucht `label` oder `emoji`             |
| `emoji`     | Bis zu 32 Zeichen, keine Leerzeichen                                          |
| `custom_id` | Bis zu 100 Zeichen, geht an deinen Bot zurück, eindeutig in der Nachricht. Nicht mit `Link` |
| `url`       | Nur mit `Link`. Öffnet die Adresse und erzeugt keine Interaktion              |
| `disabled`  | Sichtbar, aber nicht nutzbar                                                  |
| `restrict`  | Wer sie nutzen darf, siehe unten                                              |

Lege in `custom_id`, was du brauchst, etwa `flip:heads` oder `note:3`, und es kommt in `interaction.component.custom_id` zurück. Antworte mit `UpdateMessage`, um die Nachricht zu ändern, oder `Message` für eine neue.

Auch die erste Nachricht eines Threads kann Komponenten tragen; siehe [Kanäle und Webhooks](/developers/docs/channels#threads).

## Wer klicken darf {#restrict}

@@1

Bis zu 25 IDs je Liste. Der Server lehnt Klicks anderer ab, dein Bot sieht sie nie. Nicht für `Link`-Schaltflächen oder Formularfelder.

## Auswahlmenüs {#selects}

| `type`              | Bietet               | Zusatzfelder                 |
| ------------------- | -------------------- | ---------------------------- |
| `StringSelect`      | Deine eigene Liste   | `options`, 1 bis 25          |
| `UserSelect`        | Mitglieder           | `default_values`             |
| `RoleSelect`        | Rollen               | `default_values`             |
| `MentionableSelect` | Mitglieder und Rollen | `default_values`            |
| `ChannelSelect`     | Kanäle               | `default_values`, `channel_types` |

Alle nehmen `custom_id`, `placeholder` (bis 150), `min_values` und `max_values` (0 bis 25, Standard 1), `disabled` und `restrict`.

Ein Eintrag von `options` hat `label` und `value` (je bis 100, eine Zeile) und kann `description`, `emoji` und `default` haben. Werte sind eindeutig.

@@2

Die Wahl kommt in `interaction.component.values`. Benutzer, Rollen und Kanäle kommen auch als Objekte in `interaction.component.resolved`.

## Layoutblöcke {#blocks}

| `type`      | Felder                                                     | Zeigt                                  |
| ----------- | ---------------------------------------------------------- | -------------------------------------- |
| `ActionRow` | `components`                                               | Schaltflächen oder ein Auswahlmenü     |
| `Text`      | `content`                                                  | Markdown-Text                          |
| `Section`   | `text` (1 bis 3), `button` oder `thumbnail`                | Absätze mit etwas am Ende              |
| `Gallery`   | `items` (1 bis 10)                                         | Bilder in einem Raster                 |
| `File`      | `attachment`, `spoiler`                                    | Eine Datei dieser Nachricht, an Ort und Stelle |
| `Separator` | `divider`, `spacing` (`Small`, `Large`)                    | Einen Abstand                          |
| `Container` | `components`, `accent` (`#RRGGBB`), `spoiler`              | Eine Karte um andere Blöcke            |

Ein Bild hat entweder `url` oder `attachment` (die ID einer Datei derselben Nachricht) und kann `description` und `spoiler` haben. Container verschachteln sich nicht.

## Limits einer Nachricht {#limits}

| Was                                                 | Limit |
| --------------------------------------------------- | ----- |
| Zeilen auf oberster Ebene und in einem Container    | 5     |
| Blöcke und Komponenten zusammen, verschachtelte inklusive | 40 |
| Schaltflächen in einer Zeile                        | 5     |
| Aller Text von `Text`- und `Section`-Blöcken zusammen | 4000 |

Apps überspringen Blöcke, die sie nicht kennen. Webhooks ohne Bot können nur Blöcke posten, die niemand benutzen kann: Text, Bilder, Link-Schaltflächen.

## Formulare {#forms}

Ein Formular (Modal) öffnet sich als Antwort auf einen Befehl oder Klick auf dem Bildschirm der Person. Es kann keine Antwort auf ein anderes Formular oder eine Autovervollständigung sein.

@@3

`title` hat bis zu 45 Zeichen. Ein Formular hat bis zu 5 Felder und bis zu 10 Blöcke mit `Text`. Ein `Field` hat `label`, `description` (bis 100) und eine `component`:

| `component.type` | Felder                                                              | Wert kommt in    |
| ---------------- | ------------------------------------------------------------------- | ---------------- |
| `TextInput`      | `style` (`Short`, `Paragraph`), `placeholder`, `required`, `min_length`, `max_length` (bis 4000), `value` | `value` |
| `RadioGroup`     | `options` (bis 10), `required`                                      | `value`          |
| `CheckboxGroup`  | `options` (bis 10), `min_values`, `max_values`, `required`          | `values`         |
| `Checkbox`       | `default`                                                           | `checked`        |
| `FileUpload`     | `min_values`, `max_values` (bis 10), `file_types`, `required`       | `values`, Datei-IDs |
| Ein Auswahlmenü  | wie oben                                                            | `values`         |

`required` ist `true`, außer du sagst etwas anderes. `file_types` listet `image`, `video`, `audio` oder eine Endung wie `.pdf`.

Sendet die Person das Formular, bekommst du eine Interaktion vom Typ `ModalSubmit`:

@@4

Antworte innerhalb von 3 Sekunden. `UpdateMessage` geht nur, wenn das Formular von einer Schaltfläche geöffnet wurde.

Eine Person kann ein Formular schließen, ohne dass dein Bot davon erfährt, warte also nicht darauf.

## Häufige Fehler {#errors}

| Fehler             | Ursache                                  | Lösung                                 |
| ------------------ | ---------------------------------------- | -------------------------------------- |
| `FailedValidation` | Ein Limit oder eine Regel; `error` sagt, welche | Korrigiere die Komponenten      |
| `InvalidOperation` | `Modal` als Antwort auf ein Formular     | Antworte mit `Message`                 |
| `IsBot`            | Ein Bot wollte klicken                   | Nur Menschen nutzen Komponenten        |

## Weiter {#next}

- [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot)
- [Spiele mit Schaltflächen](/developers/docs/tutorial-games)
