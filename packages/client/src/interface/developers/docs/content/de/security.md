# Tokens schützen

Ein Bot-Token ist ein Passwort. Wer es hat, handelt als dein Bot auf jedem Server, auf dem er ist.

## Die Regeln {#rules}

1. Halte das Token aus deinem Code heraus. Lies es aus einer Umgebungsvariable oder einem Secret-Speicher.
2. Lege es nie in Git, auf einen Screenshot, in einen Chat oder eine Support-Anfrage.
3. Logge es nie. Logge stattdessen die ID des Bots.
4. Nimm `Authenticate` am Gateway, nicht `?token=` in der Adresse: Adressen landen in Logs.
5. Betreibe den Bot mit einem eigenen Token. Nimm zum Testen einen zweiten Bot.

## Aus Git heraushalten {#git}

@@0

`node --env-file` ist in Node 22 eingebaut.

## Wenn ein Token durchsickert {#leak}

1. Öffne deine Anwendung im [Entwicklerportal](/developers), Tab **Übersicht**, und wähle **Token zurücksetzen**.
2. Bestätige deine Identität. Das alte Token stoppt sofort, und offene Verbindungen enden.
3. Lege das neue Token in deinen Secret-Speicher und starte den Bot neu.
4. Lies im Audit-Log des Servers nach, was der Bot getan hat. Aktionen deines Bots zeigen ihn als Handelnden.

Behandle ein Token, das in einem öffentlichen Repository stand, als gestohlen, auch wenn du es eine Minute später entfernt hast.

## Andere Geheimnisse {#others}

| Geheimnis                | Gültig                     | Wenn es durchsickert                                      |
| ------------------------ | -------------------------- | --------------------------------------------------------- |
| Bot-Token                | bis zum Zurücksetzen       | Zurücksetzen                                              |
| Interaktions-Token       | 15 Minuten                 | Gilt nur für eine Interaktion. Halte es aus Logs heraus   |
| Webhook-Adresse          | bis sie ersetzt wird       | `POST /webhooks/{webhook_id}/token` erzeugt eine neue. Beginnt mit `zrzur_wh_` |
| Signier-Geheimnis        | bis es ersetzt wird        | Erzeuge ein neues unter **HTTP-Interaktionen**            |
| OAuth2-Client-Geheimnis  | bis zum Zurücksetzen       | Zurücksetzen im Tab **OAuth2**                            |
| OAuth2-Zugriffstoken     | 1 Stunde                   | `POST /oauth2/revoke`                                     |
| OAuth2-Aktualisierungstoken | 30 Tage                 | `POST /oauth2/revoke`. Erneute Nutzung beendet die ganze Kette |

## Schütze die Menschen, die deinen Bot nutzen {#people}

- Vertraue nichts aus einer Nachricht, einer `custom_id` oder einem Formular, als käme es von dir. Wer eine Schaltfläche sieht, kann senden, was sie sendet.
- Bevor du für eine Person handelst, prüfe `user_permissions_string`. Die Berechtigungen des Bots sind nicht ihre.
- Verhindere Erwähnungen in deiner Ausgabe mit `allowed_mentions` bei Webhooks oder indem du keinen Text wiederholst, den du nicht geschrieben hast.
- Speichere so wenig wie möglich. Lösche die Daten eines Benutzers bei `UserPlatformWipe` und die eines Servers, wenn der Bot geht.
- Fordere nur die Intents und Berechtigungen an, die du nutzt.

## Weiter {#next}

- [Betrieb in Produktion](/developers/docs/production)
- [Authentifizierung](/developers/docs/authentication)
