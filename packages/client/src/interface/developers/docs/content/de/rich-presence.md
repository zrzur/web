# Aktivitätsstatus für Spiele und Apps

Zeige „Spielt My Game“ mit den Details deines Spiels unter dem Namen der Person, über die Zrzur-Desktop-App auf demselben Computer.

Das ist für Spiele und Apps, die die Person selbst startet, nicht für Bots: Ein Bot kann nie festlegen, was eine Person gerade tut. Dein Spiel schickt nichts über das Netz; die Desktop-App gibt es weiter, und nur solange die Person ihre Aktivität teilt.

## Das brauchst du {#you-will-need}

- Node 22.3 oder neuer und `npm install @zrzur/sdk` (oder eine Sprache, die eine Named Pipe oder einen Unix-Socket öffnen kann).
- Die Zrzur-Desktop-App läuft auf demselben Computer, mit Einstellungen → Aktivität → „Teilen, was du gerade tust“ an.

## Schritte {#steps}

1. Wähle eine kurze ID für deine App, zum Beispiel `my-game`. Buchstaben, Ziffern, `.`, `_` und `-`, höchstens 64 Zeichen.
2. Verbinde dich mit `new ZrzurRpc({ clientId })` und `connect()`. Es findet die Desktop-App auf der Pipe `zrzur-ipc-0` bis `zrzur-ipc-9`.
3. Rufe `setActivity({ details, state, timestamps, buttons })` auf, wenn sich im Spiel etwas ändert.
4. Rufe `setActivity(null)` auf, um sie zu löschen, und `close()`, wenn das Spiel endet. Schließen löscht sie auch.

## Vollständiges Beispiel {#full-example}

@@0

Starte es mit `node rich-presence.mjs`, während die Desktop-App offen ist.

## Das solltest du sehen {#what-you-should-see}

@@1

Freunde sehen „Spielt My Game“, „Ranked match“, „Round 1 of 12“ und die Zeit seit dem Start, in der Mitgliederliste und im Profil.

## Die Aktivität {#the-activity}

| Feld | Grenze | Hinweise |
| --- | --- | --- |
| `name` | 1 bis 128 Zeichen | Fehlt er, nimmt die Desktop-App den Namen des Programms |
| `details`, `state` | je 128 Zeichen | Je eine Zeile |
| `timestamps.start`, `timestamps.end` | Millisekunden oder Sekunden seit 1970 | Die App zeigt die Zeit seit dem Start oder die Restzeit |
| `assets.large_image`, `assets.small_image` | nur `https://` | Über den Bild-Proxy von Zrzur angezeigt; andere Bildschlüssel fallen weg |
| `buttons` | 2, Beschriftung 32 Zeichen, `https://`-Links | Vor dem Öffnen sehen Personen eine Link-Warnung |
| `type` | 0 Spielt, 1 Streamt, 2 Hört, 3 Schaut, 5 Tritt an | Ohne Angabe: Spielt |

Texte laufen durch die Wortliste von Zrzur. Eine Aktivität, die der Server ablehnt, wird nicht gezeigt, und dein Spiel bekommt dafür keinen Fehler.

## Das Protokoll {#the-protocol}

Ohne SDK: Öffne die Pipe `\\?\pipe\zrzur-ipc-0` unter Windows oder den Socket `zrzur-ipc-0` in `$XDG_RUNTIME_DIR` (oder `$TMPDIR`) unter macOS und Linux. Jeder Frame beginnt mit 8 Byte, dem Opcode und der Länge des Inhalts (beide 32 Bit, Little Endian), danach folgt der Inhalt als UTF-8-JSON.

| Opcode | Bedeutung |
| --- | --- |
| 0 | Handshake: `{"v":1,"client_id":"my-game"}` |
| 1 | Frame: `{"cmd":"SET_ACTIVITY","nonce":"1","args":{"pid":1234,"activity":{...}}}` |
| 2 | Schließen |
| 3, 4 | Ping und Pong |

Die Desktop-App antwortet auf den Handshake mit einem `READY`-Frame und auf jedes `SET_ACTIVITY` mit einem Frame mit derselben `nonce`. Der `READY`-Frame verrät deiner App nie, wer angemeldet ist. Ein Frame über 64 KiB oder alles, was nicht dieses Protokoll ist, schließt die Verbindung.

## Grenzen {#limits}

- Der Server nimmt 5 Änderungen in 20 Sekunden pro Person an. Ändere die Aktivität, wenn sich das Spiel ändert, nicht per Timer.
- Die Person sieht deine App unter Einstellungen → Aktivität → Verbundene Apps und kann sie blockieren.
- Nichts wird gespeichert: Die Aktivität verschwindet, wenn deine App sie löscht, sich schließt oder die Person offline geht.

## Häufige Fehler {#common-errors}

| Fehler | Ursache | Lösung |
| --- | --- | --- |
| `The Zrzur desktop app is not running` | Keine Pipe antwortet | Desktop-App starten oder später erneut versuchen |
| `The Zrzur desktop app did not answer` | Die App ist beschäftigt oder Teilen ist aus | Später erneut versuchen; bei ausgeschaltetem Teilen wird nichts gezeigt |
| `clientId: 1 to 64 letters...` | Die ID enthält Leerzeichen oder andere Zeichen | Buchstaben, Ziffern, `.`, `_` oder `-` verwenden |

## Weiter {#next}

- [SDK](/developers/docs/sdk)
- [Nutzer und Mitglieder](/developers/docs/users)
