# Server

Ein Bot tritt einem Server bei, wenn ihn jemand mit „Server verwalten“ installiert. Er kann den Server lesen, mit den richtigen Berechtigungen Einstellungen ändern, Emojis verwalten und gehen.

## Was ein Bot nicht kann {#what-a-bot-cannot-do}

- Server erstellen oder per Einladung beitreten (`IsBot`). Admins installieren Bots.
- Server oder Kanäle als gelesen markieren.
- Entdecken, Abrechnung, Feather oder Wings nutzen.

## Servereinstellungen {#server-settings}

`PATCH /servers/{target}` ändert Namen, Beschreibung, Symbol, Banner, Kategorien und Systemnachrichten-Kanäle (braucht „Server verwalten“). Manche Felder (etwa Bestätigungsmarken) ändert nur das Zrzur-Team.

`categories` ersetzt die ganze Liste. Um Titel oder Notiz einer Kategorie zu ändern, ohne die anderen anzufassen, nutze `PATCH /servers/{target}/categories/{category_id}` mit `{ "title": "Help", "description": "Ask here" }` (eine leere `description` entfernt die Notiz; braucht Kanäle verwalten). Ihre Kanäle und Berechtigungen bleiben, wie sie sind. Für Berechtigungen einer Kategorie gibt es eigene Anfragen: `PUT /servers/{target}/categories/{category_id}/permissions/{role_id}` und `.../permissions/default`, mit `{ "permissions": { "allow": 0, "deny": 0 } }`.

## Wenn jemand beitritt {#on-join}

`GET /servers/{target}/on_join` liest, `PUT` ersetzt die Rollen, die jedes neue Mitglied bekommt, und die Willkommensnachricht des Servers. Bis zu fünf Rollen, nur Rollen dieses Servers, die keinem Bot gehören, und keine auf oder über dem eigenen Rang; die Rollen zu ändern braucht Rollen verwalten, die Nachricht Server verwalten.

## AutoMod {#automod}

AutoMod prüft Nachrichten, bevor sie erscheinen. `GET /servers/{target}/automod` liest die Regeln, `PUT` ersetzt sie alle, höchstens 10. Beides braucht Server verwalten.

@@0

| Auslöser (`type`) | Trifft zu auf |
| --- | --- |
| `Keywords` | Wörter und Wendungen in `words`; `*` am Anfang oder Ende trifft einen Teil eines Wortes, `allow` nennt Wörter, die nie zutreffen. Arabische Buchstaben werden ohne Hamza-Formen, Ta marbuta, Alif maqsura, Taschkil und Tatwil verglichen |
| `MentionSpam` | Mehr als `max` verschiedene Erwähnungen in einer Nachricht |
| `LinkSpam` | Links von Mitgliedern, die vor weniger als `new_member_minutes` beigetreten sind, und Links zu Domains außerhalb von `allowed_domains` |
| `RepeatedMessages` | Derselbe Text in `channels` Kanälen innerhalb von `seconds` Sekunden |

`block` hält die Nachricht zurück (das Mitglied sieht den Namen der Regel), `alert_channel` meldet sie den Moderatoren dort, `timeout_minutes` gibt dem Mitglied eine Auszeit. AutoMod liest auch Webhook-Nachrichten und Bearbeitungen. Ein Bot, der selbst moderiert, sieht weiter jede Nachricht, die er lesen darf; AutoMod fügt nur Regeln hinzu, die der Server selbst führt.

## Soundboard {#soundboard}

Die Sounds eines Servers spielen in Sprachanrufen (siehe [Sprachanrufe](/developers/docs/voice#soundboard)). `GET /servers/{target}/soundboard` listet sie und das Limit: 8 Sounds und 8 weitere je Wings-Stufe. Mit Soundboard verwalten kann ein Bot:

- einen hochgeladenen Sound hinzufügen: die Datei mit dem Tag `sounds` hochladen, dann `PUT /servers/{target}/soundboard/{sound_id}` mit der Upload-ID als `sound_id` und einem Körper aus `name`, der Länge `duration_ms` und wahlweise `emoji` und `volume`;
- einen fertigen aus der Bibliothek hinzufügen (`GET /soundboard/library`): `PUT /servers/{target}/soundboard/library/{library_id}`; jeder Bibliotheks-Sound ist einmal auf einem Server;
- ihn mit `PATCH` umbenennen, Emoji oder Lautstärke ändern und mit `DELETE` entfernen (seine Datei geht mit).

`GET /soundboard/library/{id}/audio?v=<version>` ist die Datei eines Bibliotheks-Sounds; mit der Version aus der Liste wird sie für immer zwischengespeichert. Das Gateway sendet `SoundboardSoundCreate`, `SoundboardSoundUpdate` und `SoundboardSoundDelete`.

## Geplante Veranstaltungen {#events}

Bots dürfen die Veranstaltungen eines Servers planen und leiten wie Personen mit Veranstaltungen verwalten. `GET /servers/{target}/events` listet die geplanten und laufenden, die der Bot sehen darf, die nächsten zuerst; `POST` plant eine oder speichert mit `draft: true` einen Entwurf. Die weiteren Anfragen unter `/servers/{target}/events/{event}` bearbeiten, starten, beenden, sagen ab oder löschen eine Veranstaltung, listen, wer geantwortet hat, und verwalten ihren Teilen-Link und ihre Einladungslinks. Das Gateway sendet `ServerEventCreate`, `ServerEventUpdate`, `ServerEventDelete` und `ServerEventInterest`. Nur eine Einladung zu einer Veranstaltung annehmen (`POST /invites/event/{code}`) ist Personen vorbehalten: ein Bot bekommt `IsBot`.

## Server-Werkzeuge {#tools}

| Anfrage | Was sie tut | Braucht |
| --- | --- | --- |
| `GET /servers/{target}/insights?days=30` | Beitritte, Austritte, Mitglieder, Nachrichten, aktive Mitglieder und Sprachminuten pro Tag für 7, 30 oder 90 Tage, woher Beitritte kamen und die aktivsten Kanäle. Werte von 1 bis 4 kommen als `null` | Server verwalten |
| `PUT /servers/{target}/safety/pause` | Jede Einladung und jeden Discover-Beitritt ablehnen und/oder DMs zwischen Mitgliedern, die keine Freunde sind, stoppen, für 1, 6, 12 oder 24 Stunden; `0` beendet die Pause | Server verwalten |
| `PUT /servers/{server_id}/vanity` | Den eigenen Einladungslink des Servers (`zrzur.cc/<code>`) belegen oder ändern; `DELETE` gibt ihn frei. `VanityTaken`, wenn ein anderer Server ihn hat | Server verwalten und die Wings-Stufe, die ihn freischaltet |

## Emojis {#emojis}

Lade das Bild mit dem Tag `emojis` auf den Dateiserver (standardmäßig bis 500 KB) und erstelle das Emoji dann mit der zurückgegebenen ID:

@@1

Braucht „Anpassungen verwalten“. Namen nutzen `a-z`, `0-9` und `_`.

## Installierte Anwendungen {#installed-applications}

`GET /servers/{server_id}/applications` listet die installierten Bots eines Servers, `GET /servers/{server_id}/commands` die Befehle, die Mitglieder dort nutzen können.

## Verlassen {#leaving}

`DELETE /servers/{target}` lässt den Bot gehen. Mitglieder sehen `ServerMemberLeave`; der Bot bekommt `ServerDelete` für diesen Server.

## Referenz {#reference}

@@2
