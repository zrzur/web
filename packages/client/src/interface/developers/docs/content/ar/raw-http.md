# بلا مكتبة

كل ما يفعله البوت هو HTTPS وWebSocket عاديان. تعرض هذه الصفحة الطلبات، لتكتب بوتًا بأي لغة.

## ما تحتاج إليه {#you-will-need}

عميل HTTP وعميل WebSocket. يكفي `curl` للخطوات الأولى. يمثل `YOUR_BOT_TOKEN` رمزك.

## أرسل طلبًا {#request}

@@0

`_id` في الجواب هو معرّف بوتك، وهو أيضًا معرّف تطبيقه.

الأجسام JSON مع `content-type: application/json`. والأجوبة JSON، أو فارغة مع `204`.

## أرسل رسالة {#send}

@@1

## ارفع ملفًا {#upload}

@@2

الجواب هو `{ "id": "FILE_ID" }`. أرسله في `attachments` داخل الرسالة.

## الحلقة كاملة {#loop}

1. `PUT /applications/{application_id}/commands` مع أوامرك.
2. افتح `wss://ws.zrzur.com/?version=1&format=json`.
3. أرسل `{ "type": "Authenticate", "token": "YOUR_BOT_TOKEN", "intents": 33 }`.
4. كل 20 ثانية أرسل `{ "type": "Ping", "data": 1 }`.
5. لكل حزمة: إذا كان `type` يساوي `Bulk` فعالج كل عنصر في `v`.
6. عند `InteractionCreate`، خلال 3 ثوانٍ، `POST /interactions/{interaction_id}/{token}/callback`.
7. عند إغلاق المقبس انتظر وابدأ مجددًا من الخطوة 2.

## Node {#node}

يتضمن Node 22 `fetch` و`WebSocket` جاهزين. هذا بوت كامل في ملف واحد:

@@3

يضيف [البوت الكامل](/developers/docs/tutorial-full-bot) حدود المعدل وإعادة المحاولة وإعادة الاتصال والبيانات المحفوظة.

## Python {#python}

تحتاج Python إلى حزمة `websockets` (`pip install websockets`). وتكفي المكتبة القياسية لـHTTP.

@@4

لا تعيد هذه النسخة القصيرة الاتصال. أضف الحلقة من صفحة [البوابة](/developers/docs/gateway#reconnect).

## أوصاف قابلة للقراءة آليًا {#schemas}

| العنوان                 | ما هو                                    |
| ----------------------- | ---------------------------------------- |
| `GET /openapi.json`     | كل مسارات REST بصيغة OpenAPI 3           |
| `GET /gateway/schema`   | كل أحداث البوابة بصيغة JSON Schema       |
| `GET /`                 | عناوين هذا السيرفر وحدوده                 |

ولّد منها عميلًا بلغتك.

## التالي {#next}

- [ابنِ بوتًا كاملًا](/developers/docs/tutorial-full-bot)
- [الأخطاء](/developers/docs/errors)
