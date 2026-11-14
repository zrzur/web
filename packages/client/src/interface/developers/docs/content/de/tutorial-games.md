# Spiele mit Schaltflächen

`/coinflip` postet zwei Schaltflächen, die nur der Spieler drücken kann; die Nachricht ändert sich an Ort und Stelle.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, führe also zuerst `npm install @zrzur/sdk` im Ordner deines Bots aus. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

## Der Code {#the-code}

@@1

Starte es mit `node games.mjs`.

## Probiere es aus {#try-it}

Führe `/coinflip` aus und drücke eine Schaltfläche. Bitte jemand anderen, sie auch zu drücken: Der Server lehnt ab.

## Was es zeigt {#what-it-shows}

- `restrict` beschränkt eine Schaltfläche serverseitig auf bestimmte Benutzer oder Rollen.
- `i.update()` ändert die Nachricht der Schaltfläche; `components: []` entfernt die Schaltflächen.
- Punkte und Spiele müssen kostenlos bleiben: keine Wetten, kein Kauf oder Verkauf von Punkten.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
