// Arabic and German strings for Zrzur's own screens: Discover (page,
// review queue, owner panel) and Home. Same flow as voice-translations.mjs:
// run `lingui extract --locale en`, then `--locale ar --locale de` first;
// this script then starts from the committed catalogs and only adds or
// updates these entries.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

// Product terms: Discover = «اكتشف», server = «سيرفر», bot = «بوت»
const ar = {
  "Discover Zrzur": "اكتشف زرزور",
  "Find communities around your hobbies and interests.":
    "اعثر على مجتمعات تناسب هواياتك واهتماماتك.",
  "Find communities around your hobbies and interests, and bots to add to your servers.":
    "اعثر على مجتمعات تناسب هواياتك واهتماماتك، وعلى بوتات تضيفها إلى سيرفراتك.",
  Servers: "السيرفرات",
  Bots: "البوتات",
  Review: "المراجعة",
  "Search servers": "ابحث عن سيرفر",
  "Search bots": "ابحث عن بوت",
  "{0, plural, one {# member} other {# members}}":
    "{0, plural, zero {لا يوجد أعضاء} one {عضو واحد} two {عضوان} few {# أعضاء} many {# عضوًا} other {# عضو}}",
  "{0, plural, =0 {Not in any servers yet} one {In # server} other {In # servers}}":
    "{0, plural, =0 {ليس في أي سيرفر بعد} one {في سيرفر واحد} two {في سيرفرين} few {في # سيرفرات} many {في # سيرفرًا} other {في # سيرفر}}",
  "No description yet.": "لا يوجد وصف بعد.",
  "Join server": "انضم إلى السيرفر",
  "Open server": "افتح السيرفر",
  "Add to server": "أضف إلى سيرفر",
  "Under review": "قيد المراجعة",
  "Start review": "ابدأ المراجعة",
  Approve: "موافقة",
  Deny: "رفض",
  "Reason shown to the owner (optional)": "السبب الذي سيظهر للمالك (اختياري)",
  "No requests are waiting for review.": "لا توجد طلبات بانتظار المراجعة.",
  "Nothing matches your search.": "لا توجد نتائج تطابق بحثك.",
  "No bots are listed yet. Bot owners can submit theirs from the bot's settings.":
    "لا توجد بوتات معروضة بعد. يمكن لأصحاب البوتات تقديمها من إعدادات البوت.",
  "No servers are listed yet. Server owners can submit theirs from Server settings → Discover.":
    "لا توجد سيرفرات معروضة بعد. يمكن لأصحاب السيرفرات تقديمها من إعدادات السيرفر ← اكتشف.",
  "Discover couldn't be loaded right now.": "تعذّر تحميل «اكتشف» حاليًا.",
  "Load more": "عرض المزيد",
  "Loading…": "جارٍ التحميل…",

  // Discover page (v2)
  "Find your community on Zrzur": "اعثر على مجتمعك في زرزور",
  "Find the right bot for your server": "اعثر على البوت المناسب لسيرفرك",
  "From gaming to study groups, there's a place for everyone.":
    "من الألعاب إلى مجموعات الدراسة، هناك مكان للجميع.",
  "Moderation, music, games and tools, made by the community.":
    "إشراف وموسيقى وألعاب وأدوات من صنع المجتمع.",
  "Popular tags": "وسوم رائجة",
  "Clear search": "مسح البحث",
  "Discover sections": "أقسام «اكتشف»",
  Categories: "الفئات",
  Featured: "مختارات",
  "Browse by category": "تصفّح حسب الفئة",
  "Popular communities": "مجتمعات رائجة",
  "Popular bots": "بوتات رائجة",
  "New on Zrzur": "جديد على زرزور",
  Popular: "الأكثر شعبية",
  New: "الأحدث",
  Sort: "الترتيب",
  "Results for “{0}”": "نتائج البحث عن «{0}»",
  "Clear filter": "إزالة التصفية",
  "Try another word, tag or category.": "جرّب كلمة أو وسماً أو فئة أخرى.",
  "No servers are listed yet.": "لا توجد سيرفرات معروضة بعد.",
  "No bots are listed yet.": "لا توجد بوتات معروضة بعد.",
  "Server owners can submit theirs from Server settings → Discover.":
    "يمكن لأصحاب السيرفرات تقديمها من إعدادات السيرفر ← اكتشف.",
  "Bot owners can submit theirs from the bot's settings.":
    "يمكن لأصحاب البوتات تقديمها من إعدادات البوت.",
  "Own a server?": "لديك سيرفر؟",
  "Made a bot?": "صنعت بوتاً؟",
  "Submit it from Server settings → Discover, add a category and tags, and preview how it looks. You can take it off Discover at any time.":
    "قدّمه من إعدادات السيرفر ← اكتشف، وأضف فئة ووسوماً، وعاين شكله قبل النشر. يمكنك إزالته من «اكتشف» في أي وقت.",
  "Make it public, then submit it from the bot's settings. You can take it off Discover at any time.":
    "اجعله عاماً، ثم قدّمه من إعدادات البوت. يمكنك إزالته من «اكتشف» في أي وقت.",
  "Discover on the web": "«اكتشف» على الويب",
  "About this server": "عن هذا السيرفر",
  "About this bot": "عن هذا البوت",
  Tags: "الوسوم",
  Feature: "تمييز",
  Unfeature: "إلغاء التمييز",

  // Categories
  Gaming: "ألعاب",
  Community: "المجتمع",
  Education: "تعليم",
  "Science & Tech": "علوم وتقنية",
  "Art & Creativity": "فن وإبداع",
  Music: "موسيقى",
  Entertainment: "ترفيه",
  "Anime & Manga": "أنمي ومانغا",
  Sports: "رياضة",
  Science: "علوم",
  Languages: "لغات",
  Moderation: "إشراف",
  Utility: "أدوات",
  Fun: "مرح",
  Games: "ألعاب",
  Social: "تواصل",

  // Review queue
  "Review queue": "قائمة المراجعة",
  "Requests from server and bot owners waiting to be listed.":
    "طلبات من أصحاب السيرفرات والبوتات بانتظار عرضها.",
  "All caught up": "لا شيء بانتظارك",
  "Approve & feature": "موافقة وتمييز",
  ID: "المعرّف",

  // Owner panel (v2)
  "Your server isn't on Discover": "سيرفرك غير معروض في «اكتشف»",
  "Your bot isn't on Discover": "بوتك غير معروض في «اكتشف»",
  "Let people find and join your server. A moderator reviews every request, and you can take it off at any time.":
    "دع الناس يجدون سيرفرك وينضمون إليه. يراجع مشرف كل طلب، ويمكنك إزالته في أي وقت.",
  "Let people find your bot and add it to their servers. A moderator reviews every request, and you can take it off at any time.":
    "دع الناس يجدون بوتك ويضيفونه إلى سيرفراتهم. يراجع مشرف كل طلب، ويمكنك إزالته في أي وقت.",
  "You can still change the details below while you wait.":
    "يمكنك تعديل التفاصيل أدناه أثناء الانتظار.",
  "Changes to the details below show up right away. You can remove it at any time.":
    "تظهر التعديلات على التفاصيل أدناه فوراً. ويمكنك إزالته في أي وقت.",
  "Contact support for more information.": "تواصل مع الدعم لمزيد من المعلومات.",
  "Make your bot public first": "اجعل بوتك عاماً أولاً",
  "Only public bots can be listed, so others can add them to their servers.":
    "تُعرض البوتات العامة فقط، ليتمكن الآخرون من إضافتها إلى سيرفراتهم.",
  Category: "الفئة",
  "Where people browsing Discover will find it.":
    "المكان الذي سيجده فيه من يتصفّح «اكتشف».",
  "Main language": "اللغة الأساسية",
  "Not set": "غير محددة",
  "Up to five words people might search for. Press Enter to add.":
    "حتى خمس كلمات قد يبحث عنها الناس. اضغط Enter للإضافة.",
  "Add a tag": "أضف وسماً",
  "Remove tag {tag}": "إزالة الوسم {tag}",
  "Tags use 2–24 letters, numbers, - or _.":
    "يتكوّن الوسم من 2 إلى 24 حرفاً أو رقماً أو - أو _.",
  "The name, icon, banner and description come from your server's Overview settings.":
    "يُؤخذ الاسم والأيقونة والغلاف والوصف من إعدادات «نظرة عامة» لسيرفرك.",
  "The name, avatar, banner and description come from the bot's profile.":
    "يُؤخذ الاسم والصورة والغلاف والوصف من الملف الشخصي للبوت.",
  "Submit again": "أعد التقديم",
  "Save changes": "حفظ التغييرات",
  "View on Discover": "اعرضه في «اكتشف»",
  "Remove from Discover": "إزالة من «اكتشف»",
  "Cancel request": "إلغاء الطلب",
  "Click again to confirm": "اضغط مجدداً للتأكيد",
  Saved: "تم الحفظ",
  Preview: "معاينة",
  "This is how it will look on Discover.": "هكذا سيظهر في «اكتشف».",

  // Owner panel in server / bot settings
  "This bot is listed on Discover": "هذا البوت معروض في «اكتشف»",
  "This server is listed on Discover": "هذا السيرفر معروض في «اكتشف»",
  "Contact support to remove this bot from Discover":
    "تواصل مع الدعم لإزالة هذا البوت من «اكتشف»",
  "Contact support to remove this server from Discover":
    "تواصل مع الدعم لإزالة هذا السيرفر من «اكتشف»",
  "Your bot is under review": "بوتك قيد المراجعة",
  "Your server is under review": "سيرفرك قيد المراجعة",
  "Check back often to see if your bot has been approved!":
    "تفقّد هذه الصفحة من حين لآخر لترى إن تمت الموافقة على بوتك!",
  "Check back often to see if your server has been approved!":
    "تفقّد هذه الصفحة من حين لآخر لترى إن تمت الموافقة على سيرفرك!",
  "Allow others to join your server from Discover":
    "اسمح للآخرين بالانضمام إلى سيرفرك من «اكتشف»",
  "Allow others to add your bot to their servers from Discover":
    "اسمح للآخرين بإضافة بوتك إلى سيرفراتهم من «اكتشف»",
  "Submit to Discover": "أرسل إلى «اكتشف»",
  "Can't get discover request status right now":
    "تعذّر جلب حالة طلبك في «اكتشف» حاليًا",
  "Cancel discover request": "إلغاء الطلب",
  "Cancel your discover request and remove it from the review queue":
    "ألغِ طلبك وأزِله من قائمة المراجعة",
  "Your discover request has been denied": "رُفض طلبك في «اكتشف»",
  "Your discover request has been removed": "أُزيل طلبك من «اكتشف»",
  "You can request again below": "يمكنك تقديم الطلب مرة أخرى أدناه",

  // Emoji and GIF pickers
  "Find the perfect emoji": "ابحث عن الإيموجي المناسب",
  "Add emoji to this server": "أضف إيموجي إلى هذا السيرفر",
  "Tip: right-click (or hold) any emoji to add it to your favorites.":
    "نصيحة: انقر بزر الفأرة الأيمن (أو اضغط مطوّلًا) على أي إيموجي لإضافته إلى المفضلة.",
  Favorites: "المفضلة",
  Standard: "القياسية",
  "Emoji results": "نتائج الإيموجي",
  "No emoji found": "لم يُعثر على إيموجي",
  "Try another search.": "جرّب بحثًا آخر.",
  "GIF picker": "منتقي GIF",
  "Trending GIFs": "صور GIF الرائجة",
  "Back to categories": "العودة إلى الفئات",
  "Loading GIFs": "جارٍ تحميل صور GIF",
  "No GIFs found": "لم يُعثر على صور GIF",
  "Try a different word or explore the categories.":
    "جرّب كلمة أخرى أو تصفّح الفئات.",
  "Browse categories": "تصفّح الفئات",
  "Send GIF": "إرسال GIF",
  "GIFs aren't available yet": "صور GIF غير متاحة بعد",
  "You can still send emoji in the meantime.":
    "يمكنك إرسال الإيموجي في هذه الأثناء.",
  "Couldn't load GIFs": "تعذّر تحميل صور GIF",
  "The GIF service couldn't be reached. Please try again.":
    "تعذّر الوصول إلى خدمة GIF. يُرجى المحاولة مرة أخرى.",
  "Try again": "حاول مرة أخرى",

  // Voice messages, media player and link safety
  "Voice message": "رسالة صوتية",
  "Record a voice message": "سجّل رسالة صوتية",
  "Send voice message": "إرسال الرسالة الصوتية",
  "Discard recording": "حذف التسجيل",
  "Starting the microphone…": "جارٍ تشغيل الميكروفون…",
  "Microphone access is blocked. Allow it in your browser to record.":
    "الوصول إلى الميكروفون محظور. اسمح به في المتصفح لتتمكن من التسجيل.",
  "This browser can't record voice messages.":
    "لا يدعم هذا المتصفح تسجيل الرسائل الصوتية.",
  "Limit reached": "وصلت إلى الحد الأقصى",
  Unavailable: "غير متاح",
  Play: "تشغيل",
  Pause: "إيقاف مؤقت",
  "Playback position": "موضع التشغيل",
  "This site doesn't use a secure connection (no HTTPS). Others on your network could see or change what you send.":
    "هذا الموقع لا يستخدم اتصالًا آمنًا (بدون HTTPS). يمكن لآخرين على شبكتك رؤية ما ترسله أو تغييره.",
  "This address uses special characters that can imitate another site's name. Check it carefully before you continue.":
    "يستخدم هذا العنوان أحرفًا خاصة قد تقلّد اسم موقع آخر. تحقّق منه جيدًا قبل المتابعة.",

  // Invite dialog and attachment cards
  "Invite friends to {0}": "ادعُ أصدقاءك إلى {0}",
  "Search for friends": "ابحث عن أصدقاء",
  "Add some friends first, or share the link below.":
    "أضف بعض الأصدقاء أولًا، أو شارك الرابط أدناه.",
  "No friends match your search.": "لا يوجد أصدقاء يطابقون بحثك.",
  Invite: "دعوة",
  Sent: "أُرسلت",
  "Or send an invite link to a friend": "أو أرسل رابط دعوة إلى صديق",
  "Invite link": "رابط الدعوة",
  "Generating invite…": "جارٍ إنشاء الدعوة…",
  Copy: "نسخ",
  Copied: "تم النسخ",
  "Your invite link never expires.": "رابط دعوتك لا تنتهي صلاحيته.",
  "Upload file": "رفع ملف",
  "Add file": "إضافة ملف",
  "Sent in the next message": "سيُرسل في الرسالة التالية",
  Spoiler: "حرق",
  "Mark as spoiler": "إخفاء كحرق",
  "Remove spoiler": "إلغاء الإخفاء",
  "Remove {0}": "إزالة {0}",
  Remove: "إزالة",

  // Home
  "Welcome back to Zrzur.": "أهلًا بعودتك إلى زرزور.",
  "Your servers": "سيرفراتك",
  "You haven't joined a server yet. Create one or find one on Discover.":
    "لم تنضم إلى أي سيرفر بعد. أنشئ واحدًا أو ابحث عن واحد في «اكتشف».",
  "Friends online": "الأصدقاء المتصلون",
  "See all": "عرض الكل",
  "No friends online right now": "لا يوجد أصدقاء متصلون الآن",
  "Message {0}": "راسل {0}",
  Download: "تنزيل",

  // Profile look: theme, name style, decorations
  Look: "المظهر",
  "Avatar decoration": "زينة الصورة",
  "Name style": "نمط الاسم",
  "Profile theme": "ألوان الملف الشخصي",
  "Colours your profile card and its banner when you have no picture.":
    "يلوّن بطاقة ملفك الشخصي وغلافها عندما لا تضع صورة.",
  "Main colour": "اللون الأساسي",
  "Second colour": "اللون الثاني",
  "Font {0}": "الخط {0}",
  "Default font": "الخط الافتراضي",
  "Solid colour": "لون واحد",
  "No colour": "بدون لون",
  "Display name style": "نمط اسم العرض",
  "Choose font": "اختر الخط",
  "Choose colour": "اختر اللون",
  Solid: "لون واحد",
  Gradient: "تدرّج",
  "Pick a colour": "اختر لونًا",
  "In a server, a role colour wins over yours, but your font stays.":
    "داخل السيرفر يتقدّم لون الرتبة على لونك، لكن خطك يبقى.",
  "Surprise me": "فاجئني",
  "does anyone read this?": "هل يقرأ أحد هذا؟",
  "Change avatar decoration": "تغيير زينة الصورة",
  "Look at my new decoration": "انظروا إلى زينتي الجديدة",
  now: "الآن",
  "Today at 12:00": "اليوم الساعة 12:00",
  "In a server, a role colour wins over yours, but your font stays. On a profile card with a theme, your name turns white so it stays readable.":
    "داخل السيرفر يتقدّم لون الرتبة على لونك، لكن خطك يبقى. وعلى بطاقة ملف شخصي ملوّنة يصبح اسمك أبيض ليبقى واضحًا.",
  Selected: "المحدّد",
  Apply: "تطبيق",
  Reset: "إعادة ضبط",
  Cancel: "إلغاء",
  None: "بدون",
  Flames: "لهب",
  Headphones: "سماعات",
  Laurel: "غار",
  Snow: "ثلج",
  Hearts: "قلوب",
  Stars: "نجوم",
  Lightning: "برق",
  Glow: "توهّج",
  Fire: "نار",
  Ice: "جليد",
  Gold: "ذهبي",
  Sparkle: "لمعان",
  Galaxy: "مجرّة",
  Neon: "نيون",
  Heartbeat: "نبض",
  Toxic: "سامّ",
  Sunset: "غروب",
  Ocean: "محيط",
  Grape: "عنب",
  Mint: "نعناع",
  Midnight: "منتصف الليل",
  Cherry: "كرز",
  Aurora: "شفق",
  Rose: "ورد",
  Forest: "غابة",
  Candy: "حلوى",

  // Community decorations and nameplates
  Included: "المضمّنة",
  "Community decoration": "زينة من المجتمع",
  // emoji picker categories
  "Open emoji picker": "افتح منتقي الإيموجي",
  "Smileys & people": "الوجوه والأشخاص",
  "Animals & nature": "الحيوانات والطبيعة",
  "Food & drink": "الطعام والشراب",
  "Travel & places": "السفر والأماكن",
  Activities: "الأنشطة",
  Objects: "الأشياء",
  Symbols: "الرموز",
  Flags: "الأعلام",
  // decoration library
  Favourites: "المفضلة",
  Recent: "الأخيرة",
  Rings: "حلقات",
  Elements: "عناصر",
  "Search decorations": "ابحث عن زينة",
  "No decorations match your search.": "لا توجد زينة تطابق بحثك.",
  "Decorations you wear will show up here.": "ستظهر هنا الزينة التي ترتديها.",
  "Tap the heart on a decoration to save it here.":
    "اضغط على القلب في أي زينة لحفظها هنا.",
  "Add to favourites": "أضف إلى المفضلة",
  "Remove from favourites": "أزل من المفضلة",
  "Community nameplate": "لوحة اسم من المجتمع",
  Nameplate: "لوحة الاسم",
  "Change nameplate": "تغيير لوحة الاسم",
  "Your nameplate shows behind your name in member lists.":
    "تظهر لوحة اسمك خلف اسمك في قوائم الأعضاء.",
  Sakura: "ساكورا",
  Ember: "جمر",
  "Search by name": "ابحث بالاسم",
  All: "الكل",
  Mine: "خاصتي",
  Upload: "رفع",
  "Use a PNG, animated PNG, GIF or WebP image.":
    "استخدم صورة PNG أو PNG متحركة أو GIF أو WebP.",
  "That image is too big. The limit is 2.5 MB.":
    "الصورة كبيرة جدًا. الحد الأقصى 2.5 ميغابايت.",
  Name: "الاسم",
  "Only upload images you made or are allowed to share. Anyone can report it, and you can remove it at any time.":
    "ارفع فقط صورًا صنعتها أو يحق لك مشاركتها. يمكن لأي شخص الإبلاغ عنها، ويمكنك حذفها في أي وقت.",
  Publish: "نشر",
  "Publishing…": "جارٍ النشر…",
  "The community gallery couldn't be loaded.": "تعذّر تحميل معرض المجتمع.",
  "Nothing here yet. Be the first to upload one!":
    "لا يوجد شيء بعد. كن أول من يرفع واحدًا!",
  "You haven't uploaded any yet.": "لم ترفع أي شيء بعد.",
  "by @{0}": "بواسطة @{0}",
  "by you": "بواسطتك",
  "Hidden after reports": "مخفي بعد البلاغات",
  Report: "إبلاغ",
  "Remove?": "حذف؟",
  "Report?": "إبلاغ؟",
  // Plugins, OAuth, developer portal and server home
  "{0} installs.": "عدد مرات التثبيت: {0}.",
  "{0} plugin panel": "لوحة الإضافة {0}",
  "A secret exists. Resetting it stops the old one at once.":
    "يوجد مفتاح سري. إعادة تعيينه توقف المفتاح القديم فورًا.",
  Accessibility: "إمكانية الوصول",
  "Add commands": "إضافة أوامر",
  "Add its bot to a server you manage": "إضافة البوت التابع له إلى سيرفر تديره",
  "Add keyboard shortcuts": "إضافة اختصارات لوحة المفاتيح",
  "After you decide you will go to {0}. You can revoke this at any time under Authorized apps.":
    "بعد أن تقرر ستنتقل إلى {0}. يمكنك إلغاء هذا الإذن في أي وقت من «التطبيقات المصرّح لها».",
  "Allow {0} to do the things listed above? You can turn it off or uninstall it at any time.":
    "هل تسمح لـ {0} بالقيام بما سبق؟ يمكنك إيقافها أو إلغاء تثبيتها في أي وقت.",
  "Allow and install": "السماح والتثبيت",
  "Allow and update": "السماح والتحديث",
  "App version, platform and plugin timings, in development builds only.":
    "إصدار التطبيق والمنصة وتوقيتات الإضافات، في نسخ التطوير فقط.",
  "Applied whenever this plugin runs.": "تُطبَّق كلما عملت هذه الإضافة.",
  "Apps you allowed to use your account. Revoking one ends its access at once; bots it added stay in servers until their managers remove them.":
    "التطبيقات التي سمحت لها باستخدام حسابك. إلغاء أحدها ينهي وصوله فورًا، أما البوتات التي أضافها فتبقى في السيرفرات حتى يزيلها مديروها.",
  "Assign roles": "منح الأدوار",
  "Authorization URL": "رابط التفويض",
  Authorize: "تفويض",
  "Authorized apps": "التطبيقات المصرّح لها",
  "Ban members": "حظر الأعضاء",
  Browse: "تصفّح",
  "Browse plugins": "تصفّح الإضافات",
  "Browse reviewed plugins to add one.":
    "تصفّح الإضافات التي تمت مراجعتها لتضيف واحدة منها.",
  "Build a plugin": "أنشئ إضافة",
  "Can't continue": "لا يمكن المتابعة",
  "Can't run": "لا يمكن تشغيلها",
  "Change colours": "تغيير الألوان",
  "Change how notifications look": "تغيير شكل الإشعارات",
  "Change text and motion": "تغيير النص والحركة",
  "Changes how notifications are shown": "تغيّر طريقة عرض الإشعارات",
  "Channels you can see will show up here once they are added.":
    "ستظهر هنا القنوات التي يمكنك رؤيتها عند إضافتها.",
  "Check for updates": "البحث عن تحديثات",
  "Choose a `.zplugin.json` package (or a manifest) to check it, preview it on this device, or submit it for review.":
    "اختر حزمة `.zplugin.json` (أو ملف manifest) لفحصها، أو معاينتها على هذا الجهاز، أو تقديمها للمراجعة.",
  "Choose a plugin package": "اختر حزمة إضافة",
  "Choose a server…": "اختر سيرفرًا…",
  "Clears its error history and starts it again.":
    "يمسح سجل أخطائها ويشغّلها من جديد.",
  "Client ID": "معرّف العميل (Client ID)",
  "Client secret": "المفتاح السري للعميل (Client secret)",
  "Code from third-party publishers can't run on Zrzur yet.":
    "لا يمكن تشغيل كود الناشرين الخارجيين على زرزور بعد.",
  "Commands you run from its page or a shortcut.":
    "أوامر تشغّلها من صفحتها أو باختصار.",
  "Confirm revoke": "تأكيد الإلغاء",
  "Connect to voice": "الاتصال بالقنوات الصوتية",
  "Create a channel so members have a place to talk.":
    "أنشئ قناة ليكون للأعضاء مكان للحديث.",
  "Create a plugin with this id first.": "أنشئ إضافة بهذا المعرّف أولًا.",
  "Create plugin": "إنشاء إضافة",
  "Create secret": "إنشاء مفتاح سري",
  Developer: "المطوّر",
  "Developer tools": "أدوات المطوّرين",
  "Enabled · not running": "مفعّلة · لا تعمل",
  "Every plugin here was reviewed by Zrzur. Check what each one asks for before you install it.":
    "راجع زرزور كل إضافة هنا. تحقّق مما تطلبه كل واحدة قبل تثبيتها.",
  Failed: "فشلت",
  "Hide code": "إخفاء الكود",
  "High risk": "خطورة عالية",
  "I checked who the publisher is: mark them verified":
    "تحقّقت من هوية الناشر: وثّقه",
  "I read the code and every permission, and it's safe to run.":
    "قرأت الكود وكل الصلاحيات، وتشغيلها آمن.",
  "If an account uses this address, we've sent it a link to choose a new password. Please allow up to 10 minutes for it to arrive.":
    "إذا كان هناك حساب يستخدم هذا العنوان، فقد أرسلنا إليه رابطًا لاختيار كلمة مرور جديدة. قد يستغرق وصوله حتى 10 دقائق.",
  "Insert text in your message box": "إدراج نص في مربع الرسالة",
  Install: "تثبيت",
  "Install, turn on and manage reviewed plugins.":
    "ثبّت الإضافات التي تمت مراجعتها، وفعّلها، وأدِرها.",
  Installed: "المثبّتة",
  "Interface colours only. Warning colours can't change and text must stay readable.":
    "ألوان الواجهة فقط. لا يمكن تغيير ألوان التحذير، ويجب أن يبقى النص مقروءًا.",
  "It can't send anything: you decide whether to send.":
    "لا يمكنها إرسال أي شيء: أنت من يقرر الإرسال.",
  "It crashed.": "تعطّلت.",
  "It kept taking too long to respond.":
    "استغرقت وقتًا طويلًا في الاستجابة أكثر من مرة.",
  "It needs your permission again.": "تحتاج إلى إذنك مرة أخرى.",
  "It sent too many requests and was stopped.":
    "أرسلت طلبات كثيرة جدًا فأُوقفت.",
  "It sent too much data at once and was stopped.":
    "أرسلت بيانات كثيرة جدًا دفعة واحدة فأُوقفت.",
  "It stopped responding and was stopped.": "توقفت عن الاستجابة فأُوقفت.",
  "It took too long to start.": "استغرقت وقتًا طويلًا في البدء.",
  "Its code didn't match the reviewed version, so it was blocked.":
    "لم يطابق كودها النسخة التي تمت مراجعتها، فحُظرت.",
  "Its own panels made of text, buttons and switches, always labelled with its name.":
    "لوحات خاصة بها من نصوص وأزرار ومفاتيح تبديل، تحمل اسمها دائمًا.",
  "Kept on this device only. No messages or personal data are recorded.":
    "تُحفظ على هذا الجهاز فقط. لا تُسجَّل أي رسائل أو بيانات شخصية.",
  "Kick members": "طرد الأعضاء",
  "Know which channel you open": "معرفة القناة التي تفتحها",
  "Know your username and avatar": "معرفة اسم المستخدم والصورة الرمزية",
  "Let its commands be used in the server": "السماح باستخدام أوامره في السيرفر",
  "Loading plugins…": "جارٍ تحميل الإضافات…",
  "Local previews": "المعاينات المحلية",
  "Low risk": "خطورة منخفضة",
  "Made for a different plugin API.":
    "صُممت لواجهة برمجية (API) مختلفة للإضافات.",
  "Manage channels": "إدارة القنوات",
  "Manage messages": "إدارة الرسائل",
  "Manage nicknames": "إدارة الألقاب",
  "Manage permissions": "إدارة الصلاحيات",
  "Manage roles": "إدارة الأدوار",
  "Manage server": "إدارة السيرفر",
  "Manage webhooks": "إدارة الويب هوك",
  Manifest: "ملف التعريف (Manifest)",
  "Medium risk": "خطورة متوسطة",
  "Mention everyone": "الإشارة إلى الجميع",
  "Needs a newer version of Zrzur.": "تحتاج إلى إصدار أحدث من زرزور.",
  "Needs no permissions.": "لا تحتاج إلى أي صلاحيات.",
  "Never shortcuts Zrzur or your browser already use.":
    "لا تستخدم أبدًا اختصارات يستخدمها زرزور أو متصفحك.",
  "New message": "رسالة جديدة",
  "New plugin": "إضافة جديدة",
  "New secret: copy it now, it is not shown again":
    "مفتاح سري جديد: انسخه الآن، فلن يظهر مرة أخرى",
  "No apps yet.": "لا توجد تطبيقات بعد.",
  "No changelog.": "لا يوجد سجل تغييرات.",
  "No plugin matches that": "لا توجد إضافة تطابق ذلك",
  "No plugin runs until you turn Safe Mode off.":
    "لن تعمل أي إضافة حتى توقف الوضع الآمن.",
  "No plugins are published yet": "لم تُنشر أي إضافات بعد",
  "No plugins yet": "لا توجد إضافات بعد",
  "No secret yet: the app is a public client and must use PKCE (it always must).":
    "لا يوجد مفتاح سري بعد: التطبيق عميل عام ويجب أن يستخدم PKCE (وهذا مطلوب دائمًا).",
  "Not available on this device.": "غير متاحة على هذا الجهاز.",
  "Not connected to voice": "غير متصل بالصوت",
  "Not supported by this version of Zrzur.":
    "غير مدعومة في هذا الإصدار من زرزور.",
  "Not supported here": "غير مدعومة هنا",
  "Note to the publisher (required to reject)": "ملاحظة للناشر (مطلوبة للرفض)",
  "Nothing is waiting for review.": "لا يوجد شيء بانتظار المراجعة.",
  OAuth2: "OAuth2",
  Official: "رسمية",
  "Only the one message you choose its action on, and only at that moment.":
    "الرسالة الواحدة التي تختار تنفيذ إجرائها عليها فقط، وفي تلك اللحظة فقط.",
  "Other permissions": "صلاحيات أخرى",
  Package: "الحزمة",
  "Permissions it asks for": "الصلاحيات التي تطلبها",
  "Permissions you granted": "الصلاحيات التي منحتها",
  "Plugin · {0}": "إضافة · {0}",
  "Plugin id (like yourname.my-plugin)":
    "معرّف الإضافة (مثل yourname.my-plugin)",
  "Plugin sections": "أقسام الإضافات",
  "Plugin settings": "إعدادات الإضافة",
  "Plugins add themes, shortcuts and tools to Zrzur. Every plugin is reviewed by Zrzur before you can install it, asks for each permission it needs, and runs isolated from your account: no plugin can see your password, session or private messages.":
    "تضيف الإضافات سمات واختصارات وأدوات إلى زرزور. يراجع زرزور كل إضافة قبل أن تتمكن من تثبيتها، وتطلب كل إضافة كل صلاحية تحتاجها، وتعمل معزولة عن حسابك: لا يمكن لأي إضافة أن ترى كلمة مرورك أو جلستك أو رسائلك الخاصة.",
  "Plugins can't read hidden channels, bypass server permissions, use bot tokens or reach your files. A crashing plugin is stopped without affecting chat, voice or screen sharing.":
    "لا يمكن للإضافات قراءة القنوات المخفية، ولا تجاوز صلاحيات السيرفر، ولا استخدام رموز البوتات، ولا الوصول إلى ملفاتك. وإذا تعطّلت إضافة فإنها تُوقَف دون أن تتأثر الدردشة أو الصوت أو مشاركة الشاشة.",
  "Preview · not installed · gone after reload":
    "معاينة · غير مثبّتة · تختفي بعد إعادة التحميل",
  "Preview here": "معاينة هنا",
  "Previewing code plugins needs a development build of Zrzur.":
    "تحتاج معاينة الإضافات البرمجية إلى نسخة تطوير من زرزور.",
  "Previewing on this device only. Find it under Installed → Local previews.":
    "معاينة على هذا الجهاز فقط. تجدها في «المثبّتة» ← «المعاينات المحلية».",
  Productivity: "الإنتاجية",
  "Publisher:": "الناشر:",
  Quarantined: "معزولة",
  "Quiet hours, hidden previews and muted sounds. It never reads your notifications.":
    "ساعات الهدوء، وإخفاء المعاينات، وكتم الأصوات. لا تقرأ إشعاراتك أبدًا.",
  "Read a message you pick": "قراءة رسالة تختارها",
  "Read diagnostics": "قراءة بيانات التشخيص",
  "Read message history": "قراءة سجل الرسائل",
  "Read the manifest, every permission and any code before approving. High-risk releases need an explicit confirmation. You can't approve your own plugin.":
    "اقرأ ملف التعريف وكل صلاحية وأي كود قبل الموافقة. الإصدارات عالية الخطورة تحتاج إلى تأكيد صريح. لا يمكنك الموافقة على إضافتك أنت.",
  "Reading and motion changes": "تغييرات القراءة والحركة",
  "Reason (required)": "السبب (مطلوب)",
  "Recent problems": "المشكلات الأخيرة",
  "Redirect URIs (one per line, https or http://localhost)":
    "روابط إعادة التوجيه (رابط في كل سطر، https أو http://localhost)",
  "Reinstate plugin": "إعادة الإضافة",
  "Removes it, its permissions and its settings.":
    "يزيلها ويزيل صلاحياتها وإعداداتها.",
  "Report this plugin": "الإبلاغ عن هذه الإضافة",
  "Reset secret": "إعادة تعيين المفتاح السري",
  "Review and update": "المراجعة والتحديث",
  "Review history": "سجل المراجعة",
  "Review status: {0}": "حالة المراجعة: {0}",
  "Reviewed and approved by Zrzur on {0}.":
    "راجعها زرزور ووافق عليها في {0}.",
  "Reviewer actions": "إجراءات المراجِع",
  "Revoke access": "إلغاء الوصول",
  "Revoke v{0}": "إلغاء الإصدار v{0}",
  Run: "تشغيل",
  "Run plugins": "تشغيل الإضافات",
  Running: "تعمل",
  "Running now.": "تعمل الآن.",
  "Runs code in an isolated sandbox with no network, no access to the page and limited time and messages.":
    "تشغّل الكود في بيئة معزولة بلا شبكة، ولا وصول إلى الصفحة، وبوقت ورسائل محدودة.",
  "Safe Mode is on": "الوضع الآمن مفعّل",
  "Safe Mode is on, so no plugin runs.":
    "الوضع الآمن مفعّل، لذا لا تعمل أي إضافة.",
  "Safe Mode is on: no plugin runs. Your plugins and their settings are kept.":
    "الوضع الآمن مفعّل: لا تعمل أي إضافة. تبقى إضافاتك وإعداداتها محفوظة.",
  "Save its settings": "حفظ إعداداتها",
  "Save redirect URIs": "حفظ روابط إعادة التوجيه",
  "Scanner notes for the reviewer:": "ملاحظات الفاحص الآلي للمراجِع:",
  "Search plugins": "البحث في الإضافات",
  "See the names and icons of your servers": "رؤية أسماء سيرفراتك وأيقوناتها",
  "Send embeds": "إرسال محتوى مضمّن",
  "Send messages": "إرسال الرسائل",
  "Send users to /oauth2/authorize with client_id, redirect_uri, response_type=code, scope (identify, servers.read, applications.commands, bot.install), state, code_challenge and code_challenge_method=S256. Exchange the code at POST /oauth2/token. Codes last 10 minutes, access tokens 1 hour, refresh tokens 30 days.":
    "وجّه المستخدمين إلى /oauth2/authorize مع: client_id، وredirect_uri، وresponse_type=code، وscope (identify، servers.read، applications.commands، bot.install)، وstate، وcode_challenge، وcode_challenge_method=S256. ثم استبدل الرمز عبر POST /oauth2/token. صلاحية الرموز 10 دقائق، ورموز الوصول ساعة واحدة، ورموز التحديث 30 يومًا.",
  "Short in-app notices that start with its name.":
    "إشعارات قصيرة داخل التطبيق تبدأ باسمها.",
  "Show code": "عرض الكود",
  "Show notices": "عرض الإشعارات",
  "Show panels": "عرض اللوحات",
  "Something went wrong ({id}).": "حدث خطأ ما ({id}).",
  "Starting…": "جارٍ التشغيل…",
  Stop: "إيقاف",
  "Stopped after repeated errors.": "أُوقفت بعد أخطاء متكررة.",
  "Submitted. A Zrzur reviewer will look at it; you'll see the result here.":
    "تم التقديم. سيراجعها أحد مراجعي زرزور، وسترى النتيجة هنا.",
  "Suspend plugin": "تعليق الإضافة",
  "Suspend publisher": "تعليق الناشر",
  "Switch compact mode on or off when you run its command.":
    "تشغيل الوضع المضغوط أو إيقافه عند تنفيذ أمرها.",
  "Switch to a safe version": "التبديل إلى نسخة آمنة",
  "Tell Zrzur if it misbehaves, misleads or looks unsafe.":
    "أخبر زرزور إذا أساءت التصرف أو كانت مضلِّلة أو بدت غير آمنة.",
  "Text size, spacing, link underlines, focus rings and animations.":
    "حجم النص، والتباعد، وتسطير الروابط، وحلقات التركيز، والحركات.",
  "Thanks, Zrzur will look at it.": "شكرًا لك، سيراجعها زرزور.",
  "That file is too large for a plugin package.":
    "هذا الملف أكبر من الحجم المسموح لحزمة إضافة.",
  "That file isn't valid JSON.": "هذا الملف ليس JSON صالحًا.",
  "The bot is already in that server.": "البوت موجود في ذلك السيرفر بالفعل.",
  "The bot's permissions there:": "صلاحيات البوت هناك:",
  "The id and name of channels you open, only ones you can already see.":
    "معرّف القنوات التي تفتحها واسمها، ومن القنوات التي يمكنك رؤيتها أصلًا فقط.",
  "The plugin store couldn't be loaded": "تعذّر تحميل متجر الإضافات",
  "Theme colours": "ألوان السمة",
  "This account can't publish plugins": "لا يمكن لهذا الحساب نشر الإضافات",
  "This authorization link is not valid.": "رابط التفويض هذا غير صالح.",
  "This browser can't run it safely.": "لا يستطيع هذا المتصفح تشغيلها بأمان.",
  "This link is invalid or has already been used. Request a new one if your account still needs verifying.":
    "هذا الرابط غير صالح أو استُخدم من قبل. اطلب رابطًا جديدًا إذا كان حسابك لا يزال يحتاج إلى التحقق.",
  "This plugin isn't available": "هذه الإضافة غير متاحة",
  "This plugin was removed from Zrzur. You can only uninstall it.":
    "أُزيلت هذه الإضافة من زرزور. يمكنك إلغاء تثبيتها فقط.",
  "This server has no channels yet": "لا توجد قنوات في هذا السيرفر بعد",
  "This version asks for new permissions:": "يطلب هذا الإصدار صلاحيات جديدة:",
  "This version isn't approved.": "هذا الإصدار غير معتمد.",
  "This version was revoked for safety and won't run again.":
    "أُلغي هذا الإصدار لأسباب أمنية ولن يعمل مرة أخرى.",
  "This will allow it to:": "سيسمح له هذا بما يلي:",
  "Time out members": "إيقاف الأعضاء مؤقتًا",
  "Toggle compact mode": "تبديل الوضع المضغوط",
  "Turn off to start Safe Mode, which stops every plugin at once. You can also add this to the address:":
    "أوقف هذا الخيار لتشغيل الوضع الآمن، الذي يوقف كل الإضافات دفعة واحدة. يمكنك أيضًا إضافة هذا إلى العنوان:",
  "Turned off.": "متوقفة.",
  Uninstall: "إلغاء التثبيت",
  "Uninstall the store version first to preview this one.":
    "ألغِ تثبيت نسخة المتجر أولًا لمعاينة هذه النسخة.",
  "Up to 8 KB of its own settings, kept with your account.":
    "حتى 8 كيلوبايت من إعداداتها الخاصة، تُحفظ مع حسابك.",
  Update: "تحديث",
  "Update available": "يتوفر تحديث",
  "Updating…": "جارٍ التحديث…",
  "Upload files": "رفع الملفات",
  "Use the Zrzur plugin SDK: `zrzur-plugin init` makes a project, `validate` checks it and `pack` makes the package you upload here. Plugins describe what they add in a manifest; only official Zrzur plugins can include code for now.":
    "استخدم أداة تطوير الإضافات في زرزور (SDK): الأمر `zrzur-plugin init` ينشئ مشروعًا، و`validate` يفحصه، و`pack` ينشئ الحزمة التي ترفعها هنا. تصف الإضافات ما تضيفه في ملف تعريف (manifest)، ولا يمكن حاليًا أن تحتوي على كود إلا إضافات زرزور الرسمية.",
  "Valid · {0}": "صالحة · {0}",
  "Verified publisher": "ناشر موثّق",
  Versions: "الإصدارات",
  "View channels": "عرض القنوات",
  "wants to access your Zrzur account": "يريد الوصول إلى حسابك في زرزور",
  "What changed (shown to users)": "ما الذي تغيّر (يظهر للمستخدمين)",
  "What it adds": "ما الذي تضيفه",
  "What's wrong?": "ما المشكلة؟",
  Withdraw: "سحب",
  "Yes, uninstall": "نعم، ألغِ التثبيت",
  "You can't give the bot permissions you don't have in that server.":
    "لا يمكنك منح البوت صلاحيات لا تملكها أنت في ذلك السيرفر.",
  "You don't manage any server it can be added to.":
    "لا تدير أي سيرفر يمكن إضافته إليه.",
  "You haven't created a plugin yet": "لم تنشئ أي إضافة بعد",
  "You joined voice from another tab or device.":
    "انضممت إلى الصوت من علامة تبويب أخرى أو جهاز آخر.",
  "You were disconnected from voice.": "انقطع اتصالك بالصوت.",
  "Your plugins": "إضافاتك",
  "Your publishing is suspended": "تم تعليق صلاحية النشر لديك",
  "Zrzur started in Safe Mode because it didn't start properly with plugins last time. Turn Safe Mode off in Settings → Advanced → Plugins.":
    "بدأ زرزور في الوضع الآمن لأنه لم يبدأ بشكل صحيح مع الإضافات في المرة السابقة. أوقف الوضع الآمن من الإعدادات ← متقدم ← الإضافات.",
  "Zrzur suspended this plugin while it's being reviewed.":
    "علّق زرزور هذه الإضافة أثناء مراجعتها.",
};

// German, for the same entries
const de = {
  "Discover Zrzur": "Zrzur entdecken",
  "Find communities around your hobbies and interests.":
    "Finde Communities rund um deine Hobbys und Interessen.",
  "Find communities around your hobbies and interests, and bots to add to your servers.":
    "Finde Communities rund um deine Hobbys und Interessen und Bots für deine Server.",
  Servers: "Server",
  Bots: "Bots",
  Review: "Prüfen",
  "Search servers": "Server suchen",
  "Search bots": "Bots suchen",
  "{0, plural, one {# member} other {# members}}":
    "{0, plural, one {# Mitglied} other {# Mitglieder}}",
  "{0, plural, =0 {Not in any servers yet} one {In # server} other {In # servers}}":
    "{0, plural, =0 {Noch auf keinem Server} one {Auf # Server} other {Auf # Servern}}",
  "No description yet.": "Noch keine Beschreibung.",
  "Join server": "Server beitreten",
  "Open server": "Server öffnen",
  "Add to server": "Zu Server hinzufügen",
  "Under review": "Wird geprüft",
  "Start review": "Prüfung starten",
  Approve: "Annehmen",
  Deny: "Ablehnen",
  "Reason shown to the owner (optional)":
    "Begründung für den Besitzer (optional)",
  "No requests are waiting for review.": "Keine Anfragen warten auf Prüfung.",
  "Nothing matches your search.": "Nichts passt zu deiner Suche.",
  "No bots are listed yet. Bot owners can submit theirs from the bot's settings.":
    "Noch keine Bots gelistet. Bot-Besitzer können ihre in den Bot-Einstellungen einreichen.",
  "No servers are listed yet. Server owners can submit theirs from Server settings → Discover.":
    "Noch keine Server gelistet. Server-Besitzer können ihre unter Servereinstellungen → Entdecken einreichen.",
  "Discover couldn't be loaded right now.":
    "Entdecken konnte gerade nicht geladen werden.",
  "Load more": "Mehr laden",
  "Loading…": "Wird geladen…",
  "Find your community on Zrzur": "Finde deine Community auf Zrzur",
  "Find the right bot for your server":
    "Finde den passenden Bot für deinen Server",
  "From gaming to study groups, there's a place for everyone.":
    "Von Gaming bis Lerngruppen: Hier ist Platz für alle.",
  "Moderation, music, games and tools, made by the community.":
    "Moderation, Musik, Spiele und Tools aus der Community.",
  "Popular tags": "Beliebte Tags",
  "Clear search": "Suche leeren",
  "Discover sections": "Bereiche von Entdecken",
  Categories: "Kategorien",
  Featured: "Empfohlen",
  "Browse by category": "Nach Kategorie stöbern",
  "Popular communities": "Beliebte Communities",
  "Popular bots": "Beliebte Bots",
  "New on Zrzur": "Neu auf Zrzur",
  Popular: "Beliebt",
  New: "Neu",
  Sort: "Sortierung",
  "Results for “{0}”": "Ergebnisse für „{0}“",
  "Clear filter": "Filter entfernen",
  "Try another word, tag or category.":
    "Versuch es mit einem anderen Wort, Tag oder einer anderen Kategorie.",
  "No servers are listed yet.": "Noch keine Server gelistet.",
  "No bots are listed yet.": "Noch keine Bots gelistet.",
  "Server owners can submit theirs from Server settings → Discover.":
    "Server-Besitzer können ihre unter Servereinstellungen → Entdecken einreichen.",
  "Bot owners can submit theirs from the bot's settings.":
    "Bot-Besitzer können ihre in den Bot-Einstellungen einreichen.",
  "Own a server?": "Du hast einen Server?",
  "Made a bot?": "Du hast einen Bot gebaut?",
  "Submit it from Server settings → Discover, add a category and tags, and preview how it looks. You can take it off Discover at any time.":
    "Reiche ihn unter Servereinstellungen → Entdecken ein, wähle Kategorie und Tags und sieh dir die Vorschau an. Du kannst ihn jederzeit wieder entfernen.",
  "Make it public, then submit it from the bot's settings. You can take it off Discover at any time.":
    "Mach ihn öffentlich und reiche ihn dann in den Bot-Einstellungen ein. Du kannst ihn jederzeit wieder entfernen.",
  "Discover on the web": "Entdecken im Web",
  "About this server": "Über diesen Server",
  "About this bot": "Über diesen Bot",
  Tags: "Tags",
  Feature: "Empfehlen",
  Unfeature: "Nicht mehr empfehlen",
  Gaming: "Gaming",
  Community: "Community",
  Education: "Bildung",
  "Science & Tech": "Wissenschaft & Technik",
  "Art & Creativity": "Kunst & Kreativität",
  Music: "Musik",
  Entertainment: "Unterhaltung",
  "Anime & Manga": "Anime & Manga",
  Sports: "Sport",
  Science: "Wissenschaft",
  Languages: "Sprachen",
  Moderation: "Moderation",
  Utility: "Werkzeuge",
  Fun: "Spaß",
  Games: "Spiele",
  Social: "Soziales",
  "Review queue": "Prüfwarteschlange",
  "Requests from server and bot owners waiting to be listed.":
    "Anfragen von Server- und Bot-Besitzern, die auf die Listung warten.",
  "All caught up": "Alles erledigt",
  "Approve & feature": "Annehmen & empfehlen",
  ID: "ID",
  "Your server isn't on Discover": "Dein Server ist nicht in Entdecken",
  "Your bot isn't on Discover": "Dein Bot ist nicht in Entdecken",
  "Let people find and join your server. A moderator reviews every request, and you can take it off at any time.":
    "Lass andere deinen Server finden und beitreten. Jede Anfrage wird von einem Moderator geprüft, und du kannst ihn jederzeit entfernen.",
  "Let people find your bot and add it to their servers. A moderator reviews every request, and you can take it off at any time.":
    "Lass andere deinen Bot finden und zu ihren Servern hinzufügen. Jede Anfrage wird von einem Moderator geprüft, und du kannst ihn jederzeit entfernen.",
  "You can still change the details below while you wait.":
    "Während du wartest, kannst du die Angaben unten noch ändern.",
  "Changes to the details below show up right away. You can remove it at any time.":
    "Änderungen an den Angaben unten sind sofort sichtbar. Du kannst ihn jederzeit entfernen.",
  "Contact support for more information.":
    "Wende dich für mehr Informationen an den Support.",
  "Make your bot public first": "Mach deinen Bot zuerst öffentlich",
  "Only public bots can be listed, so others can add them to their servers.":
    "Nur öffentliche Bots können gelistet werden, damit andere sie hinzufügen können.",
  Category: "Kategorie",
  "Where people browsing Discover will find it.":
    "Wo Leute ihn beim Stöbern in Entdecken finden.",
  "Main language": "Hauptsprache",
  "Not set": "Nicht festgelegt",
  "Up to five words people might search for. Press Enter to add.":
    "Bis zu fünf Suchbegriffe. Mit Enter hinzufügen.",
  "Add a tag": "Tag hinzufügen",
  "Remove tag {tag}": "Tag {tag} entfernen",
  "Tags use 2–24 letters, numbers, - or _.":
    "Tags bestehen aus 2–24 Buchstaben, Zahlen, - oder _.",
  "The name, icon, banner and description come from your server's Overview settings.":
    "Name, Symbol, Banner und Beschreibung stammen aus der Übersicht deiner Servereinstellungen.",
  "The name, avatar, banner and description come from the bot's profile.":
    "Name, Avatar, Banner und Beschreibung stammen aus dem Profil des Bots.",
  "Submit again": "Erneut einreichen",
  "Save changes": "Änderungen speichern",
  "View on Discover": "In Entdecken ansehen",
  "Remove from Discover": "Aus Entdecken entfernen",
  "Cancel request": "Anfrage zurückziehen",
  "Click again to confirm": "Zum Bestätigen erneut klicken",
  Saved: "Gespeichert",
  Preview: "Vorschau",
  "This is how it will look on Discover.": "So wird er in Entdecken aussehen.",
  "This bot is listed on Discover": "Dieser Bot ist in Entdecken gelistet",
  "This server is listed on Discover":
    "Dieser Server ist in Entdecken gelistet",
  "Contact support to remove this bot from Discover":
    "Wende dich an den Support, um diesen Bot aus Entdecken zu entfernen",
  "Contact support to remove this server from Discover":
    "Wende dich an den Support, um diesen Server aus Entdecken zu entfernen",
  "Your bot is under review": "Dein Bot wird geprüft",
  "Your server is under review": "Dein Server wird geprüft",
  "Check back often to see if your bot has been approved!":
    "Schau später wieder vorbei, um zu sehen, ob dein Bot angenommen wurde!",
  "Check back often to see if your server has been approved!":
    "Schau später wieder vorbei, um zu sehen, ob dein Server angenommen wurde!",
  "Allow others to join your server from Discover":
    "Anderen erlauben, deinem Server über Entdecken beizutreten",
  "Allow others to add your bot to their servers from Discover":
    "Anderen erlauben, deinen Bot über Entdecken zu ihren Servern hinzuzufügen",
  "Submit to Discover": "Bei Entdecken einreichen",
  "Can't get discover request status right now":
    "Der Status deiner Anfrage kann gerade nicht abgerufen werden",
  "Cancel discover request": "Anfrage zurückziehen",
  "Cancel your discover request and remove it from the review queue":
    "Anfrage zurückziehen und aus der Prüfwarteschlange entfernen",
  "Your discover request has been denied": "Deine Anfrage wurde abgelehnt",
  "Your discover request has been removed": "Deine Listung wurde entfernt",
  "You can request again below": "Du kannst unten erneut einreichen",

  // Emoji and GIF pickers
  "Find the perfect emoji": "Finde das perfekte Emoji",
  "Add emoji to this server": "Emoji zu diesem Server hinzufügen",
  "Tip: right-click (or hold) any emoji to add it to your favorites.":
    "Tipp: Rechtsklick (oder gedrückt halten) auf ein Emoji, um es zu deinen Favoriten hinzuzufügen.",
  Favorites: "Favoriten",
  Standard: "Standard",
  "Emoji results": "Emoji-Ergebnisse",
  "No emoji found": "Keine Emojis gefunden",
  "Try another search.": "Versuch es mit einer anderen Suche.",
  "GIF picker": "GIF-Auswahl",
  "Trending GIFs": "Beliebte GIFs",
  "Back to categories": "Zurück zu den Kategorien",
  "Loading GIFs": "GIFs werden geladen",
  "No GIFs found": "Keine GIFs gefunden",
  "Try a different word or explore the categories.":
    "Versuch ein anderes Wort oder stöbere in den Kategorien.",
  "Browse categories": "Kategorien ansehen",
  "Send GIF": "GIF senden",
  "GIFs aren't available yet": "GIFs sind noch nicht verfügbar",
  "You can still send emoji in the meantime.":
    "Emojis kannst du in der Zwischenzeit trotzdem senden.",
  "Couldn't load GIFs": "GIFs konnten nicht geladen werden",
  "The GIF service couldn't be reached. Please try again.":
    "Der GIF-Dienst ist nicht erreichbar. Bitte versuch es erneut.",
  "Try again": "Erneut versuchen",

  // Voice messages, media player and link safety
  "Voice message": "Sprachnachricht",
  "Record a voice message": "Sprachnachricht aufnehmen",
  "Send voice message": "Sprachnachricht senden",
  "Discard recording": "Aufnahme verwerfen",
  "Starting the microphone…": "Mikrofon wird gestartet…",
  "Microphone access is blocked. Allow it in your browser to record.":
    "Der Zugriff aufs Mikrofon ist blockiert. Erlaube ihn im Browser, um aufzunehmen.",
  "This browser can't record voice messages.":
    "Dieser Browser kann keine Sprachnachrichten aufnehmen.",
  "Limit reached": "Maximale Länge erreicht",
  Unavailable: "Nicht verfügbar",
  Play: "Abspielen",
  Pause: "Pause",
  "Playback position": "Wiedergabeposition",
  "This site doesn't use a secure connection (no HTTPS). Others on your network could see or change what you send.":
    "Diese Seite nutzt keine sichere Verbindung (kein HTTPS). Andere in deinem Netzwerk könnten mitlesen oder Inhalte verändern.",
  "This address uses special characters that can imitate another site's name. Check it carefully before you continue.":
    "Diese Adresse enthält Sonderzeichen, die den Namen einer anderen Seite nachahmen können. Prüfe sie genau, bevor du fortfährst.",

  // Invite dialog and attachment cards
  "Invite friends to {0}": "Freunde zu {0} einladen",
  "Search for friends": "Freunde suchen",
  "Add some friends first, or share the link below.":
    "Füge zuerst Freunde hinzu oder teile den Link unten.",
  "No friends match your search.": "Keine Freunde passen zu deiner Suche.",
  Invite: "Einladen",
  Sent: "Gesendet",
  "Or send an invite link to a friend":
    "Oder schick einem Freund einen Einladungslink",
  "Invite link": "Einladungslink",
  "Generating invite…": "Einladung wird erstellt…",
  Copy: "Kopieren",
  Copied: "Kopiert",
  "Your invite link never expires.": "Dein Einladungslink läuft nie ab.",
  "Upload file": "Datei hochladen",
  "Add file": "Datei hinzufügen",
  "Sent in the next message": "Wird mit der nächsten Nachricht gesendet",
  Spoiler: "Spoiler",
  "Mark as spoiler": "Als Spoiler markieren",
  "Remove spoiler": "Spoiler entfernen",
  "Remove {0}": "{0} entfernen",
  Remove: "Entfernen",

  // Home
  "Welcome back to Zrzur.": "Willkommen zurück bei Zrzur.",
  "Your servers": "Deine Server",
  "You haven't joined a server yet. Create one or find one on Discover.":
    "Du bist noch keinem Server beigetreten. Erstelle einen oder finde einen unter Entdecken.",
  "Friends online": "Freunde online",
  "See all": "Alle ansehen",
  "No friends online right now": "Gerade sind keine Freunde online",
  "Message {0}": "{0} schreiben",
  Download: "Herunterladen",

  // Profile look: theme, name style, decorations
  Look: "Aussehen",
  "Avatar decoration": "Avatar-Deko",
  "Name style": "Namensstil",
  "Profile theme": "Profilfarben",
  "Colours your profile card and its banner when you have no picture.":
    "Färbt deine Profilkarte und ihr Banner, wenn du kein Bild hast.",
  "Main colour": "Hauptfarbe",
  "Second colour": "Zweite Farbe",
  "Font {0}": "Schrift {0}",
  "Default font": "Standardschrift",
  "Solid colour": "Einfarbig",
  "No colour": "Keine Farbe",
  "Display name style": "Stil des Anzeigenamens",
  "Choose font": "Schrift wählen",
  "Choose colour": "Farbe wählen",
  Solid: "Einfarbig",
  Gradient: "Verlauf",
  "Pick a colour": "Farbe wählen",
  "In a server, a role colour wins over yours, but your font stays.":
    "In einem Server hat die Rollenfarbe Vorrang, deine Schrift bleibt aber.",
  "Surprise me": "Überrasch mich",
  "does anyone read this?": "liest das überhaupt jemand?",
  "Change avatar decoration": "Avatar-Deko ändern",
  "Look at my new decoration": "Schaut euch meine neue Deko an",
  now: "jetzt",
  "Today at 12:00": "Heute um 12:00",
  "In a server, a role colour wins over yours, but your font stays. On a profile card with a theme, your name turns white so it stays readable.":
    "In einem Server hat die Rollenfarbe Vorrang, deine Schrift bleibt aber. Auf einer Profilkarte mit Farbthema wird dein Name weiß, damit er lesbar bleibt.",
  Selected: "Ausgewählt",
  Apply: "Übernehmen",
  Reset: "Zurücksetzen",
  Cancel: "Abbrechen",
  None: "Keine",
  Flames: "Flammen",
  Headphones: "Kopfhörer",
  Laurel: "Lorbeer",
  Snow: "Schnee",
  Hearts: "Herzen",
  Stars: "Sterne",
  Lightning: "Blitz",
  Glow: "Leuchten",
  Fire: "Feuer",
  Ice: "Eis",
  Gold: "Gold",
  Sparkle: "Funkeln",
  Galaxy: "Galaxie",
  Neon: "Neon",
  Heartbeat: "Herzschlag",
  Toxic: "Giftig",
  Sunset: "Sonnenuntergang",
  Ocean: "Ozean",
  Grape: "Traube",
  Mint: "Minze",
  Midnight: "Mitternacht",
  Cherry: "Kirsche",
  Aurora: "Polarlicht",
  Rose: "Rosé",
  Forest: "Wald",
  Candy: "Bonbon",

  // Community decorations and nameplates
  Included: "Enthalten",
  "Community decoration": "Community-Deko",
  // emoji picker categories
  "Open emoji picker": "Emoji-Auswahl öffnen",
  "Smileys & people": "Smileys & Personen",
  "Animals & nature": "Tiere & Natur",
  "Food & drink": "Essen & Trinken",
  "Travel & places": "Reisen & Orte",
  Activities: "Aktivitäten",
  Objects: "Objekte",
  Symbols: "Symbole",
  Flags: "Flaggen",
  // decoration library
  Favourites: "Favoriten",
  Recent: "Zuletzt",
  Rings: "Ringe",
  Elements: "Elemente",
  "Search decorations": "Dekos suchen",
  "No decorations match your search.": "Keine Deko passt zu deiner Suche.",
  "Decorations you wear will show up here.":
    "Dekos, die du trägst, erscheinen hier.",
  "Tap the heart on a decoration to save it here.":
    "Tippe auf das Herz einer Deko, um sie hier zu speichern.",
  "Add to favourites": "Zu Favoriten hinzufügen",
  "Remove from favourites": "Aus Favoriten entfernen",
  "Community nameplate": "Community-Namensschild",
  Nameplate: "Namensschild",
  "Change nameplate": "Namensschild ändern",
  "Your nameplate shows behind your name in member lists.":
    "Dein Namensschild erscheint hinter deinem Namen in Mitgliederlisten.",
  Sakura: "Sakura",
  Ember: "Glut",
  "Search by name": "Nach Namen suchen",
  All: "Alle",
  Mine: "Meine",
  Upload: "Hochladen",
  "Use a PNG, animated PNG, GIF or WebP image.":
    "Verwende ein PNG, animiertes PNG, GIF oder WebP.",
  "That image is too big. The limit is 2.5 MB.":
    "Das Bild ist zu groß. Maximal 2,5 MB.",
  Name: "Name",
  "Only upload images you made or are allowed to share. Anyone can report it, and you can remove it at any time.":
    "Lade nur Bilder hoch, die du selbst gemacht hast oder teilen darfst. Alle können sie melden, und du kannst sie jederzeit entfernen.",
  Publish: "Veröffentlichen",
  "Publishing…": "Wird veröffentlicht…",
  "The community gallery couldn't be loaded.":
    "Die Community-Galerie konnte nicht geladen werden.",
  "Nothing here yet. Be the first to upload one!":
    "Noch nichts hier. Lade als Erste·r etwas hoch!",
  "You haven't uploaded any yet.": "Du hast noch nichts hochgeladen.",
  "by @{0}": "von @{0}",
  "by you": "von dir",
  "Hidden after reports": "Nach Meldungen ausgeblendet",
  Report: "Melden",
  "Remove?": "Entfernen?",
  "Report?": "Melden?",
  // Plugins, OAuth, developer portal and server home
  "{0} installs.": "{0} Installationen.",
  "{0} plugin panel": "Plugin-Panel von {0}",
  "A secret exists. Resetting it stops the old one at once.":
    "Ein Secret ist vorhanden. Wenn du es zurücksetzt, funktioniert das alte sofort nicht mehr.",
  Accessibility: "Barrierefreiheit",
  "Add commands": "Befehle hinzufügen",
  "Add its bot to a server you manage":
    "Seinen Bot zu einem Server hinzufügen, den du verwaltest",
  "Add keyboard shortcuts": "Tastenkürzel hinzufügen",
  "After you decide you will go to {0}. You can revoke this at any time under Authorized apps.":
    "Nach deiner Entscheidung wirst du zu {0} weitergeleitet. Du kannst den Zugriff jederzeit unter „Autorisierte Apps“ widerrufen.",
  "Allow {0} to do the things listed above? You can turn it off or uninstall it at any time.":
    "{0} die oben aufgeführten Dinge erlauben? Du kannst es jederzeit ausschalten oder deinstallieren.",
  "Allow and install": "Erlauben und installieren",
  "Allow and update": "Erlauben und aktualisieren",
  "App version, platform and plugin timings, in development builds only.":
    "App-Version, Plattform und Plugin-Laufzeiten, nur in Entwicklungs-Builds.",
  "Applied whenever this plugin runs.":
    "Wird angewendet, wann immer dieses Plugin läuft.",
  "Apps you allowed to use your account. Revoking one ends its access at once; bots it added stay in servers until their managers remove them.":
    "Apps, denen du die Nutzung deines Kontos erlaubt hast. Wenn du eine widerrufst, endet ihr Zugriff sofort; Bots, die sie hinzugefügt hat, bleiben auf Servern, bis deren Verwalter sie entfernen.",
  "Assign roles": "Rollen zuweisen",
  "Authorization URL": "Autorisierungs-URL",
  Authorize: "Autorisieren",
  "Authorized apps": "Autorisierte Apps",
  "Ban members": "Mitglieder sperren",
  Browse: "Durchsuchen",
  "Browse plugins": "Plugins durchsuchen",
  "Browse reviewed plugins to add one.":
    "Durchsuche geprüfte Plugins, um eines hinzuzufügen.",
  "Build a plugin": "Ein Plugin erstellen",
  "Can't continue": "Fortfahren nicht möglich",
  "Can't run": "Kann nicht ausgeführt werden",
  "Change colours": "Farben ändern",
  "Change how notifications look": "Aussehen von Benachrichtigungen ändern",
  "Change text and motion": "Text und Bewegung ändern",
  "Changes how notifications are shown":
    "Ändert, wie Benachrichtigungen angezeigt werden",
  "Channels you can see will show up here once they are added.":
    "Kanäle, die du sehen kannst, erscheinen hier, sobald sie hinzugefügt wurden.",
  "Check for updates": "Nach Updates suchen",
  "Choose a `.zplugin.json` package (or a manifest) to check it, preview it on this device, or submit it for review.":
    "Wähle ein `.zplugin.json`-Paket (oder ein Manifest), um es zu prüfen, auf diesem Gerät als Vorschau anzusehen oder zur Prüfung einzureichen.",
  "Choose a plugin package": "Plugin-Paket auswählen",
  "Choose a server…": "Server auswählen…",
  "Clears its error history and starts it again.":
    "Löscht den Fehlerverlauf und startet es neu.",
  "Client ID": "Client-ID",
  "Client secret": "Client-Secret",
  "Code from third-party publishers can't run on Zrzur yet.":
    "Code von Drittanbietern kann auf Zrzur noch nicht ausgeführt werden.",
  "Commands you run from its page or a shortcut.":
    "Befehle, die du auf seiner Seite oder per Tastenkürzel ausführst.",
  "Confirm revoke": "Widerruf bestätigen",
  "Connect to voice": "Mit Sprachkanälen verbinden",
  "Create a channel so members have a place to talk.":
    "Erstelle einen Kanal, damit Mitglieder einen Ort zum Reden haben.",
  "Create a plugin with this id first.":
    "Erstelle zuerst ein Plugin mit dieser ID.",
  "Create plugin": "Plugin erstellen",
  "Create secret": "Secret erstellen",
  Developer: "Entwickler",
  "Developer tools": "Entwicklerwerkzeuge",
  "Enabled · not running": "Aktiviert · läuft nicht",
  "Every plugin here was reviewed by Zrzur. Check what each one asks for before you install it.":
    "Jedes Plugin hier wurde von Zrzur geprüft. Sieh dir an, was es verlangt, bevor du es installierst.",
  Failed: "Fehlgeschlagen",
  "Hide code": "Code ausblenden",
  "High risk": "Hohes Risiko",
  "I checked who the publisher is: mark them verified":
    "Ich habe geprüft, wer der Herausgeber ist: als verifiziert markieren",
  "I read the code and every permission, and it's safe to run.":
    "Ich habe den Code und jede Berechtigung gelesen, und die Ausführung ist sicher.",
  "If an account uses this address, we've sent it a link to choose a new password. Please allow up to 10 minutes for it to arrive.":
    "Wenn ein Konto diese Adresse verwendet, haben wir ihm einen Link zum Festlegen eines neuen Passworts geschickt. Es kann bis zu 10 Minuten dauern, bis er ankommt.",
  "Insert text in your message box": "Text in dein Nachrichtenfeld einfügen",
  Install: "Installieren",
  "Install, turn on and manage reviewed plugins.":
    "Geprüfte Plugins installieren, aktivieren und verwalten.",
  Installed: "Installiert",
  "Interface colours only. Warning colours can't change and text must stay readable.":
    "Nur Oberflächenfarben. Warnfarben können nicht geändert werden und Text muss lesbar bleiben.",
  "It can't send anything: you decide whether to send.":
    "Es kann nichts senden: Du entscheidest, ob gesendet wird.",
  "It crashed.": "Es ist abgestürzt.",
  "It kept taking too long to respond.":
    "Es hat wiederholt zu lange zum Antworten gebraucht.",
  "It needs your permission again.": "Es braucht erneut deine Erlaubnis.",
  "It sent too many requests and was stopped.":
    "Es hat zu viele Anfragen gesendet und wurde gestoppt.",
  "It sent too much data at once and was stopped.":
    "Es hat zu viele Daten auf einmal gesendet und wurde gestoppt.",
  "It stopped responding and was stopped.":
    "Es hat nicht mehr reagiert und wurde gestoppt.",
  "It took too long to start.": "Es hat zu lange zum Starten gebraucht.",
  "Its code didn't match the reviewed version, so it was blocked.":
    "Sein Code stimmte nicht mit der geprüften Version überein, daher wurde es blockiert.",
  "Its own panels made of text, buttons and switches, always labelled with its name.":
    "Eigene Panels aus Text, Schaltflächen und Schaltern, immer mit seinem Namen beschriftet.",
  "Kept on this device only. No messages or personal data are recorded.":
    "Nur auf diesem Gerät gespeichert. Es werden keine Nachrichten oder persönlichen Daten aufgezeichnet.",
  "Kick members": "Mitglieder kicken",
  "Know which channel you open": "Wissen, welchen Kanal du öffnest",
  "Know your username and avatar": "Deinen Benutzernamen und Avatar kennen",
  "Let its commands be used in the server":
    "Seine Befehle auf dem Server nutzbar machen",
  "Loading plugins…": "Plugins werden geladen…",
  "Local previews": "Lokale Vorschauen",
  "Low risk": "Geringes Risiko",
  "Made for a different plugin API.": "Für eine andere Plugin-API entwickelt.",
  "Manage channels": "Kanäle verwalten",
  "Manage messages": "Nachrichten verwalten",
  "Manage nicknames": "Spitznamen verwalten",
  "Manage permissions": "Berechtigungen verwalten",
  "Manage roles": "Rollen verwalten",
  "Manage server": "Server verwalten",
  "Manage webhooks": "Webhooks verwalten",
  Manifest: "Manifest",
  "Medium risk": "Mittleres Risiko",
  "Mention everyone": "Alle erwähnen",
  "Needs a newer version of Zrzur.":
    "Benötigt eine neuere Version von Zrzur.",
  "Needs no permissions.": "Benötigt keine Berechtigungen.",
  "Never shortcuts Zrzur or your browser already use.":
    "Niemals Tastenkürzel, die Zrzur oder dein Browser bereits verwenden.",
  "New message": "Neue Nachricht",
  "New plugin": "Neues Plugin",
  "New secret: copy it now, it is not shown again":
    "Neues Secret: Kopiere es jetzt, es wird nicht noch einmal angezeigt",
  "No apps yet.": "Noch keine Apps.",
  "No changelog.": "Kein Änderungsprotokoll.",
  "No plugin matches that": "Kein Plugin passt dazu",
  "No plugin runs until you turn Safe Mode off.":
    "Kein Plugin läuft, bis du den abgesicherten Modus ausschaltest.",
  "No plugins are published yet": "Noch keine Plugins veröffentlicht",
  "No plugins yet": "Noch keine Plugins",
  "No secret yet: the app is a public client and must use PKCE (it always must).":
    "Noch kein Secret: Die App ist ein öffentlicher Client und muss PKCE verwenden (das muss sie immer).",
  "Not available on this device.": "Auf diesem Gerät nicht verfügbar.",
  "Not connected to voice": "Nicht mit Sprache verbunden",
  "Not supported by this version of Zrzur.":
    "Wird von dieser Version von Zrzur nicht unterstützt.",
  "Not supported here": "Hier nicht unterstützt",
  "Note to the publisher (required to reject)":
    "Hinweis an den Herausgeber (zum Ablehnen erforderlich)",
  "Nothing is waiting for review.": "Nichts wartet auf eine Prüfung.",
  OAuth2: "OAuth2",
  Official: "Offiziell",
  "Only the one message you choose its action on, and only at that moment.":
    "Nur die eine Nachricht, auf die du seine Aktion anwendest, und nur in diesem Moment.",
  "Other permissions": "Weitere Berechtigungen",
  Package: "Paket",
  "Permissions it asks for": "Angeforderte Berechtigungen",
  "Permissions you granted": "Von dir erteilte Berechtigungen",
  "Plugin · {0}": "Plugin · {0}",
  "Plugin id (like yourname.my-plugin)": "Plugin-ID (z. B. yourname.my-plugin)",
  "Plugin sections": "Plugin-Bereiche",
  "Plugin settings": "Plugin-Einstellungen",
  "Plugins add themes, shortcuts and tools to Zrzur. Every plugin is reviewed by Zrzur before you can install it, asks for each permission it needs, and runs isolated from your account: no plugin can see your password, session or private messages.":
    "Plugins erweitern Zrzur um Designs, Tastenkürzel und Werkzeuge. Jedes Plugin wird von Zrzur geprüft, bevor du es installieren kannst, fragt jede benötigte Berechtigung einzeln an und läuft isoliert von deinem Konto: Kein Plugin kann dein Passwort, deine Sitzung oder deine privaten Nachrichten sehen.",
  "Plugins can't read hidden channels, bypass server permissions, use bot tokens or reach your files. A crashing plugin is stopped without affecting chat, voice or screen sharing.":
    "Plugins können keine versteckten Kanäle lesen, keine Serverberechtigungen umgehen, keine Bot-Tokens verwenden und nicht auf deine Dateien zugreifen. Ein abstürzendes Plugin wird gestoppt, ohne Chat, Sprache oder Bildschirmfreigabe zu beeinträchtigen.",
  "Preview · not installed · gone after reload":
    "Vorschau · nicht installiert · nach dem Neuladen weg",
  "Preview here": "Hier als Vorschau ansehen",
  "Previewing code plugins needs a development build of Zrzur.":
    "Für die Vorschau von Code-Plugins wird ein Entwicklungs-Build von Zrzur benötigt.",
  "Previewing on this device only. Find it under Installed → Local previews.":
    "Vorschau nur auf diesem Gerät. Du findest sie unter Installiert → Lokale Vorschauen.",
  Productivity: "Produktivität",
  "Publisher:": "Herausgeber:",
  Quarantined: "In Quarantäne",
  "Quiet hours, hidden previews and muted sounds. It never reads your notifications.":
    "Ruhezeiten, ausgeblendete Vorschauen und stumme Töne. Es liest niemals deine Benachrichtigungen.",
  "Read a message you pick": "Eine von dir gewählte Nachricht lesen",
  "Read diagnostics": "Diagnosedaten lesen",
  "Read message history": "Nachrichtenverlauf lesen",
  "Read the manifest, every permission and any code before approving. High-risk releases need an explicit confirmation. You can't approve your own plugin.":
    "Lies das Manifest, jede Berechtigung und jeglichen Code, bevor du genehmigst. Releases mit hohem Risiko erfordern eine ausdrückliche Bestätigung. Du kannst dein eigenes Plugin nicht genehmigen.",
  "Reading and motion changes": "Änderungen an Lesbarkeit und Bewegung",
  "Reason (required)": "Grund (erforderlich)",
  "Recent problems": "Letzte Probleme",
  "Redirect URIs (one per line, https or http://localhost)":
    "Weiterleitungs-URIs (eine pro Zeile, https oder http://localhost)",
  "Reinstate plugin": "Plugin wiederherstellen",
  "Removes it, its permissions and its settings.":
    "Entfernt es samt Berechtigungen und Einstellungen.",
  "Report this plugin": "Dieses Plugin melden",
  "Reset secret": "Secret zurücksetzen",
  "Review and update": "Prüfen und aktualisieren",
  "Review history": "Prüfverlauf",
  "Review status: {0}": "Prüfstatus: {0}",
  "Reviewed and approved by Zrzur on {0}.":
    "Von Zrzur am {0} geprüft und genehmigt.",
  "Reviewer actions": "Aktionen für Prüfer",
  "Revoke access": "Zugriff widerrufen",
  "Revoke v{0}": "v{0} widerrufen",
  Run: "Ausführen",
  "Run plugins": "Plugins ausführen",
  Running: "Läuft",
  "Running now.": "Läuft gerade.",
  "Runs code in an isolated sandbox with no network, no access to the page and limited time and messages.":
    "Führt Code in einer isolierten Sandbox aus, ohne Netzwerk, ohne Zugriff auf die Seite und mit begrenzter Zeit und Nachrichtenanzahl.",
  "Safe Mode is on": "Der abgesicherte Modus ist aktiv",
  "Safe Mode is on, so no plugin runs.":
    "Der abgesicherte Modus ist aktiv, daher läuft kein Plugin.",
  "Safe Mode is on: no plugin runs. Your plugins and their settings are kept.":
    "Der abgesicherte Modus ist aktiv: Kein Plugin läuft. Deine Plugins und ihre Einstellungen bleiben erhalten.",
  "Save its settings": "Seine Einstellungen speichern",
  "Save redirect URIs": "Weiterleitungs-URIs speichern",
  "Scanner notes for the reviewer:": "Hinweise des Scanners für den Prüfer:",
  "Search plugins": "Plugins suchen",
  "See the names and icons of your servers":
    "Namen und Symbole deiner Server sehen",
  "Send embeds": "Einbettungen senden",
  "Send messages": "Nachrichten senden",
  "Send users to /oauth2/authorize with client_id, redirect_uri, response_type=code, scope (identify, servers.read, applications.commands, bot.install), state, code_challenge and code_challenge_method=S256. Exchange the code at POST /oauth2/token. Codes last 10 minutes, access tokens 1 hour, refresh tokens 30 days.":
    "Leite Nutzer zu /oauth2/authorize mit client_id, redirect_uri, response_type=code, scope (identify, servers.read, applications.commands, bot.install), state, code_challenge und code_challenge_method=S256. Tausche den Code über POST /oauth2/token ein. Codes gelten 10 Minuten, Access-Tokens 1 Stunde, Refresh-Tokens 30 Tage.",
  "Short in-app notices that start with its name.":
    "Kurze Hinweise in der App, die mit seinem Namen beginnen.",
  "Show code": "Code anzeigen",
  "Show notices": "Hinweise anzeigen",
  "Show panels": "Panels anzeigen",
  "Something went wrong ({id}).": "Etwas ist schiefgelaufen ({id}).",
  "Starting…": "Wird gestartet…",
  Stop: "Stoppen",
  "Stopped after repeated errors.": "Nach wiederholten Fehlern gestoppt.",
  "Submitted. A Zrzur reviewer will look at it; you'll see the result here.":
    "Eingereicht. Ein Prüfer von Zrzur sieht es sich an; das Ergebnis siehst du hier.",
  "Suspend plugin": "Plugin sperren",
  "Suspend publisher": "Herausgeber sperren",
  "Switch compact mode on or off when you run its command.":
    "Kompaktmodus ein- oder ausschalten, wenn du seinen Befehl ausführst.",
  "Switch to a safe version": "Zu einer sicheren Version wechseln",
  "Tell Zrzur if it misbehaves, misleads or looks unsafe.":
    "Sag Zrzur Bescheid, wenn es sich falsch verhält, irreführend ist oder unsicher wirkt.",
  "Text size, spacing, link underlines, focus rings and animations.":
    "Textgröße, Abstände, Link-Unterstreichungen, Fokusrahmen und Animationen.",
  "Thanks, Zrzur will look at it.": "Danke, Zrzur sieht es sich an.",
  "That file is too large for a plugin package.":
    "Diese Datei ist zu groß für ein Plugin-Paket.",
  "That file isn't valid JSON.": "Diese Datei ist kein gültiges JSON.",
  "The bot is already in that server.":
    "Der Bot ist bereits auf diesem Server.",
  "The bot's permissions there:": "Berechtigungen des Bots dort:",
  "The id and name of channels you open, only ones you can already see.":
    "ID und Name der Kanäle, die du öffnest, nur solche, die du ohnehin sehen kannst.",
  "The plugin store couldn't be loaded":
    "Der Plugin-Store konnte nicht geladen werden",
  "Theme colours": "Designfarben",
  "This account can't publish plugins":
    "Dieses Konto kann keine Plugins veröffentlichen",
  "This authorization link is not valid.":
    "Dieser Autorisierungslink ist ungültig.",
  "This browser can't run it safely.":
    "Dieser Browser kann es nicht sicher ausführen.",
  "This link is invalid or has already been used. Request a new one if your account still needs verifying.":
    "Dieser Link ist ungültig oder wurde bereits verwendet. Fordere einen neuen an, falls dein Konto noch bestätigt werden muss.",
  "This plugin isn't available": "Dieses Plugin ist nicht verfügbar",
  "This plugin was removed from Zrzur. You can only uninstall it.":
    "Dieses Plugin wurde aus Zrzur entfernt. Du kannst es nur deinstallieren.",
  "This server has no channels yet": "Dieser Server hat noch keine Kanäle",
  "This version asks for new permissions:":
    "Diese Version fragt nach neuen Berechtigungen:",
  "This version isn't approved.": "Diese Version ist nicht genehmigt.",
  "This version was revoked for safety and won't run again.":
    "Diese Version wurde aus Sicherheitsgründen widerrufen und läuft nicht mehr.",
  "This will allow it to:": "Dadurch darf es:",
  "Time out members": "Mitglieder in Timeout versetzen",
  "Toggle compact mode": "Kompaktmodus umschalten",
  "Turn off to start Safe Mode, which stops every plugin at once. You can also add this to the address:":
    "Schalte es aus, um den abgesicherten Modus zu starten, der alle Plugins auf einmal stoppt. Du kannst auch Folgendes an die Adresse anhängen:",
  "Turned off.": "Ausgeschaltet.",
  Uninstall: "Deinstallieren",
  "Uninstall the store version first to preview this one.":
    "Deinstalliere zuerst die Store-Version, um diese als Vorschau anzusehen.",
  "Up to 8 KB of its own settings, kept with your account.":
    "Bis zu 8 KB eigener Einstellungen, gespeichert mit deinem Konto.",
  Update: "Aktualisieren",
  "Update available": "Update verfügbar",
  "Updating…": "Wird aktualisiert…",
  "Upload files": "Dateien hochladen",
  "Use the Zrzur plugin SDK: `zrzur-plugin init` makes a project, `validate` checks it and `pack` makes the package you upload here. Plugins describe what they add in a manifest; only official Zrzur plugins can include code for now.":
    "Nutze das Zrzur-Plugin-SDK: `zrzur-plugin init` erstellt ein Projekt, `validate` prüft es und `pack` erstellt das Paket, das du hier hochlädst. Plugins beschreiben in einem Manifest, was sie hinzufügen; vorerst dürfen nur offizielle Zrzur-Plugins Code enthalten.",
  "Valid · {0}": "Gültig · {0}",
  "Verified publisher": "Verifizierter Herausgeber",
  Versions: "Versionen",
  "View channels": "Kanäle ansehen",
  "wants to access your Zrzur account":
    "möchte auf dein Zrzur-Konto zugreifen",
  "What changed (shown to users)":
    "Was sich geändert hat (für Nutzer sichtbar)",
  "What it adds": "Was es hinzufügt",
  "What's wrong?": "Was stimmt nicht?",
  Withdraw: "Zurückziehen",
  "Yes, uninstall": "Ja, deinstallieren",
  "You can't give the bot permissions you don't have in that server.":
    "Du kannst dem Bot keine Berechtigungen geben, die du auf diesem Server nicht hast.",
  "You don't manage any server it can be added to.":
    "Du verwaltest keinen Server, zu dem er hinzugefügt werden kann.",
  "You haven't created a plugin yet": "Du hast noch kein Plugin erstellt",
  "You joined voice from another tab or device.":
    "Du bist dem Sprachkanal in einem anderen Tab oder auf einem anderen Gerät beigetreten.",
  "You were disconnected from voice.":
    "Die Verbindung zum Sprachkanal wurde getrennt.",
  "Your plugins": "Deine Plugins",
  "Your publishing is suspended": "Deine Veröffentlichungen sind gesperrt",
  "Zrzur started in Safe Mode because it didn't start properly with plugins last time. Turn Safe Mode off in Settings → Advanced → Plugins.":
    "Zrzur wurde im abgesicherten Modus gestartet, weil es beim letzten Mal mit Plugins nicht richtig gestartet ist. Schalte den abgesicherten Modus unter Einstellungen → Erweitert → Plugins aus.",
  "Zrzur suspended this plugin while it's being reviewed.":
    "Zrzur hat dieses Plugin gesperrt, während es geprüft wird.",
};

ar["Go to server"] = "اذهب إلى السيرفر";
de["Go to server"] = "Zum Server";

// Home page and the home sidebar
Object.assign(ar, {
  "Up late, {name}?": "ساهر حتى الآن يا {name}؟",
  "Good morning, {name}": "صباح الخير يا {name}",
  "Good afternoon, {name}": "طاب يومك يا {name}",
  "Good evening, {name}": "مساء الخير يا {name}",
  "Create a group or server": "أنشئ مجموعة أو سيرفراً",
  "Invite your friends, add a few bots and get talking.":
    "ادعُ أصدقاءك، وأضف بعض البوتات، وابدأ الحديث.",
  "Join the Zrzur community": "انضم إلى مجتمع زرزور",
  "Our official server: news, help and ideas from other members.":
    "سيرفرنا الرسمي: أخبار ومساعدة وأفكار من الأعضاء الآخرين.",
  "Find friends": "ابحث عن أصدقاء",
  "Add friends by username and see who is online.":
    "أضف أصدقاءك باسم المستخدم وشاهد من المتصل الآن.",
  "Give feedback": "شاركنا رأيك",
  "Tell us what to improve, report a problem or suggest an idea.":
    "أخبرنا بما يمكن تحسينه، أو أبلغ عن مشكلة، أو اقترح فكرة.",
  "Open settings": "افتح الإعدادات",
  "Account, appearance, notifications, voice and more.":
    "الحساب والمظهر والإشعارات والصوت وغيرها.",
  "Donate to Zrzur": "ادعم زرزور",
  "Help keep Zrzur running. Thank you!":
    "ساعدنا على استمرار زرزور. شكراً لك!",
  Soon: "قريباً",
  "Direct Messages": "الرسائل الخاصة",
  "Friend requests": "طلبات الصداقة",
  "Your conversations will appear here. Start a group or find a friend to begin.":
    "ستظهر محادثاتك هنا. ابدأ مجموعة أو ابحث عن صديق للبدء.",
  // was «مركز» ("centre"); this is the Focus status
  Focus: "تركيز",
});
Object.assign(de, {
  "Up late, {name}?": "Noch wach, {name}?",
  "Good morning, {name}": "Guten Morgen, {name}",
  "Good afternoon, {name}": "Guten Tag, {name}",
  "Good evening, {name}": "Guten Abend, {name}",
  "Create a group or server": "Gruppe oder Server erstellen",
  "Invite your friends, add a few bots and get talking.":
    "Lade deine Freunde ein, füge ein paar Bots hinzu und legt los.",
  "Join the Zrzur community": "Der Zrzur-Community beitreten",
  "Our official server: news, help and ideas from other members.":
    "Unser offizieller Server: Neuigkeiten, Hilfe und Ideen anderer Mitglieder.",
  "Find friends": "Freunde finden",
  "Add friends by username and see who is online.":
    "Füge Freunde über ihren Benutzernamen hinzu und sieh, wer online ist.",
  "Give feedback": "Feedback geben",
  "Tell us what to improve, report a problem or suggest an idea.":
    "Sag uns, was wir verbessern können, melde ein Problem oder schlag eine Idee vor.",
  "Open settings": "Einstellungen öffnen",
  "Account, appearance, notifications, voice and more.":
    "Konto, Darstellung, Benachrichtigungen, Sprache und mehr.",
  "Donate to Zrzur": "Zrzur unterstützen",
  "Help keep Zrzur running. Thank you!":
    "Hilf mit, Zrzur am Laufen zu halten. Danke!",
  Soon: "Bald",
  "Direct Messages": "Direktnachrichten",
  "Friend requests": "Freundschaftsanfragen",
  "Your conversations will appear here. Start a group or find a friend to begin.":
    "Deine Unterhaltungen erscheinen hier. Starte eine Gruppe oder finde einen Freund.",
  Focus: "Konzentriert",
});

// The rest of the interface: scripts/i18n/ui-*.json map an English string
// to [Arabic, German]; ui-de.json fills German where Arabic already exists.
// Entries above win, so nothing translated by hand gets overwritten.
for (const name of readdirSync("scripts/i18n").sort()) {
  if (!/^ui-\d+\.json$/.test(name)) continue;
  const entries = JSON.parse(readFileSync(`scripts/i18n/${name}`, "utf8"));
  for (const [key, [arabic, german]] of Object.entries(entries)) {
    if (!(key in ar)) ar[key] = arabic;
    if (!(key in de)) de[key] = german;
  }
}
for (const [key, german] of Object.entries(
  JSON.parse(readFileSync("scripts/i18n/ui-de.json", "utf8")),
)) {
  if (!(key in de)) de[key] = german;
}

// Corrections to upstream Arabic (spelling, wording, one term per idea:
// «حجب» blocks a person, «حظر» bans from a server, «أدوار» for roles).
// These are deliberate, so they replace whatever was there.
const arFixes = {};
for (const name of readdirSync("scripts/i18n").sort()) {
  if (!/^ar-fixes-\d+\.json$/.test(name)) continue;
  Object.assign(arFixes, JSON.parse(readFileSync(`scripts/i18n/${name}`, "utf8")));
}

// Same for German: «sperren» for bans, «Konto» for account, du-form
const deFixes = {};
for (const name of readdirSync("scripts/i18n").sort()) {
  if (!/^de-fixes-\d+\.json$/.test(name)) continue;
  Object.assign(deFixes, JSON.parse(readFileSync(`scripts/i18n/${name}`, "utf8")));
}

const translations = { ar: { ...ar, ...arFixes }, de: { ...de, ...deFixes } };

// a string with a context (msgctxt) is keyed "context::text" in the maps,
// so one English word can have its own translation in one place
const keyOf = (block) => {
  if (/^#~/m.test(block)) return undefined;
  const match = block.match(/^msgid (".*"(?:\n".*")*)/m);
  if (!match) return undefined;
  const text = match[1]
    .split("\n")
    .map((line) => JSON.parse(line))
    .join("");
  const context = block.match(/^msgctxt (".*")/m);
  return context ? `${JSON.parse(context[1])}::${text}` : text;
};

for (const locale of ["en", "ar", "de"]) {
  const path = `components/i18n/catalogs/${locale}/messages.po`;
  const extracted = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const baseline = execFileSync(
    "git",
    ["show", `HEAD:packages/client/${path}`],
    { encoding: "utf8" },
  ).replace(/\r\n/g, "\n");

  const existing = new Set(baseline.split("\n\n").map(keyOf));
  const added = extracted.split("\n\n").filter((block) => {
    const key = keyOf(block);
    // new strings we translate, plus strings only this locale's map covers
    // (e.g. German for text the committed catalog only has in Arabic)
    return (
      key &&
      (key in ar || key in (translations[locale] ?? {})) &&
      !existing.has(key)
    );
  });

  let count = 0;
  const updated = (baseline.trimEnd() + "\n\n" + added.join("\n\n") + "\n")
    .split("\n\n")
    .map((block) => {
      const key = keyOf(block);
      const map = translations[locale];
      if (!map || !key || !(key in map)) return block;
      count++;
      return block.replace(
        /^msgstr ".*"(?:\n".*")*/m,
        "msgstr " + JSON.stringify(map[key]),
      );
    })
    .join("\n\n");

  writeFileSync(path, updated);
  console.log(`${locale}: ${added.length} added, ${count} translated`);
}

// Strings the UI no longer uses stay in the maps harmlessly; report them
const catalog = readFileSync("components/i18n/catalogs/ar/messages.po", "utf8")
  .replace(/\r\n/g, "\n")
  .split("\n\n")
  .map(keyOf);
const unused = Object.keys(ar).filter((key) => !catalog.includes(key));
if (unused.length) console.log("not in catalog (unused):", unused.length);

const untranslated = Object.keys(ar).filter((key) => !(key in de));
if (untranslated.length) {
  console.error("missing German for:", untranslated);
  process.exit(1);
}
