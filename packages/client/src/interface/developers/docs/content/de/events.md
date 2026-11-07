# Ereignisreferenz

Jedes Ereignis, das ein Bot bekommen kann, mit seinen Feldern. Die Beispiele stammen von einem laufenden Server; die IDs wurden ersetzt.

Ereignisse kommen als JSON-Objekte mit `type`. Felder, die nicht immer da sind, fehlen, wenn sie leer sind. Einige Ereignisse tragen ein Objekt direkt, `Message` hat also `content` neben `type`.

Andere Ereignisse gibt es für die Zrzur-Apps. Bots bekommen sie nie, darum stehen sie hier nicht. `GET /gateway/schema` enthält sie alle.

@@0

## Typen {#types}

Die Objekte aus den Tabellen oben. Daten sind ISO-8601-Text. IDs sind 26 Zeichen lang. Beschreibungen der Typen kommen aus der API und bleiben auf Englisch.

@@1
