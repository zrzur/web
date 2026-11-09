# API-Änderungsprotokoll

Was sich an der Bot-API und an diesen Seiten geändert hat, das Neueste zuerst. Die Version ist die, die `GET /` in `zrzur` meldet.

@@0

Jeder Eintrag sagt, ob bestehende Bots sich ändern müssen. Ein Wegfall wird hier mit seinem Datum angekündigt, bevor er passiert.

## Kommt in der nächsten Version {#upcoming}

**In der nächsten Version, noch nicht auf app.zrzur.com.** Baue nicht darauf, bis es unter einer Version weiter unten steht.

- **Gateway: Fortsetzen.** Jedes Ereignis trägt `seq`, pro Sitzung ab 1 gezählt. Sende `Authenticate` mit `"resumable": true`, dann trägt `Ready` eine `session_id`. Nach einem Abbruch bleibt die Sitzung 2 Minuten erhalten, mit höchstens ihren letzten 1000 Ereignissen und 4 MiB davon; passt das Verpasste nicht mehr hinein, antwortet `Resume` mit `InvalidSession`. Sende auf einem neuen Socket als erste Nachricht `{ "type": "Resume", "token": "YOUR_BOT_TOKEN", "session_id": "…", "seq": 41 }`: Die Ereignisse nach `seq` kommen der Reihe nach, dann `Resumed`. Ist die Sitzung weg, kommt `InvalidSession` mit `"resumable": false`; sende dann `Authenticate` auf demselben Socket und hole per REST auf. Manche Ereignisse können bei der Wiedergabe fehlen, `seq` kann also Lücken haben. `GET /gateway/schema` wird die Close-Codes und die Grenzen des Fortsetzens auflisten.
- **Ein Bot liest seine eigenen Einstellungen.** `GET /bots/{target}` mit der eigenen ID und dem eigenen Token des Bots liefert seine `privileged_intents`. Die ID eines anderen Bots antwortet weiter `IsBot`.
- **Klarere Intent-Ablehnungen.** Der Grund beim Schließen mit `4014` nennt, was der Server gelesen hat, etwa `Disallowed intents: MESSAGE_CONTENT (switched on: none)`. Kann der Server die Einstellungen des Bots nicht lesen, sendet er `InternalError` und schließt mit `1013`: Versuche es später erneut, halte nicht an.
- **Threads: eine reichere erste Nachricht.** `POST /channels/{target}/threads` nimmt `embeds` und `components` neben `content`, mit den Regeln des Nachrichtensendens: „Embeds senden“ gilt, und eine Rollenerwähnung ohne Mention Roles wird mit `403 MissingPermission` (`permission: MentionRoles`) abgelehnt, und kein Thread entsteht.
- **„Nicht installiert“ antwortet 404.** `GET /channels/{target}` antwortet `404 NotFound` an alle, die nicht im Server des Kanals sind, wie der Server selbst und wie ein Kanal, den es nicht gibt. Mitglieder ohne Zugang bekommen weiterhin `403 MissingPermission`.
- **SDK: Ratenlimits und Fortsetzen.** Das SDK setzt für Bots standardmäßig fort, wartet ein `429` ab und wartet auf das Zurücksetzen, wenn ein Bucket leer ist.

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
