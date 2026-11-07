# Ratenlimits

Wie viele Anfragen ein Bot senden darf, wie du die Header liest und was nach einem `429` zu tun ist.

## Die drei Limits {#limits}

1. **Buckets.** Jede Route zählt gegen einen Bucket, in einem Fenster von 10 Sekunden. Die Tabelle unten listet sie.
2. **Global.** Ein Bot stellt höchstens 50 Anfragen pro Sekunde über alle Routen.
3. **Abgelehnte Anfragen.** Eine Adresse, die in 10 Minuten 10 000 Antworten `401` oder `403` sammelt, wird für 10 Minuten gesperrt. Das stoppt das Erraten von Tokens; ein gesunder Bot kommt nie in die Nähe.

Bots werden nach ihrer ID gezählt, die Limits sind also von jeder Adresse gleich und ändern sich nicht mit mehr Prozessen.

## Die Header {#headers}

Jede Antwort sagt, wo du stehst. Diese Werte stammen aus einer echten Antwort auf `GET /users/@me`:

@@0

| Header                    | Bedeutung                                                 |
| ------------------------- | --------------------------------------------------------- |
| `X-RateLimit-Limit`       | Erlaubte Anfragen im Fenster                              |
| `X-RateLimit-Remaining`   | Verbleibende Anfragen                                     |
| `X-RateLimit-Reset-After` | Millisekunden, bis das Fenster zurückgesetzt wird         |
| `X-RateLimit-Bucket`      | Eine ID dieses Buckets. Eine Zahl, nicht sein Name        |
| `X-RateLimit-Global`      | `true`, wenn das globale Limit erreicht wurde             |
| `Retry-After`             | Nur bei `429`: Sekunden zum Warten, aufgerundet           |

## Nach einem 429 {#after-429}

Ein Ratenlimit ist ein `429` ohne `type`:

@@1

`retry_after` ist in **Millisekunden**.

- `global: false`: Warte so lange und wiederhole diese Anfrage. Andere dürfen weiterlaufen.
- `global: true`: Der Bot hat seine 50 pro Sekunde erreicht. **Pausiere jede Anfrage**, bis die Zeit um ist, nicht nur diese.

@@2

Ein `429` **mit** `type` ist eine Ablehnung, die du der Person zeigst, nichts zum Abwarten. `InSlowmode` meint den langsamen Modus des Kanals, `RateLimited` das Limit eines Webhooks.

## Buckets {#buckets}

@@3

`/servers` und `/channels` zählen pro Server und pro Kanal. Der Bucket `servers` erlaubt nur 5 Anfragen pro 10 Sekunden pro Server, geteilt von Lesen und Schreiben. Mitgliederlisten (`GET /servers/{target}/members`) haben ihren eigenen Bucket von 15, `member_list`. Ein fleißiger Moderations-Bot erreicht das schnell: Halte Mitglieder in einem Cache, den `Ready` und Mitgliederereignisse füllen, und nutze die Mitgliederdaten aus Interaktionen.

`/interactions/{interaction_id}/{token}/...` hat einen Bucket von 10 pro Interaktion, das ist reichlich.

## Andere Limits {#other}

| Was                         | Limit                                     |
| --------------------------- | ----------------------------------------- |
| Ein Webhook                 | 5 Nachrichten in 2 Sekunden               |
| Alle Webhooks eines Kanals  | 30 Nachrichten pro Minute                 |
| Tippen über HTTP            | 5 pro 10 Sekunden pro Kanal               |
| Interaktionen               | 3 Sekunden zum Antworten, 15 Minuten bis zum Ende |

## Weiter {#next}

- [Fehler](/developers/docs/errors)
- [Betrieb in Produktion](/developers/docs/production)
