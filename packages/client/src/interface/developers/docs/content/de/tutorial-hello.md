# Hello World

Ein Bot, der auf `/hello` antwortet. Zwei Fassungen: eine mit dem SDK und eine ohne Bibliothek, um das Protokoll zu zeigen.

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

## Mit dem SDK {#with-the-sdk}

Führe `npm install @zrzur/sdk` im Ordner deines Bots aus (Node 22.3 oder neuer) und speichere dann diese Datei dort:

@@1

Starte es mit `node hello.mjs`.

## Ohne Bibliothek {#without-a-library}

Node 22 oder neuer, nichts zu installieren. Das ist derselbe Bot:

@@2

Starte es mit `node hello-raw.mjs`.

## Probiere es aus {#try-it}

Tippe `/hello` in einem Kanal deines Testservers.

## Was es zeigt {#what-it-shows}

- `GET /users/@me` nennt dem Bot seine ID; bei Bots ist die Anwendungs-ID dieselbe.
- `PUT /applications/{application_id}/commands` registriert die Befehlsliste.
- Das Gateway liefert `InteractionCreate`; der Bot antwortet innerhalb von 3 Sekunden über den Interaktions-Callback.
- `Bulk`-Pakete werden ausgepackt, und ein `Ping` hält die Verbindung offen.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
