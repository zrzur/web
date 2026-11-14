# Moderations-Bot

`/timeout` und `/purge`, mit den Prüfungen, die ein Moderations-Bot braucht.

> Dieses Tutorial nutzt `@zrzur/sdk/bot`, führe also zuerst `npm install @zrzur/sdk` im Ordner deines Bots aus. Siehe [SDKs](/developers/docs/sdk). Alles, was es tut, geht auch ohne Bibliothek: [Baue einen vollständigen Bot](/developers/docs/tutorial-full-bot).

## Bevor du beginnst {#before-you-start}

Erstelle eine Anwendung, installiere sie auf einem Testserver und setze drei Umgebungsvariablen (siehe [Starte deinen Bot](/developers/docs/getting-started)):

@@0

## Der Code {#the-code}

@@1

Starte es mit `node moderation.mjs`.

## Probiere es aus {#try-it}

Gib dem Bot „Mitglieder Timeouten“ und „Nachrichten verwalten“, und setze seine Rolle über die Mitglieder, die er moderiert.

## Was es zeigt {#what-it-shows}

- `user_permissions` in der Interaktion sagt, was die fragende Person darf.
- Der Server lehnt Ziele ab, die gleich hoch oder höher als der Bot stehen (`NotElevated`).
- Massenlöschung nimmt nur Nachrichten, die jünger als eine Woche sind.
- Antworten sind privat.

> Unsere Tests lassen diese Datei als echten Bot gegen einen Zrzur-Testserver laufen und prüfen, ob er antwortet.
