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

## Soundboard {#soundboard}

Ein Bot in einem Anruf kann die Sounds des Servers abspielen: `POST /channels/{target}/soundboard/{sound_id}`. Er braucht dort Soundboard verwenden und Sprechen und darf nicht serverweit stummgeschaltet sein; auf einer Bühne spielen nur Sprecher Sounds. Einige Sounds je zehn Sekunden (Kontingent `soundboard_play`). Alle im Anruf bekommen `SoundboardPlay`. Sounds hinzufügen und bearbeiten steht auf der Seite [Server](/developers/docs/servers#soundboard).

## Bühnen {#stages}

Eine Bühne ist ein Sprachkanal mit Sprechern und Zuhörern.

| Anfrage | Was sie tut | Braucht |
| --- | --- | --- |
| `GET /channels/{target}/stage` | Thema, Sprecher und gehobene Hände | |
| `PATCH /channels/{target}/stage` | Das Thema setzen oder löschen | Mitglieder stummschalten |
| `PUT /channels/{target}/stage/speakers/{member}` | Jemandem auf der Bühne das Wort geben; seine Hand geht runter | Mitglieder stummschalten und einen höheren Rang |
| `DELETE /channels/{target}/stage/speakers/{member}` | Einen Sprecher zu den Zuhörern zurückschicken (oder selbst aufhören) | Mitglieder stummschalten und einen höheren Rang, für andere |
| `PUT /channels/{target}/stage/hand` | Um das Wort bitten (alle 20 Sekunden einmal) | Verbinden |
| `DELETE /channels/{target}/stage/hands/{member}` | Eine gehobene Hand senken | Mitglieder stummschalten, für andere |
| `DELETE /channels/{target}/stage` | Die Bühne beenden: alle gehen, Thema, Sprecher und Hände werden gelöscht | Mitglieder stummschalten und Mitglieder verschieben |

Das Gateway sendet `StageUpdate` nur mit dem, was sich geändert hat (`StageChange`). Eine Bühne hat höchstens wenige Sprecher gleichzeitig (`TooManySpeakers`).

## Stream-Vorschauen {#stream-previews}

`GET /channels/{target}/stream_preview/{member}` gibt das neueste Standbild einer Bildschirmübertragung in einem Sprachkanal, den der Bot sieht (braucht Kanal ansehen und Zuhören). Ein Bot, der seinen eigenen Bildschirm teilt, sendet eines mit `PUT /channels/{target}/stream_preview`: ein JPEG oder WebP von höchstens 20 KB, base64, höchstens alle 25 Sekunden (`NoEffect` vorher).

## Clips und Aufnahmen {#capture}

Ein Sprachraum kann Clips und aufgenommene Folgen haben. Jede Stimme ist nur nach Wahl ihres Besitzers dabei, und alle, die den Raum sehen, werden informiert.

| Anfrage | Was sie tut | Braucht |
| --- | --- | --- |
| `GET /channels/{target}/capture` | Ob Clips an sind oder eine Aufnahme läuft, wer dabei ist, was diesen Monat übrig ist | |
| `PUT /channels/{target}/capture/consent` | Wählen, ob die eigene Stimme in Clips und der Aufnahme sein darf, bis man den Raum verlässt | Im Raum sein |
| `PUT /channels/{target}/capture/clips` | Clips ein- oder ausschalten | Kanal verwalten, im Raum sein |
| `POST /channels/{target}/capture/clips` | Einen Clip teilen: zuerst den Ton hochladen (Tag `attachments`), dann hier mit allen nennen, deren Stimme darin ist | Im Raum sein, Clips an |
| `POST /channels/{target}/capture/recording` | Eine Folge aufnehmen | Kanal verwalten; der Server braucht übrige Aufnahmezeit (nach Wings-Stufe) |
| `DELETE /channels/{target}/capture/recording` | Ohne Speichern beenden | Wer sie begann, oder Kanal verwalten |
| `POST /channels/{target}/capture/recording/finish` | Die eigene Aufnahme als Folge speichern (zuerst den Ton hochladen) | Wer sie begann |
| `GET /channels/{target}/capture/items` | Die Clips und Folgen des Raums, die neuesten zuerst | |
| `DELETE /channels/{target}/capture/items/{id}` | Einen Clip oder eine Folge mit Nachricht und Datei entfernen | Wer sie speicherte, wessen Stimme darin ist, oder Nachrichten verwalten |

Das Gateway sendet `VoiceCaptureUpdate` mit dem ganzen Zustand. Zu erwartende Fehler: `VoiceNotAgreed` (jemand Genanntes hat nicht zugestimmt), `TooManyVoiceClips` und `RecordingTimeUsedUp`.

## Referenz {#reference}

@@2
