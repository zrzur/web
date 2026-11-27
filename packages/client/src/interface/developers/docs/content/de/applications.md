# Anwendungen und Tokens

Erstelle im Entwicklerportal einen Bot, ändere seine Einstellungen und installiere ihn auf einem Server.

## Das brauchst du {#you-will-need}

Ein Zrzur-Konto. Registriere dich in der App, wenn du keins hast. Bots haben Eigentümer. Ein Konto kann 7 Bots pro Woche erstellen: Jede Erstellung zählt 7 Tage, und Löschen gibt keinen Versuch zurück.

## Eine Anwendung erstellen {#create}

Eine Anwendung und ihr Bot sind dasselbe: Anwendungs-ID, Bot-ID und Benutzer-ID des Bots sind derselbe Wert. Er ist auch die OAuth2-Client-ID.

1. Öffne das [Entwicklerportal](/developers). Es bittet dich, dich anzumelden. Du findest es auch unter **Einstellungen → Entwicklerportal**.
2. Wähle **Neue Anwendung**.
3. Gib einen Namen für den Bot ein. Lies die Bot-Regeln, hake das Kästchen an, mit dem du sie akzeptierst, und wähle **Erstellen**.
4. Das Token erscheint einmal. Kopiere es jetzt und bewahre es sicher auf: Zrzur speichert nur einen Fingerabdruck und kann es nicht noch einmal zeigen.

> Du kannst jederzeit ein neues Token erzeugen (siehe [Bot](/developers/docs/applications#bot-tab)), aber das alte hört dann sofort auf zu funktionieren.

## Die Seite deiner Anwendung {#tabs}

Öffne eine Anwendung unter **Meine Anwendungen**. Oben stehen auf jedem Tab ihr Name, ob sie öffentlich oder privat ist, und ihre **Anwendungs-ID** mit einer Schaltfläche zum Kopieren. Die Tabs darunter enthalten alles andere, jedes an einem Ort.

| Tab           | Was dort ist                                                                          |
| ------------- | ------------------------------------------------------------------------------------- |
| Allgemein     | Profil des Bots, sein Benutzername, wer ihn installieren darf, ihn löschen            |
| Bot           | Das Token, HTTP-Interaktionen und privilegierte Intents                               |
| Befehle       | Die globalen Befehle des Bots, mit einem Formular                                     |
| Installieren  | Den Bot zu deinem Server hinzufügen, und der Einladungslink mit seinen Berechtigungen |
| OAuth2        | Anmelden mit Zrzur für deine eigene App: Client-Secret, Weiterleitungen, Anmeldelink  |
| Verifizierung | Zrzur bitten, den Bot zu verifizieren                                                 |
| Entdecken     | Den Bot in „Entdecken“ eintragen, wo Leute Bots finden                                |

## Allgemein {#general-tab}

| Einstellung                                | Was sie tut                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Avatar und Banner                          | Die Bilder des Bots. Ein GIF- oder animiertes WebP-Banner wird auf seinem Profil und seiner Einladungsseite abgespielt |
| Anzeigename, Pronomen, Über mich           | Was Leute auf dem Profil des Bots sehen                                                                 |
| Benutzername                               | Der Handle des Bots                                                                                     |
| Öffentlicher Bot                           | An: Jeder mit „Server verwalten“ kann ihn installieren. Aus: nur du; andere bekommen `BotIsPrivate`     |
| Deinen Namen auf der Seite des Bots zeigen | An: Wer die Einladungsseite des Bots öffnet, sieht, dass du ihn gemacht hast. Standardmäßig aus         |
| Bot löschen                                | Löscht den Bot endgültig und verlangt eine Bestätigung deiner Identität                                 |

## Bot {#bot-tab}

| Einstellung           | Was sie tut                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token zurücksetzen    | Erzeugt ein neues Token und verlangt eine Bestätigung deiner Identität. Das alte stoppt sofort                                                                                                                                  |
| HTTP-Interaktionen    | Befehle an deiner eigenen Adresse empfangen. Siehe [Interaktionen über HTTP](/developers/docs/http-interactions)                                                                                                                 |
| Privilegierte Intents | Schalter für Nachrichteninhalt, Servermitglieder und Präsenz. Jeder Schalter wird sofort gespeichert und gilt ab der nächsten Gateway-Verbindung des Bots. Siehe [Intents](/developers/docs/gateway#intents) und [wenn ein Intent aus ist](/developers/docs/gateway#intent-off) |

## Befehle {#commands-tab}

Listet die globalen Befehle des Bots. Ein Formular fügt sie hinzu, ändert und löscht sie, mit Optionen, Namen in anderen Sprachen und wer sie nutzen darf, und zeigt eine Vorschau; **JSON importieren** und **JSON exportieren** nehmen und geben die ganze Liste. Sendet dein Bot seine Liste beim Start, ersetzt diese Liste, was du hier speicherst. Siehe [Slash-Befehle](/developers/docs/commands).

## Den Bot auf einem Server installieren {#install}

Ein Bot tut nichts, bis er auf einem Server ist. Wer ihn installiert, braucht dort **Server verwalten**. Um ihm gleich Berechtigungen zu geben, braucht die Person auch **Rollen verwalten** und jede Berechtigung, die sie gibt.

Für deinen eigenen Server öffne deine Anwendung, Tab **Installieren**, und wähle **Zu einem Server hinzufügen**. Wähle den Server, entferne den Haken bei jeder Berechtigung, die der Bot nicht haben soll, und bestätige.

Damit andere ihn installieren, nutze den Einladungslink auf demselben Tab:

1. Hake die Berechtigungen an, die der Bot braucht. Der Link darunter ändert sich mit ihnen.
2. Kopiere den **Link** und schicke ihn an die Admins des Servers, oder öffne ihn selbst.
3. Die Person wählt einen Server, sieht jede Berechtigung, die der Bot verlangt, kann jede davon abwählen und bestätigt.

Die Berechtigungen werden zu einer Rolle mit dem Namen des Bots. Zrzur erstellt und verwaltet diese Rolle: Menschen können sie höher setzen, aber nicht löschen, solange der Bot da ist. Fordere nur an, was der Bot nutzt.

@@0

Ein Link ohne Berechtigungen gibt dem Bot seine **Standardberechtigungen**: die `default_permissions`, die du mit `PATCH /bots/{bot_id}` setzt. Wer installiert, gibt nur den Teil, den er selbst hat, und nur mit „Rollen verwalten“; ohne das tritt der Bot ohne Rolle bei. `?permissions=0`, oder alle Haken entfernt, gibt keine Rolle.

Setze die Rolle des Bots nach dem Installieren über die Mitglieder, die er moderieren soll. Siehe [Rang](/developers/docs/roles#ranking).

## Serverlimit und Verifizierung {#limits}

Ein unverifizierter Bot kann 100 Servern beitreten. Danach schlägt die Installation mit `BotNeedsVerification` fehl. Über 100 Servern behält er nur die privilegierten Intents, die Zrzur genehmigt hat.

Jeder Bot kann die Verifizierung beantragen, egal wie groß er ist. Du brauchst eine bestätigte E-Mail-Adresse und musst 18 oder älter sein. Beschreibe den Bot im Tab **Verifizierung** und gib seine Links an; der Tab zeigt, was das Zrzur-Team prüft (deine eigenen Punkte, das Alter des Bots und seine zählenden Server) und die privilegierten Intents der Anfrage, also die im Tab **Bot** eingeschalteten. Server und Alter des Bots verhindern nie eine Anfrage: Das Team wägt sie in der Prüfung ab.

Dieselbe Anfrage als Aufruf, für den angemeldeten Eigentümer:

@@1

| Feld                   | Pflicht | Bedeutung                                                                                 |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `statement`            | ja      | 20 bis 1000 Zeichen: was der Bot tut, wer ihn nutzt, wie er mit Daten umgeht              |
| `website`              | nein    | Website oder Dokumentation, `https://`, bis 200 Zeichen                                   |
| `support`              | nein    | Wo Benutzer Hilfe finden, `https://`, bis 200 Zeichen                                     |
| `privacy_policy_url`   | ja      | Datenschutzerklärung des Bots, `https://`, bis 200 Zeichen. Wird auch am Bot gespeichert  |
| `terms_of_service_url` | ja      | Nutzungsbedingungen des Bots, `https://`, bis 200 Zeichen. Werden auch am Bot gespeichert |
| `intents`              | nein    | Summe der privilegierten Intents, die der Bot braucht. Die Zustimmung genehmigt sie       |

Es kann eine Anfrage offen sein, und nach einer Ablehnung kannst du eine Woche später erneut fragen. `GET /bots/{target}/verification` antwortet:

| Feld           | Bedeutung                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verified`     | Ob der Bot verifiziert ist                                                                                                                                                      |
| `request`      | Die letzte Anfrage, mit ihrem `status`: `Pending`, `Approved`, `Denied` oder `Revoked`, und der `decision_note` des Teams                                                       |
| `can_apply_at` | Nach einer Ablehnung: wann du erneut fragen kannst (Millisekunden). Fehlt, wenn du jetzt fragen kannst                                                                          |
| `checks`       | Was das Team prüft, je eine Zeile: `code`, `met` (fehlt, wenn eine Person entscheidet), `value` und `needed`. Nur `owner`, `bot_active`, `email` und `adult` verhindern eine Anfrage |

Eine abgelehnte Anfrage antwortet mit `FailedValidation` und `not_eligible:` samt den Codes der nicht erfüllten Zeilen, zum Beispiel `not_eligible:email`.

## Häufige Fehler {#errors}

| Fehler                 | Ursache                                              | Lösung                                                                                   |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `BotIsPrivate`         | Der Bot ist privat und gehört dir nicht              | „Öffentlicher Bot“ einschalten                                                           |
| `AlreadyInServer`      | Der Bot ist schon da                                 | Nichts zu tun                                                                            |
| `MissingPermission`    | Dir fehlt „Server verwalten“ oder „Rollen verwalten“ | Frage den Servereigentümer                                                               |
| `BotNeedsVerification` | 100 Server erreicht                                  | Verifizierung beantragen                                                                 |
| `ReachedMaximumBots`   | Dein Konto besitzt zu viele Bots                     | Lösche einen ungenutzten Bot                                                             |
| `TooManyBotCreations`  | 7 Bots in den letzten 7 Tagen erstellt               | Warte bis `resets_at` (Millisekunden), oder setze das Token eines vorhandenen Bots zurück |

## Weiter {#next}

- [Starte deinen Bot](/developers/docs/getting-started)
- [Tokens schützen](/developers/docs/security)
