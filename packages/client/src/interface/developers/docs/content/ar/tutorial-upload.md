# رفع الملفات

ينشئ `/report` ملف CSV وينشره.

> يستخدم هذا الدرس `@zrzur/sdk/bot` التي لا يمكنك تنزيلها بعد. انظر [المكتبات](/developers/docs/sdk). كل ما يفعله يعمل دون مكتبة: [ابنِ بوتًا كاملًا](/developers/docs/tutorial-full-bot).

## قبل أن تبدأ {#before-you-start}

أنشئ تطبيقًا وثبّته في سيرفر اختبار واضبط ثلاثة متغيرات بيئة (انظر [شغّل بوتك](/developers/docs/getting-started)):

@@0

## الكود {#the-code}

@@1

شغّله بالأمر `node upload.mjs`.

## جرّبه {#try-it}

شغّل `/report`. يحتاج البوت إلى Upload Files في تلك القناة.

## ما يوضحه {#what-it-shows}

- تُرفع الملفات إلى سيرفر الملفات أولًا (الوسم `attachments`).
- تحمل الرسالة بعدها المعرّف المعاد في `attachments`.
- يفعل `bot.messages.send(channel, { files })` الخطوتين.

> تشغّل اختباراتنا هذا الملف بوتًا حقيقيًا على سيرفر اختبار وتتحقق من أنه يجيب.
