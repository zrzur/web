# النشاط المباشر للألعاب والتطبيقات

اعرض «يلعب My Game» مع تفاصيل لعبتك تحت اسم اللاعب، عبر تطبيق زرزور لسطح المكتب على الحاسوب نفسه.

هذه الميزة للألعاب والتطبيقات التي يشغّلها الشخص، لا للبوتات: لا يستطيع أي بوت أن يضبط ما يفعله شخص. لا يخرج شيء من لعبتك عبر الشبكة؛ ينقله تطبيق سطح المكتب، وفقط ما دام الشخص يشارك نشاطه.

## ما تحتاج إليه {#you-will-need}

- Node بالإصدار 22.3 أو أحدث، ثم `npm install @zrzur/sdk` (أو أي لغة تستطيع فتح أنبوب مسمّى أو مقبس Unix).
- تطبيق زرزور لسطح المكتب يعمل على الحاسوب نفسه، مع تفعيل الإعدادات ← النشاط ← «شارك ما تفعله».

## الخطوات {#steps}

1. اختر معرّفاً قصيراً لتطبيقك، مثل `my-game`: حروف وأرقام و`.` و`_` و`-`، بحد أقصى 64 حرفاً.
2. اتصل بـ `new ZrzurRpc({ clientId })` ثم `connect()`. يجد تطبيق سطح المكتب على الأنبوب `zrzur-ipc-0` إلى `zrzur-ipc-9`.
3. استدعِ `setActivity({ details, state, timestamps, buttons })` عندما يتغير شيء في اللعبة.
4. استدعِ `setActivity(null)` لمسحه، و`close()` عند إغلاق اللعبة. الإغلاق يمسحه أيضاً.

## المثال الكامل {#full-example}

```js
// Rich presence from a game: tell the Zrzur desktop app what the player is
// doing, so their friends see "Playing <your game>" with the details.
// Node 22.3 or newer, `npm install @zrzur/sdk`. The Zrzur desktop app must
// be running on the same computer, with "Share what you are doing" on.
import { ZrzurRpc } from "@zrzur/sdk/rpc";

const rpc = new ZrzurRpc({
  clientId: process.env.ZRZUR_RPC_CLIENT_ID ?? "my-game",
});
await rpc.connect();
console.log("Connected to the Zrzur desktop app");

const startedAt = Date.now();
let round = 1;

async function show() {
  await rpc.setActivity({
    name: "My Game",
    details: "Ranked match",
    state: `Round ${round} of 12`,
    timestamps: { start: startedAt },
    buttons: [{ label: "Get the game", url: "https://example.com/my-game" }],
  });
  console.log(`Showing round ${round}`);
}

await show();

// change it when something happens in the game, not on a timer: Zrzur
// takes 5 changes in 20 seconds
const timer = setInterval(async () => {
  round += 1;
  await show();
  if (round === 3) {
    clearInterval(timer);
    await rpc.setActivity(null);
    console.log("Cleared");
    rpc.close();
  }
}, 10_000);
```

شغّله بالأمر `node rich-presence.mjs` وتطبيق سطح المكتب مفتوح.

## ما يجب أن تراه {#what-you-should-see}

```text
Connected to the Zrzur desktop app
Showing round 1
Showing round 2
Showing round 3
Cleared
```

يرى الأصدقاء «يلعب My Game» و«Ranked match» و«Round 1 of 12» والوقت منذ البداية، في قائمة الأعضاء وفي الملف الشخصي.

## النشاط {#the-activity}

| الحقل | الحد | ملاحظات |
| --- | --- | --- |
| `name` | من 1 إلى 128 حرفاً | إن تُرك: يستعمل تطبيق سطح المكتب اسم البرنامج |
| `details`، `state` | 128 حرفاً لكل منهما | سطر واحد لكل منهما |
| `timestamps.start`، `timestamps.end` | ميلي ثانية أو ثانية منذ 1970 | يعرض التطبيق الوقت منذ البداية، أو الوقت المتبقي |
| `assets.large_image`، `assets.small_image` | `https://` فقط | تُعرض عبر وسيط الصور في زرزور؛ مفاتيح الصور الأخرى تُترك |
| `buttons` | زرّان، التسمية 32 حرفاً، روابط `https://` | يرى الناس تحذير الرابط قبل فتحه |
| `type` | 0 يلعب، 1 يبث، 2 يستمع، 3 يشاهد، 5 ينافس | يلعب إن تُرك |

تمر النصوص على قائمة الكلمات في زرزور. النشاط الذي يرفضه السيرفر لا يُعرض، ولا تتلقى لعبتك خطأً بسببه.

## البروتوكول {#the-protocol}

من دون SDK: افتح الأنبوب `\\?\pipe\zrzur-ipc-0` على Windows، أو المقبس `zrzur-ipc-0` في `$XDG_RUNTIME_DIR` (أو `$TMPDIR`) على macOS وLinux. كل إطار رأسه 8 بايتات: رمز العملية ثم طول المحتوى (كلاهما عدد صحيح بطول 32 بت بترتيب little endian)، ثم المحتوى بصيغة JSON بترميز UTF-8.

| رمز العملية | المعنى |
| --- | --- |
| 0 | المصافحة: `{"v":1,"client_id":"my-game"}` |
| 1 | إطار: `{"cmd":"SET_ACTIVITY","nonce":"1","args":{"pid":1234,"activity":{...}}}` |
| 2 | إغلاق |
| 3، 4 | فحص الاتصال والرد عليه |

يرد تطبيق سطح المكتب على المصافحة بإطار `READY`، وعلى كل `SET_ACTIVITY` بإطار يحمل `nonce` نفسه. لا يخبر إطار `READY` تطبيقك أبداً بمن سجّل الدخول. الإطار الذي يتجاوز 64 كيلوبايت، أو أي شيء خارج هذا البروتوكول، يغلق الاتصال.

## الحدود {#limits}

- يقبل السيرفر 5 تغييرات في 20 ثانية لكل شخص. غيّر النشاط عندما تتغير اللعبة، لا بمؤقت.
- يرى الشخص تطبيقك في الإعدادات ← النشاط ← التطبيقات المتصلة، ويستطيع حظره.
- لا يُخزَّن شيء: يزول النشاط عندما يمسحه تطبيقك، أو يُغلَق، أو يصبح الشخص غير متصل.

## الأخطاء الشائعة {#common-errors}

| الخطأ | السبب | الحل |
| --- | --- | --- |
| `The Zrzur desktop app is not running` | لا يجيب أي أنبوب | شغّل تطبيق سطح المكتب، أو حاول لاحقاً |
| `The Zrzur desktop app did not answer` | التطبيق مشغول أو المشاركة متوقفة | حاول لاحقاً؛ لا يُعرض شيء والمشاركة متوقفة |
| `clientId: 1 to 64 letters...` | في المعرّف مسافات أو رموز أخرى | استعمل حروفاً وأرقاماً و`.` أو `_` أو `-` |

## التالي {#next}

- [SDK](/developers/docs/sdk)
- [المستخدمون والأعضاء](/developers/docs/users)
