# API-Änderungsprotokoll

Was sich an der Bot-API und an diesen Seiten geändert hat, das Neueste zuerst. Die Version ist die, die `GET /` in `zrzur` meldet.

@@0

Jeder Eintrag sagt, ob bestehende Bots sich ändern müssen. Ein Wegfall wird hier mit seinem Datum angekündigt, bevor er passiert.

## Kommt in der nächsten Version {#upcoming}

Noch nicht verfügbar. Baue nicht darauf, bis es unter einer Version weiter unten steht.

- **Gateway: Fortsetzen.** Ereignisse bekommen eine Sequenznummer, und ein Bot, der seine Verbindung verloren hat, kann sie fortsetzen und bekommt, was er verpasst hat, statt es per REST zu holen. Die Seite [Gateway](/developers/docs/gateway#resume) wird zeigen, wie.
- **Ein Bot liest seine eigenen Einstellungen.** `GET /bots/{target}` mit der eigenen ID und dem eigenen Token des Bots wird seine `privileged_intents` liefern, damit ein Bot prüfen kann, was sein Eigentümer eingeschaltet hat.
- **Klarere Intent-Ablehnungen.** Das Schließen mit `4014` wird die eingeschalteten Intents nennen. Eine Verbindung, die aus einem anderen Grund scheitert, schließt ohne `4014`, damit ein Bot es erneut versucht, statt anzuhalten.
- **Threads: eine reichere erste Nachricht.** `POST /channels/{target}/threads` wird `embeds` und `components` für die erste Nachricht nehmen, mit denselben Regeln wie beim Senden einer Nachricht.
- **„Nicht installiert“ antwortet 404.** Ein Kanal eines Servers, in dem dein Bot nicht ist, wird `404 NotFound` antworten, wie der Server selbst. Heute antwortet er `403 MissingPermission`.
- **SDK: Ratenlimits.** Das SDK wird ein `429` abwarten und es von selbst erneut versuchen.

Bestehende Bots laufen weiter. Nichts davon entfernt oder ändert ein Feld.

## Dokumentation, 2026-11-09 {#docs-2026-11-09}

Keine Änderung an der API. Diese Seiten sagen jetzt, was ein Bot-Autor durch Ausprobieren herausfinden musste:

- Die Dokumentation öffnet sofort, ohne Anmeldung und ohne auf eine Verbindung zu warten.
- [Ereignisreferenz](/developers/docs/events#channels): die Kanaltypen, und wie man eine Direktnachricht von einer Servernachricht unterscheidet.
- [Gateway](/developers/docs/gateway#intent-off): was zu tun ist, wenn ein privilegierter Intent aus ist, und wann ein Schalter zählt.
- [Ohne Bibliothek](/developers/docs/raw-http): Das Node-Beispiel sendet `intents: 33`, wie der Text und das Python-Beispiel.
- [Kanäle und Webhooks](/developers/docs/channels): einfaches HTTP zuerst, der Body von `POST /servers/{server}/channels` mit `private` und `category`, und die Regeln für die erste Nachricht eines Threads.
- [Slash-Befehle](/developers/docs/commands#attachments): wo die Datei einer `Attachment`-Option ankommt, und warum ihre ID nicht noch einmal gesendet werden kann.
- [Nachrichten](/developers/docs/messages#read-messages): Kanal-Links `<#id>`, die Antwort von `GET /channels/{target}/messages` und ihre Reihenfolge.
- [Übersicht](/developers/docs/overview#base-urls): eine Beispielantwort von `GET /`.
- [Fehler](/developers/docs/errors#not-installed): welche Antwort „der Bot ist nicht auf diesem Server“ bedeutet.
- Die Referenz nennt nur das Bot-SDK, und ihr Status-Abzeichen passt zur Prüfung darunter.

## 26.0.0 (2026-11-08) {#v26-0-0}

Die erste Zrzur-Version. Alles auf diesen Seiten beschreibt sie.

- **Interaktionen:** Slash-Befehle mit Optionen, Auswahlwerten, Unterbefehlen, übersetzten Namen und Autovervollständigung; Menübefehle für Nutzer und Nachrichten; Schaltflächen, Auswahlmenüs und Formulare; private, verzögerte und nachfolgende Antworten. Schaltflächen und Formulare funktionieren auch in einer Direktnachricht mit dem Bot.
- **Interaktionen über HTTP**, signierte Anfragen an deine eigene Adresse.
- **Gateway-Intents** legen fest, was eine Verbindung bekommt. `MESSAGE_CONTENT`, `SERVER_MEMBERS` und `PRESENCE` sind privilegiert und werden im Entwicklerportal eingeschaltet. `GET /gateway/schema` beschreibt jedes Ereignis.
- **Threads und Foren:** `POST` und `GET /channels/{target}/threads`, `PATCH /channels/{target}/thread`, mit den Berechtigungen `CreateThreads`, `CreateForumPosts` und `SendMessageInThreads`.
- **Über REST:** `POST /channels/{target}/typing`, und angeheftete Nachrichten über `POST /channels/{target}/search` mit `pinned: true`.
- **Webhooks:** Tokens erscheinen einmal, beginnen mit `zrzur_wh_` und lassen sich ersetzen.
- **Ratenlimits:** Ein `429`-Body hat `retry_after` in Millisekunden und `global`. Jeder Fehler hat einen festen `type`.
- **OAuth2** mit PKCE.

## Weiter {#next}

- [Status und Abdeckung](/developers/docs/coverage)
- [Fehler](/developers/docs/errors)
