# Ohne Bibliothek

Alles, was ein Bot tut, ist einfaches HTTPS und WebSocket. Diese Seite zeigt die Aufrufe, damit du einen Bot in jeder Sprache schreiben kannst.

## Das brauchst du {#you-will-need}

Einen HTTP-Client und einen WebSocket-Client. `curl` reicht für die ersten Schritte. `YOUR_BOT_TOKEN` steht für dein Token.

## Eine Anfrage stellen {#request}

@@0

`_id` in der Antwort ist die ID deines Bots und auch seine Anwendungs-ID.

Anfragetexte sind JSON, mit `content-type: application/json`. Antworten sind JSON oder leer mit `204`.

## Eine Nachricht senden {#send}

@@1

## Eine Datei hochladen {#upload}

@@2

Die Antwort ist `{ "id": "FILE_ID" }`. Sende sie in `attachments` einer Nachricht.

## Die ganze Schleife {#loop}

1. `PUT /applications/{application_id}/commands` mit deinen Befehlen.
2. Öffne `wss://events.zrzur.com/?version=1&format=json`.
3. Sende `{ "type": "Authenticate", "token": "YOUR_BOT_TOKEN", "intents": 33 }`.
4. Sende alle 20 Sekunden `{ "type": "Ping", "data": 1 }`.
5. Für jedes Paket: Ist `type` gleich `Bulk`, behandle jeden Eintrag von `v`.
6. Bei `InteractionCreate`, innerhalb von 3 Sekunden, `POST /interactions/{interaction_id}/{token}/callback`.
7. Wenn der Socket schließt, warte und beginne wieder bei Schritt 2.

## Node {#node}

Node 22 hat `fetch` und `WebSocket` eingebaut. Das ist ein vollständiger Bot in einer Datei:

@@3

Der [vollständige Bot](/developers/docs/tutorial-full-bot) ergänzt Ratenlimits, Wiederholungen, Wiederverbindung und gespeicherte Daten.

## Python {#python}

Python braucht das Paket `websockets` (`pip install websockets`). Für HTTP reicht die Standardbibliothek.

@@4

Diese kurze Fassung verbindet nicht neu. Ergänze die Schleife aus [Gateway](/developers/docs/gateway#reconnect).

## Maschinenlesbare Beschreibungen {#schemas}

| Adresse                 | Was                                        |
| ----------------------- | ------------------------------------------ |
| `GET /openapi.json`     | Jede REST-Route als OpenAPI 3              |
| `GET /gateway/schema`   | Jedes Gateway-Ereignis als JSON Schema     |
| `GET /`                 | Adressen und Limits dieses Servers         |

Erzeuge daraus einen Client in deiner Sprache.

## Weiter {#next}

- [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot)
- [Fehler](/developers/docs/errors)
