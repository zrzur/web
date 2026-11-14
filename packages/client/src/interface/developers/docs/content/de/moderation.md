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

## Referenz {#reference}

@@1

Das [Moderations-Tutorial](/developers/docs/tutorial-moderation) baut `/timeout` und `/purge`.
