# Authentifizierung

Welches Token wohin gehört. Wie du eins erzeugst, steht unter [Anwendungen und Tokens](/developers/docs/applications). Wie du es schützt, unter [Tokens schützen](/developers/docs/security).

## Bot-Tokens {#bot-tokens}

Jede Anwendung hat ein Bot-Token. Sende es bei jeder REST-Anfrage im Header `x-bot-token`:

@@0

Das Gateway nimmt dasselbe Token, entweder in der ersten Nachricht (`Authenticate`) oder als `?token=` in der Adresse. Siehe [Gateway](/developers/docs/gateway).

> Das Token ist ein Passwort. Bewahre es in einer Umgebungsvariable oder einem Secret-Speicher auf, nie im Code, in Logs oder auf Screenshots. Es wird einmal gezeigt, wenn es entsteht. Zurücksetzen kannst du es im Entwicklerportal: deine Anwendung → **Übersicht** → **Token zurücksetzen**. Danach funktioniert das alte Token sofort nicht mehr.

## Welcher Header was tut {#which-header-does-what}

| Header            | Wer ihn nutzt           | Akzeptiert auf                                                                                                   |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `x-bot-token`     | Bots                    | Jedem Endpunkt, der in dieser Referenz „Bot-Token“ nennt                                                         |
| `x-session-token` | Menschen über die App   | Allem, auch Kontoeinstellungen                                                                                   |
| keiner            | Alle                    | Öffentlichen Endpunkten, Interaktionsantworten (Token im Pfad), Webhook-Ausführung (Token im Pfad)               |

Werden Bot-Token und Sitzungstoken zusammen gesendet, zählt das Bot-Token. Ein fehlendes, falsches oder zu einem gesperrten Bot gehörendes Token bekommt `401` mit dem Fehlertyp `InvalidSession`.

## Interaktions- und Webhook-Tokens {#interaction-and-webhook-tokens}

- **Interaktions-Tokens** kommen mit jedem `InteractionCreate`. Sie gelten 15 Minuten und nur für die Antwort, Änderungen und Folgenachrichten dieser Interaktion. Es braucht keinen Header: Das Token steht im Pfad.
- **Webhook-Tokens** gehören zu einem Webhook und beginnen mit `zrzur_wh_`. Wer die Webhook-URL hat, kann in dessen Kanal posten, also behandle sie wie ein Bot-Token. Sie erscheint einmal; eine verlorene lässt sich nur ersetzen.

## Bots und ihre Eigentümer {#bots-and-their-owners}

Erstellen, Bearbeiten, Token zurücksetzen und Löschen erledigt der **Eigentümer** im Entwicklerportal mit seiner eigenen Anmeldung. Ein Bot-Token kann keine Anwendungen verwalten. Löschen lässt sich nicht rückgängig machen, darum bestätigt der Eigentümer es erneut mit Passwort, Authenticator-Code oder Wiederherstellungscode.

@@1

## OAuth2 {#oauth2}

Die Anmeldung von Menschen auf deiner Website und Installationslinks stehen auf der Seite [OAuth2](/developers/docs/oauth2).
