# Moderation

Bots können kicken, bannen, Timeouts geben, Nachrichten in Masse löschen und das Audit-Log lesen. Der Server setzt alles durch; dein Bot sollte trotzdem die fragende Person prüfen.

## Regeln, die der Server durchsetzt {#rules-the-server-enforces}

- Der Bot braucht die passende Berechtigung: „Mitglieder kicken“, „Mitglieder sperren“, „Mitglieder Timeouten“, „Nachrichten verwalten“, „Audit-Protokoll ansehen“.
- Das Ziel muss unter dem Bot stehen. Der Servereigentümer lässt sich weder kicken noch bannen noch mit Timeout belegen.
- Ein Timeout ist eine Endzeit (`timeout`, ISO 8601). Mitglieder mit „Mitglieder Timeouten“ bekommen kein Timeout (`IsElevated`), und niemand gibt sich selbst eins. Beende ein Timeout früher mit `remove: ["Timeout"]`.
- Ein Bann kann die Nachrichten des Benutzers der letzten 7 Tage löschen (`delete_message_seconds`, höchstens 604800).
- Massenlöschung nimmt bis zu 100 Nachrichten, die jünger als eine Woche sind.

## Regeln, die dein Bot ergänzen sollte {#rules-your-bot-should-add}

1. **Prüfe die Person, nicht nur den Bot.** Nimm `user_permissions` aus der Interaktion (siehe [Rollen und Berechtigungen](/developers/docs/roles#permission-strings)).
2. **Vergleiche Ränge.** Lehne ab, wenn das Ziel gleich hoch oder höher steht als die fragende Person.
3. **Lehne offensichtliche Fehler ab:** auf sich selbst, den Bot oder den Eigentümer zielen.
4. **Schreibe einen Grund.** Gründe erscheinen im Audit-Log.
5. **Antworte privat.** Moderationsantworten sind am besten `ephemeral`.

## Kicken, bannen, Timeout {#actions}

@@0

Der Header `X-Audit-Log-Reason` schreibt einen Grund ins Audit-Log. Er funktioniert auf jeder Moderationsroute.

## Audit-Log {#audit-log}

`GET /servers/{target}/audit_logs` listet, wer was getan hat. Aktionen deines Bots zeigen ihn als Handelnden.

Filtere es mit `user` (wer handelte), `target` (woran oder an wem), `type` (die Aktion), `before` und `after` (Eintrags-IDs) und `limit`. Blättere rückwärts, indem du `before` auf die älteste erhaltene ID setzt.

## Bans {#bans}

`GET /servers/{target}/bans` listet die Bans mit den gebannten Nutzern; `DELETE /servers/{target}/bans/{user_id}` hebt einen auf. Bans brauchen Mitglieder bannen. Ein gebannter Nutzer kann erst wieder beitreten, wenn der Ban aufgehoben ist.

## Beitrittsanfragen {#join-requests}

Ein Server, der Menschen erst nach einem Blick hereinlässt (`access`), sammelt ihre Anfragen. Mit Beitrittsanfragen verwalten kann ein Bot sie bearbeiten: `GET /servers/{target}/join_requests` listet die offenen, die ältesten zuerst, mit den Antworten aus der Lobby; `POST /servers/{target}/join_requests/{applicant}/approve` macht die Person zum Mitglied, `.../reject` lehnt sie ab. Die Zusage scheitert, wenn schon jemand anderes entschieden hat oder die Person nicht beitreten kann (gebannt, voller Server, Alter). Die eigenen Anfragen der Antragsteller (`GET` und `DELETE /servers/{target}/join_requests/@me`) sind für Personen.

## Einen Server schützen {#safety}

- [AutoMod](/developers/docs/servers#automod) hält Nachrichten zurück, bevor sie erscheinen, mit Regeln, die der Server speichert.
- `PUT /servers/{target}/safety/pause` stoppt Einladungen, Discover-Beitritte und DMs zwischen Fremden für einige Stunden während eines Angriffs ([Server](/developers/docs/servers#tools)).
- Das Kontingent `servers` erlaubt 5 Aktionen je 10 Sekunden und Server; ein Bot, der auf einen Angriff reagiert, sollte zuerst die schlimmsten Konten angehen und `429` erwarten ([Rate-Limits](/developers/docs/rate-limits#buckets)).

## Referenz {#reference}

@@1

Das [Moderations-Tutorial](/developers/docs/tutorial-moderation) baut `/timeout` und `/purge`.
