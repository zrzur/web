# Ein Bot, viele Server

Einstellungen pro Server: `/prefix` setzt ein Präfix für Textbefehle auf nur einem Server.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, das noch nicht auf npm ist. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

Schalte dann im Entwicklerportal den Intent **Nachrichteninhalt** für den Bot ein: Ohne ihn bekommt der Bot Nachrichten ohne Text, und wenn er angefordert wird, aber aus ist, scheitert die Verbindung. Siehe [Intents](/developers/docs/gateway#intents).

## Der Code {#the-code}

@@1

Starte es mit `node multi-server.mjs`.

## Probiere es aus {#try-it}

Führe `/prefix value:?` auf einem Server aus, sende dann dort `?where` und auf einem anderen Server `!where`.

## Was es zeigt {#what-it-shows}

- `Ready` listet jeden Kanal mit seinem Server; `ChannelCreate` und `ServerCreate` ergänzen neue.
- `ServerDelete` sagt dem Bot, dass er gegangen ist oder entfernt wurde: Lösche die Einstellungen dieses Servers.
- Bewahre Einstellungen in Produktion in einer Datenbank auf; diese Demo hält sie im Speicher.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
