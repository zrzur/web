# Dateien

Dateien gehen zuerst auf den Dateiserver; Nachrichten, Avatare und Emojis verweisen dann per ID darauf.

## Hochladen {#upload}

@@0

Die Antwort ist `{ "id": "<file id>" }`. Sende sie in `attachments` einer Nachricht oder als `avatar`, `icon`, `banner` oder Emoji-ID.

| Tag           | Genutzt für                  | Standardlimit |
| ------------- | ---------------------------- | ------------- |
| `attachments` | Nachrichtendateien           | 20 MB         |
| `avatars`     | Benutzer- und Bot-Avatare    | 4 MB          |
| `icons`       | Server- und Kanalsymbole     | 2,5 MB        |
| `banners`     | Server- und Profilbanner     | 6 MB          |
| `backgrounds` | Profilhintergründe           | 6 MB          |
| `emojis`      | Eigene Emojis                | 500 KB        |
| `sounds`      | Soundboard-Sounds            | 512 KB        |

Jeder Server setzt eigene Limits; `GET /` auf der API listet sie unter `features.limits`. `attachments` nimmt jede Datei und `sounds` MP3-, OGG- oder WAV-Audio bis 5.2 Sekunden; jeder andere Tag nimmt nur Bilder. Leere Dateien werden abgelehnt (`FileTooSmall`), zu große bekommen `FileTooLarge` mit dem Maximum. Uploads brauchen das Bot-Token; der Tag `decorations` ist nur für das Zrzur-Team.

## Herunterladen {#download}

Dateien kommen von `https://cdn.zrzur.com/{tag}/{file id}/{file name}`. Bilder haben auch Vorschauen unter `/{tag}/{file id}`.

## Mit dem SDK {#with-the-sdk}

@@1

Das [Tutorial zum Hochladen](/developers/docs/tutorial-upload) baut `/report`.

## Dateien, die Menschen deinem Bot geben {#from-people}

Eine Befehlsoption vom Typ `Attachment` und ein Formularfeld `FileUpload` geben deinem Bot Dateien, die Menschen hochgeladen haben. Die Interaktion trägt sie in `resolved.attachments`, nach ID, mit `tag`, `filename`, `content_type` und `size`. Lade sie wie jede Datei herunter; das SDK hat `interaction.attachmentUrl(name)`, `interaction.downloadAttachment(name)` und `interaction.fieldFiles(id)`. Behandle Heruntergeladenes als nicht vertrauenswürdig: prüfe Typ und Größe, bevor du es öffnest.

## Häufige Fehler {#errors}

| Fehler | Ursache | Lösung |
| --- | --- | --- |
| `401 InvalidSession` | Das Bot-Token ist falsch oder wurde zurückgesetzt | Das aktuelle Token verwenden |
| `400 FileTooLarge` | Über dem Limit des Tags; die Antwort nennt das Maximum | Die Datei verkleinern oder vorher `features.limits` prüfen |
| `400 FileTooSmall` | Eine leere Datei | Den Inhalt senden |
| `400 FileTypeNotAllowed` | Kein Bild für einen Bild-Tag, oder kein MP3, OGG oder WAV für `sounds` | Den passenden Tag nehmen |
| `403 MissingPermission` (beim Senden) | Dem Bot fehlt Dateien hochladen im Kanal | Die Berechtigung geben |
| `429` | Uploads teilen die Limits des Bots | `retry_after` Millisekunden warten |
