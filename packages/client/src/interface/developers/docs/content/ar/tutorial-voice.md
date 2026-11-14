# بوت صوتي

يحصل `/join` على تذكرة صوت، ويتصل بالقناة الصوتية إذا ثُبّت `@livekit/rtc-node`.

> يستخدم هذا الدرس `@zrzur/sdk/bot` وهي ليست على npm بعد. انظر [المكتبات](/developers/docs/sdk). كل ما يفعله يعمل دون مكتبة: [ابنِ بوتًا كاملًا](/developers/docs/tutorial-full-bot).

## قبل أن تبدأ {#before-you-start}

أنشئ تطبيقًا وثبّته في سيرفر اختبار واضبط ثلاثة متغيرات بيئة (انظر [شغّل بوتك](/developers/docs/getting-started)):

@@0

## الكود {#the-code}

@@1

شغّله بالأمر `node voice.mjs`.

## جرّبه {#try-it}

شغّل `/join channel:#voice`. يحتاج البوت إلى Connect (وإلى Speak ليُسمع).

## ما يوضحه {#what-it-shows}

- يعيد `POST /channels/{target}/join_call` عنوان LiveKit ورمزًا.
- يمر الصوت نفسه عبر LiveKit، وانظر [الصوت](/developers/docs/voice) لنشر الصوت.
- يغطي اختبارنا الحي خطوة التذكرة من هذا الملف، وفُحص نشر الصوت منفصلًا على سيرفر LiveKit حقيقي.

> تشغّل اختباراتنا هذا الملف بوتًا حقيقيًا على سيرفر اختبار وتتحقق من أنه يجيب.
