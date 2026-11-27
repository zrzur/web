# المكتبات

`@zrzur/sdk` هي مكتبة زرزور الرسمية للتطبيقات والبوتات: TypeScript وESM وNode 22.3 أو أحدث (أو Deno 2.2 أو أحدث، أو المتصفح). حزمة واحدة بثلاث نقاط دخول:

| الاستيراد          | ما هو                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `@zrzur/sdk/bot`   | البوتات: الأوامر والأزرار والقوائم والنماذج والإكمال التلقائي والردود الخاصة والمؤجلة والتضمينات والجامعات والرفع |
| `@zrzur/sdk`       | الأساس: عميل HTTP (كل مسار مكتوب من OpenAPI)، والبوابة، وأنواع الواجهة، والأحداث            |
| `@zrzur/sdk/solid` | العميل الحي لتطبيق زرزور (SolidJS): مخازن للسيرفرات والقنوات والرسائل                       |

لا تحتاج إلى SolidJS إلا مع `@zrzur/sdk/solid`، ولا ينزله البوت أبدًا.

ثبّتها من npm، باستخدام Node 22.3 أو أحدث:

@@0

الحزمة هي [‎@zrzur/sdk على npm](https://www.npmjs.com/package/@zrzur/sdk)، ومصدرها في [github.com/zrzur/sdk-js](https://github.com/zrzur/sdk-js). ويعمل البوت أيضًا دون أي مكتبة: [ابنِ بوتًا كاملًا](/developers/docs/tutorial-full-bot) لا يحتاج إلى مكتبة، وفي [بلا مكتبة](/developers/docs/raw-http) كل الطلبات.

## @zrzur/sdk/bot (للبوتات) {#zrzur-sdk-bot-for-bots}

@@1

| المجال          | الدوال                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| الأوامر | `client.command` و`client.component` و`client.modal` و`client.autocomplete` و`client.syncCommands` و`client.fetchCommands` و`client.createCommand` و`client.fetchCommand` و`client.editCommand` و`client.deleteCommand` |
| الردود          | `i.reply` و`i.defer` و`i.update` و`i.deferUpdate` و`i.showModal` و`i.respond` و`i.editReply` و`i.followUp` و`i.deleteReply` |
| الأحداث         | `client.on(type)` و`client.onMessage` و`client.onMemberJoin` و`client.onMemberLeave` و`client.onReaction`  |
| الرسائل | `client.messages.send` و`reply` و`fetch` و`fetchMany` و`edit` و`delete` و`bulkDelete` و`react` و`unreact` و`clearReactions` و`pin` و`unpin` و`pins` |
| الأعضاء         | `client.members.fetch` و`fetchAll` و`edit` و`addRole` و`removeRole` و`timeout` و`kick` و`ban` و`unban`     |
| الأدوار | `client.roles.create` و`edit` و`setPermissions` و`delete` |
| القنوات | `client.channels.fetch` و`create` و`edit` و`delete` و`setPermissions` و`setMemberPermissions` و`createInvite` و`typing` |
| السيرفرات | `client.servers.fetch` و`ensureCategory` |
| المواضيع والمنتديات | `client.threads.create` و`list` و`edit` و`archive` و`reopen`؛ `client.forums.create` و`post` و`posts` و`setTags` |
| الدعوات | `client.invites.create` و`fetch` و`list` و`delete` |
| المستخدمون      | `client.users.fetch` و`openDM` و`sendDM`                                                                   |
| الويب هوك       | `client.webhooks.create` و`list` و`listForServer` و`fetch` و`fetchWithToken` و`edit` و`regenerateToken` و`delete` و`send` و`sendSlack` و`fetchMessage` و`editMessage` و`deleteMessage` |
| الجامعات        | `message.createMessageComponentCollector` و`message.awaitMessageComponent` و`interaction.awaitModalSubmit` |
| الرموز التعبيرية | `client.emojis.list` و`fetch` و`find` و`create` و`delete`                                                 |
| الصوت           | `client.voice.nodes` و`client.voice.join`                                                                  |
| الاتصال | `client.login` و`client.loginHttp` و`client.listen` و`client.destroy` و`client.setStatus` و`client.typing` |
| أي شيء آخر      | `client.rest.get(path)` و`post` و`put` و`patch` و`delete` (مكتوبة لكل مسار)، و`client.rest.uploadFile(tag, data, name, type)` |

تُرمى أخطاء الواجهة بصيغة `ApiError` مع `status` و`type` و`detail`، و`retryAfter` بعد 429. تُنتظر الحدود القصيرة، وبعد الحد العام ينتظر كل طلب حتى يعود. تفتح البوابة حزم `Bulk` وتعيد الاتصال بانتظار متزايد.

تذكر كل نقطة نهاية في هذا المرجع دالة المكتبة التي تستدعيها، إن وُجدت.

## @zrzur/sdk (الأساس) {#zrzur-sdk-the-core}

@@2

استخدمها لأدوات لا تحتاج إلا إلى واجهة HTTP أو البوابة، في أي إطار عمل.

## @zrzur/sdk/solid (للتطبيقات) {#zrzur-sdk-solid-for-apps}

العميل الذي بُني عليه تطبيق زرزور: عميل مستخدم بمخازن حية للسيرفرات والقنوات والرسائل. يستطيع الدخول برمز بوت، لكن ليس فيه واجهة تفاعلات (أوامر ومكوّنات ونماذج). استخدمه لأدوات تتصرف كتطبيق، واستخدم `@zrzur/sdk/bot` للبوتات.

## لغات أخرى {#other-languages}

يصف [مستند واجهة البوتات](/developers/bot-api.openapi.json) كل مسار يستطيع البوت استخدامه بصيغة OpenAPI 3.0، مع الأنواع التي يأخذها ويعيدها. ويصنع منه OpenAPI Generator عميلًا بلغة Python أو Go أو Java أو C# أو Rust أو PHP وغيرها. ويحتاج إلى Java 11 أو أحدث.

@@3

- يتصل العميل بـ `https://api.zrzur.com`، أول سيرفر في المستند. ولسيرفر مستضاف ذاتيًا تعطي العميل عنوانه بدلًا منه.
- يسجّل البوت دخوله بالمخطط `BotToken`، أي الترويسة `x-bot-token`.
- البوابة ليست جزءًا منه. يصف `GET /gateway/schema` أحداثها بصيغة JSON Schema، واتصل بها كما في [البوابة](/developers/docs/gateway).
- `GET /openapi.json` في الواجهة هو الواجهة كلها، ومعها مسارات التطبيق نفسه. ومستند واجهة البوتات هو الجزء الذي يستطيع البوت استدعاءه.
- للغة TypeScript استخدم `@zrzur/sdk`: فهو مولَّد من الواجهة نفسها، ويضيف البوابة وأدوات البوتات.

## دون مكتبة {#without-an-sdk}

كل ميزة هي HTTP وWebSocket عاديان. انظر [بلا مكتبة](/developers/docs/raw-http).
