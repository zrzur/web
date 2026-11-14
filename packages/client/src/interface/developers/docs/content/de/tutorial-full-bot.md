# Baue einen vollständigen Bot

In etwa 30 Minuten hast du einen echten Bot: Slash-Befehle, Schaltflächen, ein Formular, Moderation, gespeicherte Daten, klare Fehlermeldungen und eine Verbindung, die von selbst zurückkommt.

## Das brauchst du {#you-will-need}

- Node 22 oder neuer. Prüfe es mit `node --version`. Sonst nichts: keine Bibliothek zu installieren.
- Ein Zrzur-Konto und einen eigenen Server zum Testen. Erstelle den Server in der App.
- Intents: `SERVERS` und `INTERACTIONS`. Beide sind frei, und der Code fordert sie an.

## Was der Bot tut {#what}

| Befehl                     | Wer              | Zeigt                                         |
| -------------------------- | ---------------- | --------------------------------------------- |
| `/ping`                    | alle             | Eine private Antwort                          |
| `/note add`                | alle             | Ein Formular; die Notiz landet in einer Datei |
| `/note list`               | alle             | Notizen, mit Schaltflächen Older und Newer    |
| `/warn member reason`      | Moderation       | Eine gespeicherte Verwarnung                  |
| `/timeout member minutes`  | Moderation       | Ein echtes Timeout, mit aufgeschobener Antwort |

## Schritte {#steps}

### 1. Lege einen leeren Ordner an {#step-1}

@@0

### 2. Erstelle die Anwendung {#step-2}

Öffne das [Entwicklerportal](/developers), wähle **Neue Anwendung**, gib einen Namen ein, akzeptiere die Bot-Regeln und wähle **Erstellen**. Kopiere das Token: Es erscheint einmal. Siehe [Anwendungen und Tokens](/developers/docs/applications).

### 3. Installiere den Bot auf deinem Server, mit Timeout-Berechtigung {#step-3}

Öffne den Tab **OAuth2** deiner Anwendung. Hake im **URL-Generator** `bot.install` an und unter **Bot-Berechtigungen** „Mitglieder in Timeout versetzen“. Öffne den **Einladungslink**, wähle deinen Server und bestätige.

### 4. Setze die Rolle des Bots höher {#step-4}

Ein Bot kann nur Mitgliedern unter ihm ein Timeout geben. Öffne auf deinem Server **Servereinstellungen → Rollen** und ziehe die Rolle mit dem Namen des Bots über die Rollen normaler Mitglieder.

### 5. Finde die ID deines Servers {#step-5}

Die Adresse deines Servers in der App ist `/server/SERVER_ID`. Kopiere diese ID. Beim Testen gehen Befehle nur an diesen Server.

### 6. Speichere den Code {#step-6}

Speichere die Datei unten als `full-bot.mjs` in deinem Ordner.

@@1

### 7. Starte ihn {#step-7}

@@2

In Windows PowerShell nimmst du `$env:ZRZUR_BOT_TOKEN = "YOUR_BOT_TOKEN"`. Auf einem selbst gehosteten Server setzt du auch `ZRZUR_API_URL` und `ZRZUR_WS_URL`.

## Was du sehen solltest {#what-you-should-see}

Im Terminal:

@@3

Tippe auf deinem Server `/` in einem Kanal. Die vier Befehle erscheinen mit dem Namen deines Bots. Probiere sie aus:

1. `/ping` antwortet `Pong!`, nur für dich sichtbar.
2. `/note add` öffnet ein Formular. Fülle es aus und sende es. Die Antwort ist `Saved.`
3. In deinem Ordner liegt jetzt eine Datei `bot-data.json`.
4. `/note list` zeigt die Notiz. Füge eine zweite hinzu, und die Schaltflächen funktionieren.
5. `/warn` wählt ein Mitglied und einen Grund und zählt die Verwarnungen.
6. `/timeout` bringt ein Mitglied zum Schweigen. Dem Eigentümer des Servers kannst du kein Timeout geben: Probiere es und lies den Fehler.
7. Drücke Strg+C und starte den Bot neu. Deine Notizen sind noch da.
8. Schalte dein Netzwerk aus und wieder ein. Das Terminal zeigt `disconnected`, dann `ready`, und die Befehle funktionieren wieder.

## So funktioniert es {#how}

**Gespeicherte Daten.** `save()` schreibt alles in eine zweite Datei und benennt sie um. Ein Absturz hinterlässt nie eine halbe Datei. Eine JSON-Datei reicht für einen kleinen Bot; eine echte Datenbank passt zu einem größeren, und nur `save()` und das Laden beim Start ändern sich.

**`rest()`.** Jeder Aufruf läuft durch eine Funktion. Sie wartet nach einem `429`, pausiert alles nach einem globalen, wiederholt bei Netzfehlern und `5xx` und wirft `ApiError` für den Rest. Siehe [Ratenlimits](/developers/docs/rate-limits).

**`COMMANDS`.** Die Liste geht bei jedem Start per `PUT` hinaus. Ohne `ZRZUR_TEST_SERVER` werden die Befehle global. Siehe [Slash-Befehle](/developers/docs/commands).

**`optionsOf()`.** Werte eines Unterbefehls liegen eine Ebene tiefer als einfache Optionen. Diese Funktion macht sie flach.

**`onCommand()`.** Jeder Pfad gibt eine erste Antwort: `reply` für eine Nachricht, `Modal` für das Formular. `/timeout` antwortet zuerst `DeferredMessage` und ändert das Original später mit `PATCH`. Siehe [Auf Interaktionen antworten](/developers/docs/interactions).

**`custom_id`.** Eine Schaltfläche trägt die Seitenzahl in `note:3`. Der Bot hält dafür keinen Zustand, also funktionieren Schaltflächen auch nach einem Neustart.

**`hasBit()`.** `default_member_permissions` versteckt Moderationsbefehle vor Mitgliedern, aber der Bot prüft trotzdem zuerst seine eigene Berechtigung in `app_permissions_string`, um klar antworten zu können.

**`outranks()`.** Der Server vergleicht das Ziel nur mit dem Bot. Ohne diese Prüfung könnte eine Moderatorin über den Bot jemanden zum Schweigen bringen, der über ihr steht, also vergleicht die Funktion zuerst die beiden Personen. Eine kleinere Rangzahl steht höher.

**`onInteraction()`.** Ein `try` um jede Interaktion. Die Person liest klare Worte aus `explain()`, dein Log hat die Details. Ging die erste Antwort schon hinaus, ändert der Fehler sie. Eine zweite erste Antwort würde scheitern.

**`connect()`.** Der `Ping`-Timer findet tote Leitungen. Der `close`-Handler wartet 1, 2, 4 ... 30 Sekunden und verbindet neu, und `Ready` setzt die Wartezeit zurück. Er stoppt bei `InvalidSession` und `4014`, denn Wiederholen hilft dort nicht. Siehe [Gateway](/developers/docs/gateway).

## Häufige Fehler {#errors}

| Was du siehst                       | Ursache                                       | Lösung                                     |
| ----------------------------------- | --------------------------------------------- | ------------------------------------------ |
| `Set ZRZUR_BOT_TOKEN first.`        | Die Variable ist in diesem Terminal nicht gesetzt | Schritt 7                              |
| `the token was refused, stopping`   | Falsches oder zurückgesetztes Token           | Kopiere das Token neu oder setze es zurück |
| `could not start`, `ApplicationNotInstalled` | Die Server-ID in `ZRZUR_TEST_SERVER` ist falsch, oder der Bot ist nicht dort | Schritt 3 und 5 |
| Befehle erscheinen nicht            | Der Bot ist nicht auf diesem Server           | Schritt 3                                  |
| "I need the „Mitglieder Timeouten“ permission." | Der Link hatte keine Berechtigung        | Schritt 3 noch einmal, oder gib der Rolle des Bots die Berechtigung |
| "That member ranks at or above me." | Die Rolle des Bots ist zu niedrig             | Schritt 4                                  |
| "That member ranks at or above you." | Du stehst gleich hoch oder niedriger         | Frage jemanden, der höher steht            |
| "That member cannot be timed out."  | Es ist der Eigentümer des Servers (`InvalidOperation`) | Wähle ein anderes Mitglied       |
| Der Bot hat nicht geantwortet       | Der Bot lief nicht                            | Starte ihn                                 |

## Weiter {#next}

- [Betrieb in Produktion](/developers/docs/production)
- [Schaltflächen, Menüs und Formulare](/developers/docs/components)
