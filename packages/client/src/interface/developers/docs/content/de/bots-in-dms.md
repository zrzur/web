# Bots in Direktnachrichten

Lass Menschen direkt mit deinem Bot schreiben: Sie öffnen seine Unterhaltung über sein Profil, Discover oder einen Link, drücken Starten, und dein Bot antwortet.

> Diese Anleitung nutzt `@zrzur/sdk/bot`. Führe zuerst `npm install @zrzur/sdk` im Ordner deines Bots aus. Siehe [SDKs](/developers/docs/sdk).

## Das brauchst du {#you-will-need}

- Node 22 oder neuer und ein Bot-Token (`YOUR_BOT_TOKEN` unten).
- Den Bot im Developer Portal auf **Öffentlich** gestellt. Dann kann ihm jeder schreiben, auch ohne gemeinsamen Server. Einen privaten Bot erreichen nur Menschen, die einen Server mit ihm teilen.
- Den Intent `INTERACTIONS`, der standardmäßig an ist.

@@0

Unter Windows, in PowerShell:

@@1

## So beginnt eine Unterhaltung {#how-it-starts}

1. Die Person öffnet die Unterhaltung: **Nachricht** im Profil des Bots oder auf seiner Discover-Seite, oder ein Bot-Link.
2. Solange die Unterhaltung leer ist, zeigt Zrzur den Namen des Bots, seine Beschreibung, bis zu fünf seiner globalen Befehle und eine Schaltfläche **Starten**.
3. Starten schickt deinem Bot eine Interaktion vom Typ `Start`. Ab dann darf dein Bot der Person schreiben. Eine Nachricht an deinen Bot wirkt genauso.

Erst dann erfährt dein Bot von der Unterhaltung: Sein `ChannelCreate` kommt mit dem Start oder der ersten Nachricht, nicht schon, wenn die Person die Unterhaltung öffnet. Bis dahin kann dein Bot der Person nicht schreiben: `POST /channels/{id}/messages` antwortet mit `403`. Wer einen Server mit deinem Bot teilt, folgt wie bisher seiner eigenen Privatsphäre-Einstellung.

## Bot-Links {#bot-links}

Ein Bot-Link öffnet die Unterhaltung, Starten wartet schon. Hänge `start` an, um deinem Bot einen kurzen Wert mitzugeben, zum Beispiel woher die Person kommt:

@@2

| Teil          | Regel                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `YOUR_BOT_ID` | Die ID des Bots, wie in seinem Einladungslink                          |
| `start`       | 1 bis 64 Zeichen aus `A-Z`, `a-z`, `0-9`, `_` und `-`. Optional: `?start` allein öffnet die Unterhaltung ohne Wert. Alles andere wird verworfen, die Unterhaltung öffnet sich trotzdem. |

Der Wert kommt einmal an, wenn die Person Starten drückt.

## Die Start-Interaktion {#start-interaction}

`InteractionCreate` mit `type: "Start"`, in der Direktnachricht der Person mit deinem Bot (ohne `server_id`). `start.payload` ist der Wert des Links und fehlt, wenn es keinen gab.

@@3

Beantworte sie wie jede Interaktion innerhalb von 3 Sekunden: mit einer Nachricht, einer verzögerten Nachricht oder einem Formular. Siehe [Interaktionen](/developers/docs/interactions#time-limits). `bot.on("start", …)` gibt dir die Interaktion, `interaction.startPayload` den Wert (oder `null`).

## Der Code {#the-code}

@@4

Starte ihn mit `node dm-start.mjs`.

## Das solltest du sehen {#what-you-should-see}

Öffne `https://zrzur.cc/b/YOUR_BOT_ID?start=spring-sale` und drücke **Starten**. Der Bot antwortet `Welcome! You came from the link "spring-sale".` mit einer Schaltfläche **Show tips**. Ein Druck darauf zeigt den Tipp. Sein Befehl `/help` steht auf dem Startbildschirm und unter **Befehle** im Nachrichtenfeld.

## Stoppen und blockieren {#stop-and-block}

Die Person kann im Menü der Unterhaltung **Bot stoppen** wählen. Das blockiert deinen Bot: Deine Nachrichten und Antworten dort werden mit `403` abgelehnt, und neue Interaktionen von ihr kommen nicht mehr an. Nach **Bot neu starten** drückt sie wieder Starten, und du bekommst eine neue `Start`-Interaktion. Was sie vor dem Stoppen geschrieben hat, zählt danach nicht mehr: Bis zu einem neuen Start oder einer neuen Nachricht kann dein Bot ihr nicht schreiben.

## Häufige Fehler {#common-errors}

| Fehler                     | Ursache                                                          | Lösung                                           |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| `DirectMessagesRestricted` | Der Bot ist privat und teilt keinen Server mit der Person        | Mach den Bot öffentlich oder teile einen Server  |
| `403` beim Senden          | Die Person hat noch nicht Starten gedrückt oder geschrieben, oder den Bot gestoppt | Warte auf `Start` oder ihre erste Nachricht |
| `FailedValidation`         | Ein `start`-Wert mit anderen Zeichen oder über 64 Zeichen        | Bleib bei `A-Z a-z 0-9 _ -`                      |
| `FeatureDisabled`          | Bots in Direktnachrichten sind auf diesem Server aus             | Frag den Admin des Servers                       |

## Weiter {#next}

- [Schaltflächen, Menüs und Formulare](/developers/docs/components)
- [Slash-Befehle](/developers/docs/commands)
