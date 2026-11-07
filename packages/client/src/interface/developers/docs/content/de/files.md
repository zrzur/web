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

Jeder Server setzt eigene Limits; `GET /` auf der API listet sie unter `features.limits`. Außer bei `attachments` gehen nur Bilder. Leere Dateien werden abgelehnt (`FileTooSmall`), zu große bekommen `FileTooLarge` mit dem Maximum. Uploads brauchen das Bot-Token; der Tag `decorations` ist nur für das Zrzur-Team.

## Herunterladen {#download}

Dateien kommen von `https://cdn.zrzur.com/{tag}/{file id}/{file name}`. Bilder haben auch Vorschauen unter `/{tag}/{file id}`.

## Mit dem SDK {#with-the-sdk}

@@1

Das [Tutorial zum Hochladen](/developers/docs/tutorial-upload) baut `/report`.
