# Willkommensnachrichten

Begrüßt neue Mitglieder in einem Kanal, den der Server mit `/welcome-here` wählt.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, führe also zuerst `npm install @zrzur/sdk` im Ordner deines Bots aus. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

Schalte dann im Entwicklerportal den Intent **Servermitglieder** für den Bot ein: Ohne ihn sieht der Bot keine Beitritte. Siehe [Intents](/developers/docs/gateway#intents).

## Der Code {#the-code}

@@1

Starte es mit `node welcome.mjs`.

## Probiere es aus {#try-it}

Führe `/welcome-here` in einem Kanal aus (braucht „Server verwalten“) und lade dann jemanden ein.

## Was es zeigt {#what-it-shows}

- `ServerMemberJoin` kommt, wenn jemand einem Server des Bots beitritt.
- Einstellungen hängen an der Server-ID, ein Bot bedient also viele Server.
- Der Verlust der Schreibberechtigung wird leise behandelt.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
