# Datei hochladen

`/report` erstellt eine CSV-Datei und postet sie.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, das noch nicht auf npm ist. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

## Der Code {#the-code}

@@1

Starte es mit `node upload.mjs`.

## Probiere es aus {#try-it}

Führe `/report` aus. Der Bot braucht „Dateien hochladen“ in diesem Kanal.

## Was es zeigt {#what-it-shows}

- Dateien gehen zuerst auf den Dateiserver (Tag `attachments`).
- Die Nachricht trägt dann die zurückgegebene ID in `attachments`.
- `bot.messages.send(channel, { files })` macht beide Schritte.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
