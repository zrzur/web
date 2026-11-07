# Befehle mit Optionen

Optionen mit Limits, private Antworten, Antworten, die länger als 3 Sekunden dauern, und Vorschläge beim Tippen.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, das du noch nicht herunterladen kannst. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

## Der Code {#the-code}

@@1

Starte es mit `node commands.mjs`.

## Probiere es aus {#try-it}

Probiere `/roll sides:20`, `/secret text:hi`, `/slow` und beginne, `/fruit name:ap` zu tippen.

## Was es zeigt {#what-it-shows}

- Der Server setzt `min_value` und `max_value` durch; der Bot sieht nie ungültige Zahlen.
- Antworten mit `ephemeral: true` sieht nur die fragende Person, und sie werden nie gespeichert.
- `i.defer()` bestätigt sofort; `i.editReply()` beendet die Antwort später.
- Autovervollständigung liefert höchstens 25 Auswahlwerte.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
