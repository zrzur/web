# Benutzer und Mitglieder

Ein **Benutzer** ist ein Zrzur-Konto, ein **Mitglied** ein Benutzer auf einem Server, mit Spitzname, Rollen und Timeout.

## Was ein Bot über Menschen sieht {#what-a-bot-can-see-about-people}

Ein Bot sieht, was Mitglieder desselben Servers sehen: Benutzernamen, Anzeigenamen, Avatar, Abzeichen, Status und das öffentliche Profil. Er sieht nie E-Mail-Adressen, Sitzungen, Einstellungen, Privatsphäre-Entscheidungen oder Freundschaften.

- `GET /users/{target}` liefert einen Benutzer, den der Bot sehen kann (gemeinsamer Server oder Direktnachricht).
- `GET /users/{target}/profile` kann abgelehnt werden (`403`), wenn das Profil für den Bot nicht sichtbar ist.
- Freunde und Blockierungen sind nur für Menschen. Jeder dieser Endpunkte lehnt Bots mit `IsBot` ab.
- `official` kennzeichnet ein Konto, das Zrzur betreibt, und `official_names` enthält seinen Namen pro Sprache (`ar`, `en`, `de`, mit `display_name` als Rückfall). `official_bot` kennzeichnet einen Bot, den Zrzur selbst betreibt. Antworten, Reaktionen, Anpinnen und Melden lehnt ein offizielles Konto mit `403 OfficialAccount` ab.

## Grenzen der Privatsphäre {#privacy-limits}

Menschen entscheiden, wer ihnen schreiben darf. Ein Bot ist nie ein Freund, also:

| Ihre Einstellung „Direktnachrichten“        | Kann der Bot eine Direktnachricht beginnen? |
| ------------------------------------------- | ------------------------------------------- |
| Alle                                        | Ja                                          |
| Gemeinsame (Standard: geteilter Server oder Gruppe) | Ja, solange der Bot einen Server mit ihnen teilt |
| Freunde                                     | Nein                                        |

Blockierte Benutzer bekommen nie Nachrichten eines Bots, und wer dem Bot zuerst geschrieben hat, kann immer eine Antwort bekommen. `GET /users/{target}/dm` kann gelingen, während das Senden mit `403 DirectMessagesRestricted` oder `Blocked` abgelehnt wird. Wiederhole diese Fehler nicht: Poste stattdessen in einem Serverkanal, ohne private Details.

Gruppeneinladungen haben eine eigene Einstellung; Bots können gar keine Gruppen erstellen oder Leute hinzufügen.

Alterschecks für nicht jugendfreie Kanäle gelten nur für Menschen: Bots haben kein Alter und werden nicht geprüft. Nutze keinen Bot, um Mitgliedern Inhalte zu zeigen, deren Kanäle sie selbst nicht öffnen können.

## Mitglieder {#members}

Mitglieder-Endpunkte funktionieren auf Servern, auf denen der Bot ist.

- `GET /servers/{target}/members` liefert alle Mitglieder und ihre Benutzer in einer Antwort. Nimm lieber die Mitgliederdaten aus `Ready` und aus Interaktionen: weniger Anfragen, und der Bucket `servers` ist klein.
- `PATCH /servers/{server_id}/members/{member_id}` ändert Spitznamen, Rollen, Timeouts und Sprachstatus. Jede Änderung braucht ihre eigene Berechtigung, und das Ziel muss **unter** dem Bot stehen (und unter der Moderatorin, wenn dein Bot für sie handelt).
- Die Ereignisse `ServerMemberJoin`, `ServerMemberUpdate` und `ServerMemberLeave` halten einen Cache aktuell.

## Referenz: Benutzer {#reference-users}

@@0

## Referenz: Mitglieder {#reference-members}

@@1
