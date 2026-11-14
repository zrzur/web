# Status und Abdeckung

Wie diese Seiten entstehen und geprüft werden, wie viele Endpunkte ein Bot nutzen kann und welche Bots ablehnen.

## So entstehen diese Dokumente {#how-these-docs-are-made}

1. Ein Skript liest den Routencode des Servers, seine Berechtigungsprüfungen, Fehler- und Ratenlimit-Tabellen, Gateway-Ereignisse, beide SDKs und das OpenAPI-Dokument und schreibt das Inventar, aus dem diese Seiten entstehen. Nichts wird von Hand getippt, was der Code sagen kann.
2. Die Genauigkeitstests erstellen auf einem lokalen Zrzur-Server einen Server, Bots und Testmitglieder, rufen dokumentierte Endpunkte mit einem Bot-Token auf, vergleichen die Antworten mit den Schemas und lassen jedes Tutorial als echten Bot laufen.
3. Automatische Prüfungen lassen den Build scheitern, wenn ein Endpunkt keine Doku hat, eine Seite ins Leere verlinkt, ein Beispiel eine nicht vorhandene Route aufruft oder das Inventar veraltet ist.

Jeder Endpunkt zeigt, wie er geprüft wurde:

| Stufe             | Bedeutung                                                              |
| ----------------- | ---------------------------------------------------------------------- |
| Live geprüft      | Mit einem Bot-Token auf einem laufenden Server aufgerufen; Antwort passte zum Schema |
| Lokale Integration | Gegen für den Test gestartete Dienste getestet                        |
| Typgeprüft        | Kompiliert gegen die SDK-Typen; nicht ausgeführt                       |
| Attrappe          | Gegen einen falschen Server ausgeführt                                 |
| Ungetestet        | Nur aus dem Quellcode bekannt                                          |

## Status {#status}

@@0

## Was Bots nicht können {#what-bots-cannot-do}

@@1

Kontoeinstellungen, Sitzungen, Mehrfaktor-Anmeldung, Abrechnung, Entdecken-Einträge, Plugins, die Community-Galerie und Team-Werkzeuge gehören nicht zur Bot-API und stehen hier nicht.
