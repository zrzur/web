# Interaktionen über HTTP

Empfange Befehle, Schaltflächen und Formulare an deiner eigenen HTTPS-Adresse, ohne Gateway-Verbindung.

> **Das ist aus, wo die Servereinstellung `signing_key` leer oder kürzer als 32 Bytes ist.** Ein Geheimnis zu erzeugen oder eine Adresse zu speichern antwortet dann `FeatureDisabled`, und Bots nutzen das Gateway. Auf einem selbst gehosteten Server setzt die Admin `api.interactions.signing_key`.

## Das brauchst du {#you-will-need}

- Node 22 oder neuer und eine öffentliche HTTPS-Adresse.
- Dein Bot-Token (`YOUR_BOT_TOKEN`) und sein Signier-Geheimnis (`YOUR_SIGNING_SECRET`).
- Keine Intents: Interaktionen kommen unabhängig von den Gateway-Intents.

## Schritte {#steps}

1. Öffne deinen Bot im Entwicklerportal und wähle **HTTP-Interaktionen**. Erzeuge ein Signier-Geheimnis und kopiere es. Es erscheint einmal.
2. Starte das Beispiel unten auf deinem Server, mit dem Geheimnis in `ZRZUR_SIGNING_SECRET`.
3. Trage deine Adresse im selben Dialog ein, speichere und bestätige dein Passwort. Zrzur schickt zuerst zwei Testanfragen in beliebiger Reihenfolge: eine mit falscher Signatur, die abgelehnt werden muss, und ein signiertes `Ping`, das `{"type":"Pong"}` bekommen muss. Das SDK erledigt beides.

Ab jetzt bekommt das Gateway die Interaktionen dieses Bots nicht mehr. Entferne die Adresse, um zurückzugehen.

## Vollständiges Beispiel {#full-example}

@@0

## Was du sehen solltest {#what-you-should-see}

`ready as <your bot>` in der Konsole, dann `Hello <name>, over HTTP!` im Kanal, wenn jemand `/hello` nutzt.

## So sieht eine Anfrage aus {#what-a-request-looks-like}

Jede Anfrage ist ein `POST` mit demselben JSON wie `interaction` in `InteractionCreate` und drei Headern:

| Header              | Bedeutung                                                 |
| ------------------- | --------------------------------------------------------- |
| `X-Zrzur-Timestamp` | Sekunden seit der Epoche beim Signieren                   |
| `X-Zrzur-Signature` | `v1=` und das hexadezimale HMAC-SHA256 des signierten Texts |
| `X-Zrzur-Delivery`  | ID dieser Zustellung, für deine Logs. **Nicht signiert**  |

Der signierte Text ist `v1:<timestamp>:<raw body>`. Ohne SDK:

1. Lehne die Anfrage mit `401` ab, wenn der Zeitstempel mehr als 300 Sekunden von deiner Uhr abweicht.
2. Berechne das HMAC-SHA256 des signierten Texts mit deinem Geheimnis und vergleiche in konstanter Zeit (`crypto.timingSafeEqual` in Node, `hmac.compare_digest` in Python). Vergleiche nie mit `==`.
3. Lehne eine `_id` aus dem signierten Text ab, die du in den letzten zehn Minuten behandelt hast: Das ist eine erneut gesendete, abgefangene Anfrage. Nutze dafür nicht `X-Zrzur-Delivery`: Das ist nicht signiert, jeder kann es ändern.
4. Beantworte `{"type":"Ping"}` mit `{"type":"Pong"}`.

Ein abgeschalteter Bot, oder einer mit gesperrtem Eigentümer, bekommt nichts, und seine Adresse lässt sich nicht ändern.

Prüfe an diesem Beispiel. Mit dem Geheimnis `zrzur_sign_f27c5773e21ddeceaeb5e956dc45c16451f737addd5c0e4472f61060bca9b030`, dem Zeitstempel `1700000000` und dem Text `{"type":"Ping"}` ist die Signatur `v1=928e5ffdc88564103b59f5485a6bfa7e1a633dca64f397396606a314f572c4d3`.

## So antwortest du {#how-to-answer}

Antworte innerhalb von 3 Sekunden, auf eine von zwei Arten:

- `202` oder `204` ohne Text, dann `POST /interactions/{id}/{token}/callback` wie beim Gateway. Das SDK tut das.
- `200` mit dem Text, den du an diese Route senden würdest, zum Beispiel `{"type":"Message","data":{"content":"Hello"}}`.

Jeder andere Status, eine Zeitüberschreitung, eine Weiterleitung oder eine Antwort über 1 MiB lässt die Interaktion scheitern, und die Person sieht das. Weiterleitungen werden nicht verfolgt.

## Häufige Fehler {#common-errors}

Eine Adresse zu speichern scheitert mit `SignedDeliveryRejected`, und `reason` sagt, warum:

| `reason`                 | Ursache                                     | Lösung                                    |
| ------------------------ | ------------------------------------------- | ----------------------------------------- |
| `invalid_url`            | Nicht `https`, oder enthält ein Passwort    | Nimm eine einfache `https://`-Adresse     |
| `blocked_address`        | Die Adresse ist privat oder gesperrt        | Nimm eine öffentliche Adresse             |
| `not_reachable`          | Nichts hat geantwortet                      | Prüfe, ob der Server läuft und öffentlich ist |
| `timed_out`              | Keine Antwort in 3 Sekunden                 | Antworte schneller                        |
| `accepts_bad_signatures` | Die Anfrage mit falscher Signatur kam durch | Prüfe Signaturen, antworte `401`          |
| `bad_status`             | Das `Ping` bekam kein `200`                 | Beantworte `Ping` mit `200`               |
| `bad_answer`             | Das `Ping` bekam kein `{"type":"Pong"}`     | Sende genau dieses JSON                   |
| `answer_too_large`       | Die Antwort ist über 1 MiB                  | Sende eine kleinere Antwort               |

`FeatureDisabled` heißt, dieser Server hat keinen Signierschlüssel oder einen unter 32 Bytes. `InvalidOperation` heißt, der Bot hat noch kein Signier-Geheimnis.

## Weiter {#next}

- [Auf Interaktionen antworten](/developers/docs/interactions)
- [Fehler](/developers/docs/errors)
