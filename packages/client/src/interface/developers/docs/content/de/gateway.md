# Gateway

Das Gateway ist ein WebSocket, der Ereignisse an deinen Bot schickt. Halte pro Bot-Prozess eine Verbindung offen.

## Das brauchst du {#you-will-need}

Node 22 oder neuer hat `WebSocket` eingebaut. Jeder WebSocket-Client geht. Du brauchst dein Bot-Token (`YOUR_BOT_TOKEN`).

## Verbinden {#connect}

@@0

| Query-Parameter | Werte                                                             | Standard   |
| --------------- | ----------------------------------------------------------------- | ---------- |
| `version`       | `1`                                                               | `1`        |
| `format`        | `json`, `msgpack`                                                 | `json`     |
| `token`         | dein Bot-Token, statt `Authenticate`                              | keiner     |
| `intents`       | die Summe deiner Intents, statt des Felds in `Authenticate`       | siehe unten |
| `ready`         | Felder für `Ready`, z. B. `ready=servers&ready=channels`          | alles      |

Mit `format=msgpack` senden beide Seiten binäre Frames.

Nimm lieber `Authenticate` als `?token=`: Adressen landen in Logs. Sende es innerhalb von 15 Sekunden:

@@1

Der Server antwortet in dieser Reihenfolge:

1. `Authenticated`: Das Token ist gut.
2. `Ready`: deine Startdaten. Erst danach fließen Ereignisse.

Alles, was du sonst sendest, ist auf 1 MiB pro Nachricht begrenzt.

## Wenn das Gateway dich abweist {#refused}

| Was du bekommst                                                      | Ursache                                     | Was zu tun ist                           |
| -------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| `{ "type": "Error", "data": { "type": "InvalidSession" } }`, schließt | Falsches oder zurückgesetztes Token, gesperrter Bot, oder kein `Authenticate` in 15 Sekunden | Stoppe. Verbinde nicht in einer Schleife neu |
| `{ "type": "Error", "data": { "type": "MissingIntent", "intent": "SERVER_MEMBERS" } }`, schließt mit Code `4014` | Ein privilegierter Intent ist aus | Schalte ihn im Entwicklerportal ein und verbinde dich neu, oder [verbinde dich ohne ihn](/developers/docs/gateway#intent-off) |

## Verbunden bleiben {#stay-connected}

Sende alle 20 Sekunden ein `Ping`:

@@2

Der Server antwortet `Pong` mit denselben `data`. `data` ist eine Zahl oder eine Liste von Bytes.

Das Zrzur-Gateway selbst schließt eine stille Bot-Verbindung nie, aber Proxys und Heimrouter tun es, und eine tote Leitung meldet sich nicht. Der Ping ist also, wie **du** es merkst: Kam 60 Sekunden kein `Pong`, schließe den Socket und verbinde neu.

## Neu verbinden {#reconnect}

Eine Verbindung kann jederzeit enden: ein Update bei uns, ein Netzproblem, dein Laptop schläft ein. Plane dafür.

1. Wenn der Socket schließt, warte 1 Sekunde und verdopple die Wartezeit nach jedem Fehlschlag bis 30 Sekunden. Füge etwas Zufall hinzu, damit nicht viele Bots gleichzeitig zurückkommen.
2. Verbinde dich und sende wieder `Authenticate`. Du bekommst ein neues `Ready`.
3. Setze die Wartezeit nach `Ready` zurück.
4. Wiederhole nicht bei `InvalidSession` oder Code `4014`: Dieselbe Anfrage scheitert wieder. Stoppe und sage einem Menschen Bescheid.

## Fortsetzen wird nicht unterstützt {#resume}

Es gibt noch kein Fortsetzen und keine Sequenznummern; beides ist für die nächste Version geplant (siehe [Änderungsprotokoll](/developers/docs/changelog)). Ereignisse während deiner Abwesenheit sind weg. Hole nach jedem `Ready` per REST, was dein Bot nicht verpassen darf, etwa die neuesten Nachrichten eines Kanals (`GET /channels/{target}/messages` mit `after` und `sort=Oldest`, siehe [Nachrichten](/developers/docs/messages#read-messages)). Ein Befehl während deiner Abwesenheit scheitert für die Person, und sie kann es erneut versuchen.

## Sharding wird nicht unterstützt {#sharding}

Eine Verbindung empfängt alles, was deine Intents abdecken. Server lassen sich nicht auf Verbindungen verteilen. Einen zu groß gewordenen Bot-Prozess kannst du noch nicht teilen; halte die Arbeit pro Ereignis klein und lagere langsame Arbeit in eine Warteschlange aus. Siehe [Betrieb in Produktion](/developers/docs/production).

Zwei Verbindungen mit demselben Token funktionieren, und beide empfangen alles. Ein `InteractionCreate` erreicht dann beide, also betreibe zwei nur während eines Neustarts.

## Bulk-Pakete {#bulk}

Mehrere Ereignisse können in einem Paket kommen:

@@3

Packe `Bulk` immer aus und behandle jedes Ereignis. Ein Bot, der es ignoriert, verpasst Ereignisse, auch Befehle.

## Was du senden kannst {#client-messages}

@@4

## Intents {#intents}

Intents legen fest, was eine Verbindung empfängt. Das Gateway wendet sie an, also bekommt ein Bot nie, was er nicht angefordert hat. Addiere die Zahlen der gewünschten und sende die Summe. Ohne `intents` bekommt der Bot alle freien Intents, `63`.

| Intent            | Wert   | Empfängt                                                                 |
| ----------------- | ------ | ------------------------------------------------------------------------ |
| `SERVERS`         | `1`    | Server-, Kanal-, Rollen-, Emoji- und Webhook-Ereignisse; Server und ihre Kanäle in `Ready`. Direktnachrichten und Gruppen kommen so oder so, in `Ready` und als `ChannelCreate` |
| `SERVER_MESSAGES` | `2`    | Nachrichten und Tippen in Serverkanälen                                  |
| `DIRECT_MESSAGES` | `4`    | Nachrichten und Tippen in Direktnachrichten und Gruppen                  |
| `REACTIONS`       | `8`    | Reaktionen, die hinzukommen oder wegfallen                               |
| `VOICE_STATES`    | `16`   | Beitritte und Austritte in Sprachkanälen, Anrufe, Sprachstatus in `Ready` |
| `INTERACTIONS`    | `32`   | `InteractionCreate`                                                      |
| `MESSAGE_CONTENT` | `1024` | Privilegiert. Text, Embeds, Dateien und Komponenten von Nachrichten      |
| `SERVER_MEMBERS`  | `2048` | Privilegiert. Beitritte, Austritte und Änderungen von Mitgliedern; die Mitgliederliste |
| `PRESENCE`        | `4096` | Privilegiert. Wer online ist, und der Status                             |

Ein Bot, der nur auf Befehle antwortet, braucht `SERVERS + INTERACTIONS = 33`. Ohne `INTERACTIONS` hört dein Bot keine Befehle.

Privilegierte Intents werden im Entwicklerportal für den Bot eingeschaltet. Fordert er einen an, der aus ist, schließt die Verbindung mit Code `4014`. Über 100 Servern bleiben nur die privilegierten Intents an, die Zrzur genehmigt hat: Die anderen fallen weg, ohne dass die Verbindung schließt, und die REST-Regeln unten gelten.

Dieselben Regeln gelten über REST:

- Ohne `MESSAGE_CONTENT` hat eine Nachricht weder Text noch Embeds, Dateien oder Komponenten, außer der Bot hat sie geschrieben, wird erwähnt, oder es ist eine Direktnachricht mit ihm.
- Ohne `SERVER_MEMBERS` antworten Mitgliederliste und -suche `MissingIntent`. Ein einzelnes Mitglied (`GET /servers/{target}/members/{member}`) geht weiterhin.
- Ohne `PRESENCE` erscheint jeder Benutzer offline und ohne Status. Sich selbst sieht der Bot weiterhin.

Eine Änderung der Intents gilt ab der nächsten Verbindung.

## Wenn ein privilegierter Intent aus ist {#intent-off}

Ein Schalter im Entwicklerportal ist gespeichert, sobald du ihn umlegst, und das Portal bestätigt es. Das Gateway liest die Schalter, wenn eine Verbindung beginnt; eine offene Verbindung behält also die Intents, mit denen sie begann: Schließe den Socket und verbinde dich neu. Das Token bleibt dasselbe. REST liest sie bei jeder Anfrage, REST-Antworten folgen einem Schalter also sofort.

`MissingIntent` nennt die Intents, die aus sind. Kommt dein Bot ohne einen aus, verbinde dich ohne ihn neu, statt anzuhalten:

@@5

Ohne `MESSAGE_CONTENT` liest dein Bot weiterhin Nachrichten, die ihn erwähnen, seine eigenen Nachrichten und Direktnachrichten mit ihm. Ergänze für jedes andere Schließen die Schleife aus [Neu verbinden](/developers/docs/gateway#reconnect).

## Maschinenlesbares Schema {#schema}

`GET /gateway/schema` auf der API liefert jedes Ereignis (`server`) und alles, was ein Client senden kann (`client`), als JSON Schema, zusammen mit den Intents. Es entsteht aus den Typen, die das Gateway nutzt.

## Vollständiges Beispiel {#full-example}

Der [vollständige Bot](/developers/docs/tutorial-full-bot) hat all das: Intents, Ping, Überwachung, `Bulk`, wachsende Wartezeit und die zwei Fälle, in denen er stoppt.

## Weiter {#next}

- [Ereignisreferenz](/developers/docs/events)
- [Slash-Befehle](/developers/docs/commands)
