# Ereignisse

Reagiere ohne Befehle auf das, was auf einem Server geschieht: Antworte auf `!ping`, logge Reaktionen und Mitglieder, die gehen.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, das du noch nicht herunterladen kannst. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

Schalte dann im Entwicklerportal den Intent **Nachrichteninhalt** für den Bot ein: Ohne ihn bekommt der Bot Nachrichten ohne Text, und wenn er angefordert wird, aber aus ist, scheitert die Verbindung. Siehe [Intents](/developers/docs/gateway#intents).

## Der Code {#the-code}

@@1

Starte es mit `node events.mjs`.

## Probiere es aus {#try-it}

Sende `!ping` in einem Kanal, den der Bot sehen kann.

## Was es zeigt {#what-it-shows}

- `Message` kommt für jede neue Nachricht, die der Bot sieht; überspringe deine eigenen und die anderer Bots.
- `BeginTyping` zeigt den Bot als tippend.
- Das Bearbeiten der Antwort zeigt die Umlaufzeit.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
