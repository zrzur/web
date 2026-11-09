# Ereignisreferenz

Jedes Ereignis, das ein Bot bekommen kann, mit seinen Feldern. Die Beispiele stammen von einem laufenden Server; die IDs wurden ersetzt.

Ereignisse kommen als JSON-Objekte mit `type`. Felder, die nicht immer da sind, fehlen, wenn sie leer sind. Einige Ereignisse tragen ein Objekt direkt, `Message` hat also `content` neben `type`.

Andere Ereignisse gibt es für die Zrzur-Apps. Bots bekommen sie nie, darum stehen sie hier nicht. `GET /gateway/schema` enthält sie alle.

@@0

## Typen {#types}

Die Objekte aus den Tabellen oben. Daten sind ISO-8601-Text. IDs sind 26 Zeichen lang. Beschreibungen der Typen kommen aus der API und bleiben auf Englisch.

@@1

## Kanäle und Direktnachrichten {#channels}

Eine `Message` nennt ihren Kanal in `channel` und hat kein Feld `server`. Um zu wissen, wo sie geschrieben wurde, schlage den Kanal nach. Behalte die Kanäle aus `Ready` (`channels`) und aus `ChannelCreate`, ändere sie bei `ChannelUpdate` und entferne sie bei `ChannelDelete`. Für einen Kanal, den du noch nicht kennst, rufe `GET /channels/{target}` auf.

| `channel_type`  | Was es ist                                                         | Felder zum Lesen                                                                            |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `TextChannel`   | Ein Kanal eines Servers: Text, Sprache, Ankündigung, Forum oder Thread | `server`. `voice` steht bei einem Sprachkanal, `forum` bei einem Forum, `parent` und `thread` bei einem Thread |
| `DirectMessage` | Eine Direktnachricht zwischen deinem Bot und einer Person          | `recipients` (zwei Nutzer-IDs: dein Bot und die Person), `active`, `last_message_id`        |
| `Group`         | Eine Gruppe von Menschen. Bots werden nicht zu Gruppen hinzugefügt  | `recipients`, `owner`, `name`                                                               |
| `SavedMessages` | Die eigenen Notizen einer Person. Bots sehen sie nie               | `user`                                                                                      |

Eine Nachricht ist eine Direktnachricht, wenn der `channel_type` ihres Kanals `DirectMessage` ist. Die Person ist die ID in `recipients`, die nicht die deines Bots ist.

@@2

Öffnet eine Person zum ersten Mal eine Direktnachricht mit deinem Bot, kommt `ChannelCreate` mit dem `DirectMessage`, vor jeder Nachricht darin. Direktnachrichten und Gruppen erreichen deinen Bot mit und ohne den Intent `SERVERS`, in `Ready` und als `ChannelCreate`. Ihre Nachrichten brauchen `DIRECT_MESSAGES`.
