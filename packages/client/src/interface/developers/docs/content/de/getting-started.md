# Starte deinen Bot

In etwa zehn Minuten hast du einen Bot, der in deinem Testserver auf einen Slash-Befehl antwortet. Du brauchst ein Zrzur-Konto, einen eigenen Server und Node.js 22.3 oder neuer.

## 1. Erstelle eine Anwendung {#create-an-application}

Wähle im Entwicklerportal „Neue Anwendung“, gib einen Namen ein und wähle „Erstellen“. Die Anwendung bringt ein Bot-Konto mit. [Meine Anwendungen öffnen](/developers)

## 2. Kopiere das Token {#copy-the-token}

Das Token erscheint einmal, direkt nach dem Erstellen der Anwendung. Kopiere es jetzt. Wer das Token hat, steuert den Bot.

> Bewahre das Token in einer Umgebungsvariable oder einem Secret-Speicher auf. Schreib es nie in Code, in ein Repository oder auf einen Screenshot. Wenn es bekannt wird, setze es sofort zurück.

## 3. Installiere den Bot in einem Testserver {#install-the-bot}

Wähle im Tab „Übersicht“ deiner Anwendung „Zu einem Server hinzufügen“ und dann einen Server, auf dem du „Server verwalten“ hast. [Mehr zum Installieren](/developers/docs/applications#install)

Mach das vor dem ersten Start. Ein Bot, der nicht auf dem Server ist, bekommt beim Schreiben in dessen Kanäle 403 MissingPermission, und das sieht aus wie eine fehlende Berechtigung. [Ist der Bot auf diesem Server?](/developers/docs/errors#not-installed)

## 4. Installiere die Bibliothek {#get-the-sdk}

Lege einen Ordner für deinen Bot an und installiere `@zrzur/sdk`, die offizielle Bibliothek:

@@0

Sie hält die Gateway-Verbindung für dich und beantwortet Befehle. Die API ist einfaches HTTP und WebSocket, ein Bot läuft also auch ganz ohne Bibliothek: [Ohne Bibliothek](/developers/docs/raw-http). [Über die SDKs](/developers/docs/sdk)

## 5. Schreib deinen ersten Bot {#first-bot}

Speichere das als hello.mjs in diesem Ordner. Es registriert /hello und antwortet darauf.

@@1

## 6. Starte ihn {#run-it}

Setze das Token und starte dann den Bot:

@@2

Sobald das Terminal ready zeigt, tippe /hello in einem Kanal deines Testservers. Der Bot antwortet mit Hello und deinem Namen.

## 7. Empfange Ereignisse {#gateway}

Der Bot hält eine WebSocket-Verbindung zum Gateway. Befehle, Klicks auf Schaltflächen, neue Nachrichten und Änderungen an Mitgliedern kommen dort als Ereignisse an. [Gateway](/developers/docs/gateway)

## 8. Baue einen echten Bot {#deploy}

Dieser Bot kennt nur einen Befehl. Der vollständige Bot hat Befehle, Schaltflächen, ein Formular, Moderation, gespeicherte Daten, Fehlerbehandlung und Wiederverbindung, in einer Datei und ohne Bibliothek. [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot)

## Nächste Schritte {#next-steps}

- [Slash-Befehle](/developers/docs/commands)
- [Schaltflächen, Menüs und Formulare](/developers/docs/components)
- [Fehler](/developers/docs/errors)
- [Ratenlimits](/developers/docs/rate-limits)
