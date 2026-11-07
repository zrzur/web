# Betrieb in Produktion

Halte einen Bot monatelang am Laufen: wo du ihn hostest, wie er sich erholt, was er loggt.

## Das brauchst du {#you-will-need}

Eine Maschine, die an bleibt, mit Node 22 oder neuer. Ein kleiner virtueller Server reicht für die meisten Bots. Dein Laptop taugt nur zum Testen: Der Bot stoppt, wenn er einschläft.

Ein Bot baut nur ausgehende Verbindungen auf. Er braucht keinen offenen Port, außer du nutzt [HTTP-Interaktionen](/developers/docs/http-interactions) oder eine Prüfung von außen.

## Als Dienst betreiben {#service}

Etwas muss den Bot beim Hochfahren und nach einem Absturz starten. Mit systemd:

@@0

@@1

Docker geht genauso: `docker run --restart=always --env-file .env`.

## Sauber stoppen {#shutdown}

Schließe bei `SIGTERM` das Gateway und lass laufende Arbeit enden. Speichere deine Daten in eine zweite Datei und benenne sie um, damit ein Absturz mittendrin nie eine halbe Datei hinterlässt.

## Neu verbinden {#reconnect}

Neu verbinden ist Aufgabe deines Bots. Folge [Gateway: Neu verbinden](/developers/docs/gateway#reconnect) und achte auf Stille, mit einem `Ping` alle 20 Sekunden und einem Limit von 60 Sekunden ohne `Pong`.

Stoppe endgültig nur bei `InvalidSession` und Close-Code `4014`. Alles andere ist vorübergehend. Ein Bot, der in diesen zwei Fällen endet, braucht einen Menschen, also sorge dafür, dass dein Prozessmanager das Gateway nicht bombardiert: `RestartSec=5` wartet zwischen den Versuchen.

Es gibt kein Fortsetzen. Hole nach jedem `Ready`, was du nicht verpassen darfst.

## Logge, was hilft {#logging}

Schreibe eine Zeile pro Ereignis als JSON auf die Standardausgabe. Dein Dienstmanager bewahrt sie auf.

@@2

Logge Zeit, Interaktionstyp, Befehl, Dauer und den Fehler-`type`. Logge nie Tokens oder Nachrichtentext.

Alarmiere bei diesen Fällen:

- `ready`-Zeilen kommen oft: Die Verbindung ist instabil.
- Interaktionen über 2 Sekunden: Du bist nah am Limit von 3.
- `429`-Antworten: Du sendest zu viel.
- `InvalidSession`: Das Token hat sich geändert.

## Langsame Arbeit außerhalb des Handlers {#slow-work}

Antworte `DeferredMessage`, lege die Arbeit in eine Warteschlange und ändere die Antwort, wenn sie fertig ist. Blockiere die Gateway-Schleife nicht: Ein Bot, der seinen Socket nicht mehr liest, verpasst sein eigenes `Pong`.

## Prüfen, ob er lebt {#health}

Eine kleine HTTP-Adresse sagt einem Monitor, dass der Bot läuft. Siehe das [Deployment-Tutorial](/developers/docs/tutorial-deploy).

## Wachsen {#growing}

- Über 100 Servern brauchst du die Bestätigung. Siehe [Serverlimit und Bestätigung](/developers/docs/applications#limits).
- Sharding gibt es nicht. Ein Prozess empfängt alles, also halte deine Handler klein.
- Cache, was dir Ereignisse sagen, statt es zu holen. Der Bucket `servers` ist klein.

## Updates {#updates}

Ein Neustart kostet ein paar Sekunden, und Befehle in dieser Zeit scheitern. Registriere Befehle beim Start nur, wenn sie sich geändert haben: `PUT` ist sicher, zählt aber gegen ein Ratenlimit.

## Checkliste {#checklist}

- Das Token liegt in einem Secret-Speicher, nicht in Git.
- Der Bot startet nach Absturz und Reboot von selbst neu.
- Er verbindet sich mit wachsender Wartezeit neu.
- Er stoppt bei `InvalidSession` und `4014`.
- Er loggt als JSON, ohne Geheimnisse.
- Langsame Arbeit ist aufgeschoben.
- Er befolgt `429`, und ein globales `429` pausiert alles.

## Weiter {#next}

- [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot)
- [Tokens schützen](/developers/docs/security)
