# Sprache

Zrzur-Sprache läuft auf LiveKit. Die API gibt Tickets aus; der Ton selbst läuft über einen LiveKit-Client.

## Was funktioniert {#what-works}

| Fähigkeit                                                                    | Status                                                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Ein Ticket für einen Sprachkanal holen (`POST /channels/{target}/join_call`) | Unterstützt, live mit einem Bot-Token geprüft                                                 |
| Mit dem Ticket zu LiveKit verbinden und **Ton senden**                       | Unterstützt. Durchgängig mit `@livekit/rtc-node` geprüft: Ein zweiter Teilnehmer empfing und maß den Ton des Bots |
| Ton anderer Teilnehmer empfangen                                             | Möglich mit einem LiveKit-Client; braucht Listen. Nicht von unseren Tests abgedeckt           |
| Mitglieder verschieben, stummschalten, taub stellen (`PATCH /servers/{server_id}/members/{member_id}`) | Unterstützt mit „Mitglieder verschieben“, „Mitglieder stummschalten“, „Mitglieder taub schalten“          |
| Video und Bildschirm von einem Bot                                           | Nicht getestet; Tickets folgen der Berechtigung Video                                         |
| `force_disconnect` beim Beitreten                                            | Nicht für Bots (`IsBot`)                                                                      |

## Beitreten {#join}

Hole ein Ticket mit einfachem HTTP:

@@0

Verbinde dich dann mit einem LiveKit-Client. Mit dem SDK und `@livekit/rtc-node`:

@@1

Erstelle dann eine `AudioSource` mit 48 kHz, packe sie in einen `LocalAudioTrack`, sende ihn mit `room.localParticipant.publishTrack(...)` und füttere ihn mit 10-ms-Frames. Andere Mitglieder sehen `VoiceChannelJoin`, wenn der Bot im Raum ist.

Der Bot braucht Connect zum Beitreten und Speak, um gehört zu werden. `GET /` listet die Sprachknoten unter `features.livekit.nodes`.

Das [Sprach-Tutorial](/developers/docs/tutorial-voice) hat einen vollständigen Befehl `/join`.

## Referenz {#reference}

@@2
