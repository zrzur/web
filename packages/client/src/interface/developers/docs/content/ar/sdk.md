# المكتبات

`@zrzur/sdk` هي مكتبة زرزور الرسمية للتطبيقات والبوتات: TypeScript وESM وNode 22.3 أو أحدث (أو Deno 2.2 أو أحدث، أو المتصفح). حزمة واحدة بثلاث نقاط دخول:

| الاستيراد          | ما هو                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `@zrzur/sdk/bot`   | البوتات: الأوامر والأزرار والقوائم والنماذج والإكمال التلقائي والردود الخاصة والمؤجلة والتضمينات والجامعات والرفع |
| `@zrzur/sdk`       | الأساس: عميل HTTP (كل مسار مكتوب من OpenAPI)، والبوابة، وأنواع الواجهة، والأحداث            |
| `@zrzur/sdk/solid` | العميل الحي لتطبيق زرزور (SolidJS): مخازن للسيرفرات والقنوات والرسائل                       |

لا تحتاج إلى SolidJS إلا مع `@zrzur/sdk/solid`، ولا ينزله البوت أبدًا.

> **لا يمكنك تثبيتها من npm بعد.** ليست `@zrzur/sdk` على npm، ومصدرها في [github.com/zrzur/sdk-js](https://github.com/zrzur/sdk-js). تعرض هذه الصفحة ما تقدمه. وإلى ذلك الحين ابنِ بـNode وحده: [ابنِ بوتًا كاملًا](/developers/docs/tutorial-full-bot) لا يحتاج إلى مكتبة، وفي [بلا مكتبة](/developers/docs/raw-http) كل الطلبات.

توجد أيضًا `@zrzur/bot`، مكتبة أقدم وأصغر بالواجهة نفسها للبوتات، وهي غير منشورة أيضًا. ينبغي للبوتات الجديدة انتظار `@zrzur/sdk/bot`.

## @zrzur/sdk/bot (للبوتات) {#zrzur-sdk-bot-for-bots}

@@0

| المجال          | الدوال                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| الأوامر         | `client.command` و`client.component` و`client.modal` و`client.autocomplete` و`client.syncCommands` و`client.fetchCommands` |
| الردود          | `i.reply` و`i.defer` و`i.update` و`i.deferUpdate` و`i.showModal` و`i.respond` و`i.editReply` و`i.followUp` و`i.deleteReply` |
| الأحداث         | `client.on(type)` و`client.onMessage` و`client.onMemberJoin` و`client.onMemberLeave` و`client.onReaction`  |
| الرسائل         | `client.messages.send` و`reply` و`fetch` و`fetchMany` و`edit` و`delete` و`bulkDelete` و`react` و`unreact` و`clearReactions` و`pin` و`unpin` |
| الأعضاء         | `client.members.fetch` و`fetchAll` و`edit` و`addRole` و`removeRole` و`timeout` و`kick` و`ban` و`unban`     |
| الأدوار والقنوات | `client.roles.*` و`client.channels.*`                                                                     |
| المستخدمون      | `client.users.fetch` و`openDM` و`sendDM`                                                                   |
| الويب هوك       | `client.webhooks.create` و`list` و`listForServer` و`fetch` و`fetchWithToken` و`edit` و`regenerateToken` و`delete` و`send` و`sendSlack` و`fetchMessage` و`editMessage` و`deleteMessage` |
| الجامعات        | `message.createMessageComponentCollector` و`message.awaitMessageComponent` و`interaction.awaitModalSubmit` |
| الرموز التعبيرية | `client.emojis.list` و`fetch` و`find` و`create` و`delete`                                                 |
| الصوت           | `client.voice.nodes` و`client.voice.join`                                                                  |
| أي شيء آخر      | `client.rest.get(path)` و`post` و`put` و`patch` و`delete` (مكتوبة لكل مسار)، و`client.rest.uploadFile(tag, data, name, type)` |

تُرمى أخطاء الواجهة بصيغة `ApiError` مع `status` و`type` و`detail`، و`retryAfter` بعد 429. تُنتظر الحدود القصيرة، وبعد الحد العام ينتظر كل طلب حتى يعود. تفتح البوابة حزم `Bulk` وتعيد الاتصال بانتظار متزايد.

تذكر كل نقطة نهاية في هذا المرجع دالة المكتبة التي تستدعيها، إن وُجدت.

## @zrzur/sdk (الأساس) {#zrzur-sdk-the-core}

@@1

استخدمها لأدوات لا تحتاج إلا إلى واجهة HTTP أو البوابة، في أي إطار عمل.

## @zrzur/sdk/solid (للتطبيقات) {#zrzur-sdk-solid-for-apps}

العميل الذي بُني عليه تطبيق زرزور: عميل مستخدم بمخازن حية للسيرفرات والقنوات والرسائل. يستطيع الدخول برمز بوت، لكن ليس فيه واجهة تفاعلات (أوامر ومكوّنات ونماذج). استخدمه لأدوات تتصرف كتطبيق، واستخدم `@zrzur/sdk/bot` للبوتات.

## دون مكتبة {#without-an-sdk}

كل ميزة هي HTTP وWebSocket عاديان. انظر [بلا مكتبة](/developers/docs/raw-http).
