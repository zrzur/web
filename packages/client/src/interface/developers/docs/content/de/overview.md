# Zrzur-Bot-API

Ein Bot ist ein Zrzur-Konto, das ein Programm steuert. Er ist wie ein Mitglied auf Servern, liest und sendet Nachrichten, antwortet auf Slash-Befehle, zeigt Schaltflächen und Formulare, moderiert, postet Dateien und kann Sprachkanälen beitreten. Menschen installieren ihn; dein Code läuft auf deinem eigenen Rechner oder Server.

Beginne mit [Starte deinen Bot](/developers/docs/getting-started) und baue dann den [vollständigen Bot](/developers/docs/tutorial-full-bot).

## So funktioniert ein Bot {#how-a-bot-works}

1. Du erstellst im Entwicklerportal eine **Anwendung**. Sie bringt einen Bot-Benutzer und ein **Token** mit, das Passwort des Bots.
2. Jemand mit „Server verwalten“ **installiert** den Bot auf einem Server und gibt ihm Berechtigungen.
3. Dein Programm ruft die **REST-API** über HTTPS auf, mit dem Token im Header `x-bot-token`. So handelt ein Bot.
4. Dein Programm hält eine **Gateway**-Verbindung offen, einen WebSocket. So hört ein Bot: Befehle, Klicks, Nachrichten und Mitgliederänderungen kommen dort als Ereignisse an.

## Der Weg vom Nichts zum fertigen Bot {#the-path}

1. [Starte deinen Bot](/developers/docs/getting-started): eine Anwendung, ein Token, ein erster Befehl.
2. [Anwendungen und Tokens](/developers/docs/applications): jede Einstellung des Entwicklerportals und wie du einen Bot installierst.
3. [Gateway](/developers/docs/gateway): verbinden, verbunden bleiben, nach einem Abbruch zurückkommen.
4. [Slash-Befehle](/developers/docs/commands), [Auf Interaktionen antworten](/developers/docs/interactions) und [Schaltflächen, Menüs und Formulare](/developers/docs/components).
5. [Nachrichten](/developers/docs/messages), [Rollen und Berechtigungen](/developers/docs/roles), [Moderation](/developers/docs/moderation).
6. [Fehler](/developers/docs/errors), [Ratenlimits](/developers/docs/rate-limits), [Tokens schützen](/developers/docs/security), [Betrieb in Produktion](/developers/docs/production).

## Alles, was du brauchst {#resources}

| Was              | Wofür                                                                                        | Wo                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entwicklerportal | Die Anwendung erstellen, das Token holen, den Bot installieren                               | [Meine Anwendungen](/developers)                                                                                                                         |
| `@zrzur/sdk`     | Bots in JavaScript oder TypeScript: Befehle, Schaltflächen, das Gateway                      | `npm install @zrzur/sdk` · [npm](https://www.npmjs.com/package/@zrzur/sdk) · [Quellcode](https://github.com/zrzur/sdk-js) · [SDKs](/developers/docs/sdk) |
| Bot-API-Dokument | Jede Route, die ein Bot nutzen kann, als OpenAPI 3.0: einen Client in jeder Sprache erzeugen | [bot-api.openapi.json](/developers/bot-api.openapi.json) · [Andere Sprachen](/developers/docs/sdk#other-languages)                                       |
| Gateway-Schema   | Jedes Event und was ein Bot senden kann, als JSON Schema                                     | `GET /gateway/schema` · [Event-Referenz](/developers/docs/events)                                                                                        |
| Ganze API        | Jede Route, auch die der App selbst                                                          | `GET /openapi.json`                                                                                                                                      |
| Änderungen       | Was sich geändert hat und was kommt, mit Datum                                               | [API-Änderungsprotokoll](/developers/docs/changelog) · [RSS-Feed](/developers/api-changelog.xml)                                                         |
| Stand            | Was Bots schon nutzen können und was noch nicht                                              | [Stand und Abdeckung](/developers/docs/coverage)                                                                                                         |

## Basis-URLs {#base-urls}

| Dienst              | URL                      |
| ------------------- | ------------------------ |
| REST-API            | `https://api.zrzur.com`  |
| Gateway (WebSocket) | `wss://events.zrzur.com` |
| Dateien             | `https://cdn.zrzur.com`  |
| Sprache (LiveKit)   | `wss://voice.zrzur.com`  |

Selbst gehostete Server haben eigene Adressen. `GET /` auf der API liefert sie, zusammen mit den Limits dieses Servers. Lies diese Felder (die Antwort hat mehr; diese ist gekürzt):

@@0

| Feld                                                                                   | Was es ist                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `zrzur`                                                                                | Version des Servers; siehe [API-Änderungsprotokoll](/developers/docs/changelog)                                                                                                                                    |
| `ws`                                                                                   | Gateway-Adresse                                                                                                                                                                                                    |
| `features.autumn.url`                                                                  | Dateiserver: Hoch- und Herunterladen                                                                                                                                                                               |
| `features.january.url`                                                                 | Medien-Proxy für Linkvorschauen                                                                                                                                                                                    |
| `features.livekit.nodes[].public_url`                                                  | Sprachserver                                                                                                                                                                                                       |
| `features.limits.default`                                                              | Limits eines Kontos, etwa die Nachrichtenlänge                                                                                                                                                                     |
| `features.webhooks`, `features.forwarding`, `features.polls`, `features.server_events` | Ob diese Installation Webhooks, das Weiterleiten von Nachrichten, Umfragen und geplante Events eingeschaltet hat. Wo eins `false` ist, antworten seine Routen `FeatureDisabled` (Webhook-Adressen: `404 NotFound`) |
| `app`                                                                                  | Web-App, für Links, die du Menschen zeigst                                                                                                                                                                         |

@@1

## Was nicht unterstützt wird {#not-supported}

- **Sharding.** Ein Bot hält eine Verbindung oder mehrere, die jeweils alles empfangen. Ereignisse lassen sich nicht auf Prozesse verteilen.
- **Slash-Befehle in Gruppen und Serverbefehle in Direktnachrichten.** In einer Direktnachricht mit dem Bot kann eine Person die globalen Befehle des Bots nutzen, die keine Serverberechtigung brauchen. Schaltflächen, Auswahlmenüs und Formulare funktionieren dort auch.
- **Webhooks, Umfragen, Weiterleiten und geplante Events**, wo die Installation sie ausgeschaltet hat. `GET /` sagt, was an ist; siehe [Basis-URLs](/developers/docs/overview#base-urls).
- **Interaktionen über HTTP** auf einem Server, dessen Einstellung `signing_key` leer ist. Dort antworten die Routen `FeatureDisabled`, und Bots nutzen das Gateway.
- **Bots, die Bots oder Server erstellen, per Einladung beitreten oder Freunde haben.** Das tun Menschen. Die [Abdeckungsseite](/developers/docs/coverage) listet jeden Endpunkt, der Bots ablehnt.

## Was jeder Status bedeutet {#status}

Jeder Endpunkt in dieser Referenz zeigt eine dieser Markierungen.

@@2
