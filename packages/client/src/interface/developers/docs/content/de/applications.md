# Anwendungen und Tokens

Erstelle im Entwicklerportal einen Bot, ändere seine Einstellungen und installiere ihn auf einem Server.

## Das brauchst du {#you-will-need}

Ein Zrzur-Konto. Registriere dich in der App, wenn du keins hast. Bots haben Eigentümer. Ein Konto kann 7 Bots pro Woche erstellen: Jede Erstellung zählt 7 Tage, und Löschen gibt keinen Versuch zurück.

## Eine Anwendung erstellen {#create}

Eine Anwendung und ihr Bot sind dasselbe: Anwendungs-ID, Bot-ID und Benutzer-ID des Bots sind derselbe Wert.

1. Öffne das [Entwicklerportal](/developers). Es bittet dich, dich anzumelden. Du findest es auch unter **Einstellungen → Entwicklerportal**.
2. Wähle **Neue Anwendung**.
3. Gib einen Benutzernamen für den Bot ein. Lies die Bot-Regeln, schalte den Schalter ein, mit dem du sie akzeptierst, und wähle **Erstellen**.
4. Das Token erscheint einmal. Kopiere es jetzt und bewahre es sicher auf: Zrzur speichert nur einen Fingerabdruck und kann es nicht noch einmal zeigen.

> Du kannst jederzeit ein neues Token erzeugen (siehe unten), aber das alte hört dann sofort auf zu funktionieren.

## Der Tab Übersicht {#overview-tab}

| Einstellung            | Was sie tut                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Öffentlicher Bot       | An: Jeder mit „Server verwalten“ kann ihn installieren. Aus: nur du; andere bekommen `BotIsPrivate`     |
| Deinen Namen auf der Seite des Bots zeigen | An: Wer die Einladungsseite des Bots öffnet, sieht, dass du ihn gemacht hast. Standardmäßig aus |
| Privilegierte Intents  | Schalter für Nachrichteninhalt, Servermitglieder und Präsenz. Jeder Schalter wird sofort gespeichert und gilt ab der nächsten Gateway-Verbindung des Bots. Siehe [Intents](/developers/docs/gateway#intents) und [wenn ein Intent aus ist](/developers/docs/gateway#intent-off) |
| Benutzername           | Der Name des Bots                                                                                       |
| Bot-ID                 | Die ID für Routen unter `/applications/{id}/...`                                                        |
| Zu einem Server hinzufügen | Installiert den Bot auf einem deiner Server                                                         |
| Einladungslink         | Ein Link zum Teilen, `/bot/<bot id>` in der App                                                         |
| Token zurücksetzen     | Erzeugt ein neues Token und verlangt eine Bestätigung deiner Identität. Das alte stoppt sofort          |
| HTTP-Interaktionen     | Befehle an deiner eigenen Adresse empfangen. Siehe [Interaktionen über HTTP](/developers/docs/http-interactions) |
| Bot löschen            | Löscht den Bot endgültig und verlangt eine Bestätigung deiner Identität                                 |

## Der Tab Befehle {#commands-tab}

Listet die globalen Befehle des Bots. Ein Formular fügt sie hinzu, ändert und löscht sie, mit Optionen, Namen in anderen Sprachen und wer sie nutzen darf, und zeigt eine Vorschau; **JSON importieren** und **JSON exportieren** nehmen und geben die ganze Liste. Sendet dein Bot seine Liste beim Start, ersetzt diese Liste, was du hier speicherst. Siehe [Slash-Befehle](/developers/docs/commands).

## Den Bot auf einem Server installieren {#install}

Ein Bot tut nichts, bis er auf einem Server ist. Wer ihn installiert, braucht dort **Server verwalten**. Um ihm gleich Berechtigungen zu geben, braucht die Person auch **Rollen verwalten** und jede Berechtigung, die sie gibt.

Der schnellste Weg für deinen eigenen Testserver:

1. Öffne deine Anwendung, Tab **Übersicht**, und wähle **Zu einem Server hinzufügen**.
2. Wähle den Server.

Um mit bestimmten Berechtigungen zu installieren, oder damit andere ihn installieren:

1. Öffne deine Anwendung, Tab **OAuth2**, Bereich **URL-Generator**.
2. Hake `bot.install` und die Berechtigungen an, die der Bot braucht.
3. Kopiere den **Einladungslink** und öffne ihn, oder schicke ihn an die Admins des Servers.
4. Die Person wählt einen Server und bestätigt.

Die Berechtigungen werden zu einer Rolle mit dem Namen des Bots. Zrzur erstellt und verwaltet diese Rolle: Menschen können sie höher setzen, aber nicht löschen, solange der Bot da ist. Fordere nur an, was der Bot nutzt.

@@0

Der Bot bekommt nur eine Rolle, wenn der Link Berechtigungen enthält. Mit **Zu einem Server hinzufügen** ist er ein einfaches Mitglied mit den Standardberechtigungen des Servers.

Setze die Rolle des Bots nach dem Installieren über die Mitglieder, die er moderieren soll. Siehe [Rang](/developers/docs/roles#ranking).

## Serverlimit und Bestätigung {#limits}

Ein unbestätigter Bot kann 100 Servern beitreten. Danach schlägt die Installation mit `BotNeedsVerification` fehl. Über 100 Servern behält er nur die privilegierten Intents, die Zrzur genehmigt hat. Wähle im Tab **Übersicht** den Bereich **Verifizierung** und beschreibe den Bot. Dieselbe Anfrage als Aufruf, für den angemeldeten Eigentümer:

@@1

| Feld        | Pflicht | Bedeutung                                                                 |
| ----------- | ------- | ------------------------------------------------------------------------- |
| `statement` | ja      | 20 bis 1000 Zeichen: was der Bot tut, wer ihn nutzt, wie er mit Daten umgeht |
| `website`   | nein    | Website oder Dokumentation, `https://`, bis 200 Zeichen                   |
| `support`   | nein    | Wo Benutzer Hilfe finden, `https://`, bis 200 Zeichen                     |
| `privacy_policy_url` | ja | Datenschutzerklärung des Bots, `https://`, bis 200 Zeichen. Wird auch am Bot gespeichert |
| `terms_of_service_url` | ja | Nutzungsbedingungen des Bots, `https://`, bis 200 Zeichen. Werden auch am Bot gespeichert |
| `intents`   | nein    | Summe der privilegierten Intents, die der Bot braucht. Die Zustimmung genehmigt sie |

Es kann eine Anfrage offen sein, und nach einer Ablehnung kannst du eine Woche später erneut fragen. `GET /bots/{target}/verification` antwortet mit `verified`, `request` samt `status` (`Pending`, `Approved`, `Denied` oder `Revoked`) und `can_apply_at`.

## Häufige Fehler {#errors}

| Fehler                 | Ursache                                        | Lösung                                  |
| ---------------------- | ---------------------------------------------- | --------------------------------------- |
| `BotIsPrivate`         | Der Bot ist privat und gehört dir nicht        | „Öffentlicher Bot“ einschalten          |
| `AlreadyInServer`      | Der Bot ist schon da                           | Nichts zu tun                           |
| `MissingPermission`    | Dir fehlt „Server verwalten“ oder „Rollen verwalten“ | Frage den Servereigentümer        |
| `BotNeedsVerification` | 100 Server erreicht                            | Bestätigung beantragen                  |
| `ReachedMaximumBots`   | Dein Konto besitzt zu viele Bots               | Lösche einen ungenutzten Bot            |
| `TooManyBotCreations`  | 7 Bots in den letzten 7 Tagen erstellt         | Warte bis `resets_at` (Millisekunden), oder setze das Token eines vorhandenen Bots zurück |

## Weiter {#next}

- [Starte deinen Bot](/developers/docs/getting-started)
- [Tokens schützen](/developers/docs/security)
