# Fehler

Jeder Fehlertyp, den die API liefern kann, mit Ursache und Lösung.

## Fehlerformat {#format}

Jeder Fehler ist JSON mit `type`, manchmal mit weiteren Feldern:

@@0

Entscheide nach `type`, nie nach dem Text. Typen sind stabil: Sie werden nie umbenannt oder entfernt. Neue können in neueren Servern auftauchen, also behandle einen unbekannten Typ wie einen allgemeinen Fehler.

## Was tun mit einem Fehler {#what-to-do}

| Status       | Bedeutung                | Was zu tun ist                                        |
| ------------ | ------------------------ | ----------------------------------------------------- |
| `400`, `422` | Die Anfrage ist falsch   | Korrigiere sie. Dieselbe Anfrage scheitert wieder     |
| `401`        | Das Token ist falsch     | Stoppe den Bot und prüfe das Token                    |
| `403`        | Der Bot darf das nicht   | Sage es der Person. Nicht wiederholen                 |
| `404`        | Es ist weg               | Vergiss es                                            |
| `409`        | Ein Konflikt             | Hole den aktuellen Stand                              |
| `429`        | Zu viele Anfragen        | Siehe [Ratenlimits](/developers/docs/rate-limits)     |
| `5xx`        | Unsere Seite ist gescheitert | Wiederhole mit wachsender Pause, drei- bis fünfmal |

Fehler des Webservers selbst (kein Token, unbekannte Route, kein JSON im Text) sind ebenfalls JSON. Prüfe den Status, bevor du den Text parst, denn ein Proxy dazwischen kann noch mit HTML antworten.

## Fehler, die ein Bot bekommen kann {#bot-errors}

@@1

## Fehler von Konto-Routen {#account-errors}

Bots sehen diese selten. Sie gehören zu Routen für Menschen, etwa zum Anmelden.

@@2

## OAuth2-Fehler {#oauth2-errors}

`POST /oauth2/token` folgt dem OAuth2-Standard und antwortet mit `error` und `error_description` statt `type`. Siehe [OAuth2](/developers/docs/oauth2).

## Weiter {#next}

- [Ratenlimits](/developers/docs/rate-limits)
- [Betrieb in Produktion](/developers/docs/production)
