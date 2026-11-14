# Files

Files go to the file server first; messages, avatars and emojis then refer to them by id.

## Upload

```bash
curl -X POST "https://cdn.zrzur.com/attachments" \
  -H "x-bot-token: $ZRZUR_BOT_TOKEN" \
  -F "file=@report.csv;type=text/csv"
```

The answer is `{ "id": "<file id>" }`. Send it in `attachments` of a message, or as `avatar`, `icon`, `banner` or emoji id.

| Tag           | Used for                   | Default size limit |
| ------------- | -------------------------- | ------------------ |
| `attachments` | message files              | 20 MB              |
| `avatars`     | user and bot avatars       | 4 MB               |
| `icons`       | server and channel icons   | 2.5 MB             |
| `banners`     | server and profile banners | 6 MB               |
| `backgrounds` | profile backgrounds        | 6 MB               |
| `emojis`      | custom emojis              | 500 KB             |
| `sounds`      | soundboard sounds          | 512 KB             |

Each server sets its own limits; `GET /` on the API lists them under `features.limits`. `attachments` takes any file and `sounds` takes MP3, OGG or WAV audio of up to 5.2 seconds; every other tag accepts only images. Empty files are refused (`FileTooSmall`), too big ones get `FileTooLarge` with the maximum. Uploads need the bot token; the `decorations` tag is for Zrzur staff only.

## Download

Files are served from `https://cdn.zrzur.com/{tag}/{file id}/{file name}`. Images also have previews at `/{tag}/{file id}`.

## With the SDK

```js
const id = await bot.rest.uploadFile(
  "attachments",
  bytes,
  "report.csv",
  "text/csv",
);
await bot.messages.send(channelId, {
  content: "Report",
  files: [{ name: "report.csv", data: bytes, type: "text/csv" }],
});
```

The [file upload tutorial](/developers/docs/tutorial-upload) builds `/report`.
