# API-Änderungsprotokoll

Was sich an der Bot-API und an diesen Seiten geändert hat, das Neueste zuerst. Die Version ist die, die `GET /` in `zrzur` meldet.

@@0

Jeder Eintrag sagt, ob bestehende Bots sich ändern müssen. Ein Wegfall wird hier mit seinem Datum angekündigt, bevor er passiert. Verfolge es in einem Feedreader: [RSS-Feed](/developers/api-changelog.xml).

## Seit 26.0.0 {#since-26-0-0}

**Läuft auf `api.zrzur.com`, geprüft am 2026-11-14.** `GET /` meldet weiterhin `26.0.0`. Bestehende Bots laufen weiter: Nichts davon entfernt oder ändert ein Feld.

- **Gateway: Fortsetzen.** Jedes Paket nach `Ready` trägt `seq`, pro Sitzung ab 1 gezählt. Sende `Authenticate` mit `"resumable": true`, dann trägt `Ready` eine `session_id`. Nach einem Abbruch bleibt die Sitzung 2 Minuten erhalten, mit höchstens ihren letzten 1000 Ereignissen und 4 MiB davon. Sende auf einem neuen Socket als erste Nachricht `Resume`: Die Ereignisse nach `seq` kommen der Reihe nach, dann `Resumed`. Ist die Sitzung weg, kommt `InvalidSession` mit `"resumable": false`; sende dann `Authenticate` auf demselben Socket und hole per REST auf. `GET /gateway/schema` listet die Close-Codes und die Grenzen des Fortsetzens. Siehe [Gateway](/developers/docs/gateway#resume).
- **Ein Bot liest seine eigenen Einstellungen.** `GET /bots/{bot_id}` mit der eigenen ID und dem eigenen Token des Bots liefert seine `privileged_intents`. Die ID eines anderen Bots antwortet `IsBot`.
- **Klarere Intent-Ablehnungen.** Der Grund beim Schließen mit `4014` nennt, was der Server gelesen hat, etwa `Disallowed intents: MESSAGE_CONTENT (switched on: none)`. Kann der Server die Einstellungen des Bots nicht lesen, sendet er `InternalError` und schließt mit `1013`: Versuche es später erneut, halte nicht an.
- **Threads: eine reichere erste Nachricht.** `POST /channels/{target}/threads` nimmt `embeds` und `components` neben `content`, mit den Regeln des Nachrichtensendens: „Embeds senden“ gilt, und eine Rollenerwähnung ohne „Rollen erwähnen“ wird mit `403 MissingPermission` abgelehnt, und kein Thread bleibt. Siehe [Kanäle](/developers/docs/channels#threads).
- **„Nicht installiert“ antwortet 404.** `GET /channels/{target}` antwortet `404 NotFound` an alle, die nicht im Server des Kanals sind, wie der Server selbst und wie ein Kanal, den es nicht gibt. Mitglieder ohne Zugang bekommen weiterhin `403 MissingPermission`. Siehe [Fehler](/developers/docs/errors#not-installed).
- **Befehle in einer Direktnachricht.** Eine Person kann die globalen Befehle eines Bots, die keine Serverberechtigung brauchen, in ihrer Direktnachricht mit dem Bot nutzen.
- **Befehlsregeln pro Server.** Wer „Server verwalten“ und „Rollen verwalten“ hat, kann die Befehle einer App für Rollen, Mitglieder und Kanäle erlauben oder verbieten: `GET` und `PUT /servers/{server_id}/applications/{application_id}/permissions` sowie `PUT /servers/{server_id}/applications/{application_id}/commands/{command_id}/permissions`.
- **Umfragen, geplante Events, Soundboard und Bühnen.** Neue Routen und Gateway-Ereignisse, aufgelistet in der Referenz von [Nachrichten](/developers/docs/messages#polls), [Server](/developers/docs/servers), [Sprachanrufe](/developers/docs/voice) und in der [Ereignisreferenz](/developers/docs/events). Zwei neue Berechtigungen: `UseSoundboard` und `ManageSoundboard`. Umfragen, Weiterleiten und geplante Events werden pro Installation eingeschaltet (`features` in `GET /`); auf `api.zrzur.com` waren sie aus, als diese Seite geprüft wurde.
- **SDK: Ratenlimits und Fortsetzen.** Das SDK setzt für Bots standardmäßig fort, wartet ein `429` ab und wartet auf das Zurücksetzen, wenn ein Bucket leer ist. Es ist noch nicht auf npm; siehe [SDKs](/developers/docs/sdk).

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
