# OAuth2

Lass Menschen sich mit ihrem Zrzur-Konto auf deiner Website anmelden. Das Installieren eines Bots nutzt denselben Bildschirm.

## Das brauchst du {#you-will-need}

Eine Anwendung und eine Website oder ein Programm, das eine Weiterleitung empfangen kann.

## Was es kann und was nicht {#scope}

Ein Zugriffstoken liest, wer jemand ist, auf welchen Servern und was die Person dort darf. Es funktioniert nur auf `/oauth2/@me...`. Es handelt nie als die Person auf dem Rest der API.

| Scope                   | Gibt                                      |
| ----------------------- | ----------------------------------------- |
| `identify`              | `GET /oauth2/@me`                         |
| `servers.read`          | `GET /oauth2/@me/servers`                 |
| `applications.commands` | Markiert, dass deine Befehle dazukommen dürfen |
| `bot.install`           | Installiert den Bot auf einem Server, den die Person wählt |

## Schritte {#steps}

1. Öffne deine Anwendung, Tab **OAuth2**. Trage deine **Weiterleitungs-URIs** ein, eine pro Zeile, bis zu 10: `https://`-Adressen oder `http://localhost` beim Entwickeln. Sie müssen exakt passen.
2. Erzeuge ein Client-Geheimnis, wenn dein Programm auf einem Server läuft. Ohne eins ist die App ein öffentlicher Client. Es erscheint einmal.
3. Erzeuge für jede Anmeldung ein zufälliges `state` und einen zufälligen `code_verifier`. Schicke die Person zu:

@@0

Dieser Pfad liegt in der Zrzur-App. Der **Anmeldelink** im Tab OAuth2 baut diese Adresse aus den Scopes, die du anhakst. PKCE (`code_challenge`) ist immer Pflicht, auch mit Client-Geheimnis.

4. Die Person stimmt zu. Der Browser kommt mit `code` und `state` zu deiner Weiterleitungs-URI zurück. Prüfe, dass `state` deins ist.
5. Tausche den Code innerhalb von 10 Minuten ein. Er funktioniert einmal.

@@1

@@2

6. Rufe die API damit auf:

@@3

## Die PKCE-Werte erzeugen {#pkce}

`code_verifier` ist ein zufälliger Text mit 43 bis 128 Zeichen. `code_challenge` ist das SHA-256 dieses Texts, als base64url ohne Auffüllung kodiert. Behalte den Verifier bis Schritt 5 und sende nur die Challenge in der Adresse.

@@4

## Bot-Dashboards: prüfen, wer verwalten darf {#dashboards}

`GET /oauth2/@me/servers` listet jeden Server, auf dem die Person **Mitglied** ist. Mitglied zu sein heißt nicht, dass sie dort die Einstellungen deines Bots ändern darf. Jeder Eintrag sagt, was sie darf:

| Feld         | Bedeutung                                                     |
| ------------ | ------------------------------------------------------------- |
| `owner`      | Ihr gehört der Server                                         |
| `can_manage` | Ihr gehört der Server oder sie hat „Server verwalten“         |
| `permissions`| Ihre serverweiten Berechtigungen als Dezimalzahl in Textform  |

Frage `GET /oauth2/@me/servers?manageable=true` ab, um nur die Server zu bekommen, die sie verwalten kann. Zeige nur diese und prüfe vor jeder Änderung noch einmal mit deinem Bot-Token: `members.canManage(serverId, userId)` in `@zrzur/sdk/bot` (verfügbar ab der nächsten `@zrzur/sdk`-Version; bis dahin lies `GET /servers/{id}` und `GET /servers/{id}/members/{user_id}` und verlange den Besitzer oder „Server verwalten“). Rechte können sich nach der Anmeldung ändern.

Die Bits sind die von Zrzur, nicht die von Discord. „Server verwalten“ ist `1 << 1` (`2`), Administrator `1 << 46`. Code für Discords `0x8` oder `0x20` liest die falschen Bits. Nutze `Permissions` aus dem SDK und `BigInt` auf den Text.

@@5

## Aktualisieren und widerrufen {#refresh}

Zugriffstokens halten 1 Stunde, Aktualisierungstokens 30 Tage. Jedes Aktualisierungstoken geht einmal und kommt neu zurück. Ein altes zu nutzen beendet die ganze Kette, denn das sieht nach Diebstahl aus.

@@6

Beide Routen nehmen ein Formular, kein JSON. Sie stehen nicht im OpenAPI-Dokument. Eine Person kann deine App auch in ihren Einstellungen entziehen.

## Häufige Fehler {#errors}

Diese Routen antworten `{ "error": "...", "error_description": "..." }`.

| `error`                  | Ursache                                                  | Lösung                         |
| ------------------------ | -------------------------------------------------------- | ------------------------------ |
| `invalid_request`        | Ein Feld fehlt, etwa `code_verifier`                     | Sende jedes Feld               |
| `invalid_grant`          | Der Code ist unbekannt, benutzt oder abgelaufen, oder PKCE ist falsch | Beginne die Anmeldung neu |
| `invalid_client`         | Client-ID oder Geheimnis sind falsch (Status `401`)      | Prüfe sie                      |
| `invalid_scope`          | Mehr Scope als bei der ersten Zustimmung                 | Fordere weniger an             |
| `unsupported_grant_type` | Ein anderer Grant-Typ                                    | Nimm die beiden oben           |

## Referenz {#reference}

@@7

## Weiter {#next}

- [Anwendungen und Tokens](/developers/docs/applications)
- [Tokens schützen](/developers/docs/security)
