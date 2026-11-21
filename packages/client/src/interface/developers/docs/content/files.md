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

## Files people give your bot {#from-people}

A command option of type `Attachment` and a form field `FileUpload` hand your bot files people uploaded. The interaction carries them in `resolved.attachments`, by id, with `tag`, `filename`, `content_type` and `size`. Download them like any file; the SDK has `interaction.attachmentUrl(name)`, `interaction.downloadAttachment(name)` and `interaction.fieldFiles(id)`. Treat what you download as untrusted: check the type and size before you open it.

## Common errors {#errors}

| Error | Cause | Fix |
| --- | --- | --- |
| `401 InvalidSession` | The bot token is wrong or was reset | Use the current token |
| `400 FileTooLarge` | Over the tag's limit; the answer names the maximum | Make the file smaller, or check `features.limits` first |
| `400 FileTooSmall` | An empty file | Send the bytes |
| `400 FileTypeNotAllowed` | Not an image for an image tag, or not MP3, OGG or WAV for `sounds` | Use the tag that fits the file |
| `403 MissingPermission` (when sending) | The bot lacks Upload Files in the channel | Give it the permission |
| `429` | Uploads share the bot's limits | Wait `retry_after` milliseconds |
