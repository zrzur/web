# Sprach-Bot

`/join` holt ein Sprach-Ticket und verbindet sich, wenn `@livekit/rtc-node` installiert ist, mit dem Sprachkanal.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, das du noch nicht herunterladen kannst. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

## Der Code {#the-code}

@@1

Starte es mit `node voice.mjs`.

## Probiere es aus {#try-it}

Führe `/join channel:#voice` aus. Der Bot braucht Connect (und Speak, um gehört zu werden).

## Was es zeigt {#what-it-shows}

- `POST /channels/{target}/join_call` liefert die LiveKit-Adresse und ein Token.
- Der Ton selbst läuft über LiveKit; siehe [Sprache](/developers/docs/voice) zum Senden von Ton.
- Unser Live-Test deckt den Ticket-Schritt dieser Datei ab; das Senden von Ton wurde separat mit einem echten LiveKit-Server geprüft.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
