# Server

Ein Bot tritt einem Server bei, wenn ihn jemand mit „Server verwalten“ installiert. Er kann den Server lesen, mit den richtigen Berechtigungen Einstellungen ändern, Emojis verwalten und gehen.

## Was ein Bot nicht kann {#what-a-bot-cannot-do}

- Server erstellen oder per Einladung beitreten (`IsBot`). Admins installieren Bots.
- Server oder Kanäle als gelesen markieren.
- Entdecken, Abrechnung, Feather oder Wings nutzen.

## Servereinstellungen {#server-settings}

`PATCH /servers/{target}` ändert Namen, Beschreibung, Symbol, Banner, Kategorien und Systemnachrichten-Kanäle (braucht „Server verwalten“). Manche Felder (etwa Bestätigungsmarken) ändert nur das Zrzur-Team.

## Emojis {#emojis}

Lade das Bild mit dem Tag `emojis` auf den Dateiserver (standardmäßig bis 500 KB) und erstelle das Emoji dann mit der zurückgegebenen ID:

@@0

Braucht „Anpassungen verwalten“. Namen nutzen `a-z`, `0-9` und `_`.

## Installierte Anwendungen {#installed-applications}

`GET /servers/{server_id}/applications` listet die installierten Bots eines Servers, `GET /servers/{server_id}/commands` die Befehle, die Mitglieder dort nutzen können.

## Verlassen {#leaving}

`DELETE /servers/{target}` lässt den Bot gehen. Mitglieder sehen `ServerMemberLeave`; der Bot bekommt `ServerDelete` für diesen Server.

## Referenz {#reference}

@@1
