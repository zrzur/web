# Deployment

Die Form eines Bots, der monatelang läuft: Konfiguration aus der Umgebung, eine Gesundheitsprüfung und ein sauberes Ende.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, führe also zuerst `npm install @zrzur/sdk` im Ordner deines Bots aus. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

## Der Code {#the-code}

@@1

Starte es mit `node deploy.mjs`.

## Probiere es aus {#try-it}

Betreibe ihn unter einem Prozessmanager (systemd, Docker, eine Plattform) und richte die Prüfung auf `http://127.0.0.1:8080/healthz`.

## Was es zeigt {#what-it-shows}

- Der Bot verweigert den Start, wenn eine Variable fehlt (Exit-Code 2).
- `/healthz` antwortet 200, sobald das Gateway verbunden ist, vorher 503.
- Bei SIGTERM schließt er Gesundheitsserver und Gateway und beendet sich.
- Lege das Token in den Secret-Speicher der Plattform; starte den Bot nach dem Zurücksetzen des Tokens neu.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
