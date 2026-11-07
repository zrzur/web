/**
 * Arabic for the plugin screens, loaded at runtime into Lingui.
 *
 * The shared catalogs (`components/i18n/catalogs/*`) are rebuilt by other
 * work in progress, so these strings live here until they are merged into
 * the next catalog extraction. Keys are the exact source messages the
 * Lingui macro produces; `scripts/plugins-i18n-check.mjs` checks that every
 * plugin string has an entry.
 */
import { type Messages, i18n } from "@lingui/core";

export const PLUGINS_AR: Record<string, string> = {
  // permissions
  "Add commands": "إضافة أوامر",
  "Commands you run from its page or a shortcut.":
    "أوامر تشغّلها من صفحتها أو باختصار.",
  "Show panels": "عرض لوحات",
  "Its own panels made of text, buttons and switches, always labelled with its name.":
    "لوحات خاصة بها من نصوص وأزرار ومفاتيح، تحمل اسمها دائمًا.",
  "Add keyboard shortcuts": "إضافة اختصارات لوحة المفاتيح",
  "Never shortcuts Zrzur or your browser already use.":
    "لا تستخدم أبدًا اختصارات يستعملها زرزور أو متصفحك.",
  "Change colours": "تغيير الألوان",
  "Interface colours only. Warning colours can't change and text must stay readable.":
    "ألوان الواجهة فقط. لا يمكن تغيير ألوان التحذير ويجب أن يبقى النص مقروءًا.",
  "Change text and motion": "تغيير النص والحركة",
  "Text size, spacing, link underlines, focus rings and animations.":
    "حجم النص والتباعد وتسطير الروابط وإطار التركيز والحركات.",
  "Toggle compact mode": "تبديل الوضع المضغوط",
  "Switch compact mode on or off when you run its command.":
    "تشغيل الوضع المضغوط أو إيقافه عند تشغيل أمرها.",
  "Save its settings": "حفظ إعداداتها",
  "Up to 8 KB of its own settings, kept with your account.":
    "حتى 8 كيلوبايت من إعداداتها، محفوظة مع حسابك.",
  "Show notices": "عرض تنبيهات",
  "Short in-app notices that start with its name.":
    "تنبيهات قصيرة داخل التطبيق تبدأ باسمها.",
  "Change how notifications look": "تغيير طريقة عرض الإشعارات",
  "Quiet hours, hidden previews and muted sounds. It never reads your notifications.":
    "ساعات الهدوء وإخفاء المعاينة وكتم الصوت. لا تقرأ إشعاراتك أبدًا.",
  "Insert text in your message box": "إدراج نص في مربع الرسالة",
  "It can't send anything: you decide whether to send.":
    "لا يمكنها إرسال أي شيء: أنت من يقرر الإرسال.",
  "Know which channel you open": "معرفة القناة التي تفتحها",
  "The id and name of channels you open, only ones you can already see.":
    "معرّف واسم القنوات التي تفتحها، فقط القنوات التي تستطيع رؤيتها أصلًا.",
  "Read a message you pick": "قراءة رسالة تختارها",
  "Only the one message you choose its action on, and only at that moment.":
    "الرسالة الوحيدة التي تختار عليها أمرها فقط، وفي تلك اللحظة فقط.",
  "Read diagnostics": "قراءة معلومات التشخيص",
  "App version, platform and plugin timings, in development builds only.":
    "إصدار التطبيق والمنصة وتوقيتات الإضافات، في نسخ التطوير فقط.",
  "Not supported by this version of Zrzur.":
    "غير مدعوم في هذا الإصدار من زرزور.",
  "Low risk": "خطورة منخفضة",
  "Medium risk": "خطورة متوسطة",
  "High risk": "خطورة عالية",
  // categories
  Appearance: "المظهر",
  Productivity: "الإنتاجية",
  Accessibility: "إمكانية الوصول",
  Notifications: "الإشعارات",
  Integrations: "التكاملات",
  "Developer tools": "أدوات المطوّرين",
  // reasons
  "Safe Mode is on, so no plugin runs.":
    "الوضع الآمن مفعّل، لذلك لا تعمل أي إضافة.",
  "Turned off.": "متوقفة.",
  "Zrzur suspended this plugin while it's being reviewed.":
    "علّق زرزور هذه الإضافة ريثما تتم مراجعتها.",
  "This plugin was removed from Zrzur. You can only uninstall it.":
    "أُزيلت هذه الإضافة من زرزور. يمكنك إلغاء تثبيتها فقط.",
  "This version was revoked for safety and won't run again.":
    "سُحب هذا الإصدار لأسباب أمنية ولن يعمل مجددًا.",
  "This version isn't approved.": "هذا الإصدار غير معتمد.",
  "It needs your permission again.": "تحتاج إلى إذنك من جديد.",
  "Code from third-party publishers can't run on Zrzur yet.":
    "لا يمكن تشغيل شيفرة من ناشرين خارجيين على زرزور بعد.",
  "Not available on this device.": "غير متاحة على هذا الجهاز.",
  "Needs a newer version of Zrzur.": "تحتاج إلى إصدار أحدث من زرزور.",
  "Made for a different plugin API.": "مصممة لواجهة إضافات مختلفة.",
  "This browser can't run it safely.": "لا يستطيع هذا المتصفح تشغيلها بأمان.",
  "Stopped after repeated errors.": "أُوقفت بعد أخطاء متكررة.",
  "Its code didn't match the reviewed version, so it was blocked.":
    "لم تطابق شيفرتها النسخة التي رُوجعت، لذلك حُظرت.",
  "It stopped responding and was stopped.": "توقفت عن الاستجابة فأُوقفت.",
  "It sent too many requests and was stopped.":
    "أرسلت طلبات كثيرة جدًا فأُوقفت.",
  "It sent too much data at once and was stopped.":
    "أرسلت بيانات كثيرة دفعة واحدة فأُوقفت.",
  "It took too long to start.": "استغرقت وقتًا طويلًا لتبدأ.",
  "It kept taking too long to respond.": "تتأخر كثيرًا في الاستجابة باستمرار.",
  "It crashed.": "تعطّلت.",
  "Something went wrong ({id}).": "حدث خطأ ما ({id}).",
  // states
  "Updating…": "جارٍ التحديث…",
  Revoked: "مسحوبة",
  Blocked: "محظورة",
  Quarantined: "معزولة",
  Failed: "فشلت",
  Disabled: "معطّلة",
  "Not supported here": "غير مدعومة هنا",
  "Can't run": "لا يمكن تشغيلها",
  Running: "تعمل",
  "Starting…": "تبدأ…",
  "Enabled · not running": "مفعّلة · لا تعمل",
  Installed: "مثبّتة",
  "Needs no permissions.": "لا تحتاج إلى أي أذونات.",
  New: "جديد",
  // page
  Browse: "تصفّح",
  Developer: "المطوّر",
  Review: "المراجعة",
  Plugins: "الإضافات",
  "Plugins add themes, shortcuts and tools to Zrzur. Every plugin is reviewed by Zrzur before you can install it, asks for each permission it needs, and runs isolated from your account: no plugin can see your password, session or private messages.":
    "تضيف الإضافات سمات واختصارات وأدوات إلى زرزور. يراجع زرزور كل إضافة قبل أن تتمكن من تثبيتها، وتطلب كل إذن تحتاجه، وتعمل معزولة عن حسابك: لا تستطيع أي إضافة رؤية كلمة مرورك أو جلستك أو رسائلك الخاصة.",
  "Run plugins": "تشغيل الإضافات",
  "Safe Mode is on: no plugin runs. Your plugins and their settings are kept.":
    "الوضع الآمن مفعّل: لا تعمل أي إضافة. إضافاتك وإعداداتها محفوظة.",
  "Turn off to start Safe Mode, which stops every plugin at once. You can also add this to the address:":
    "أوقفه لتشغيل الوضع الآمن الذي يوقف كل الإضافات دفعة واحدة. يمكنك أيضًا إضافة هذا إلى العنوان:",
  "Plugin sections": "أقسام الإضافات",
  "Check for updates": "التحقق من التحديثات",
  "Loading plugins…": "جارٍ تحميل الإضافات…",
  "No plugins yet": "لا توجد إضافات بعد",
  "Browse reviewed plugins to add one.":
    "تصفّح الإضافات المراجَعة لتضيف واحدة.",
  "Update available": "يتوفر تحديث",
  "Local previews": "معاينات محلية",
  "Preview · not installed · gone after reload":
    "معاينة · غير مثبّتة · تختفي بعد إعادة التحميل",
  Stop: "إيقاف",
  "Plugins can't read hidden channels, bypass server permissions, use bot tokens or reach your files. A crashing plugin is stopped without affecting chat, voice or screen sharing.":
    "لا تستطيع الإضافات قراءة القنوات المخفية أو تجاوز صلاحيات السيرفر أو استخدام توكنات البوتات أو الوصول إلى ملفاتك. تُوقف الإضافة المعطّلة دون أن تتأثر الدردشة أو الصوت أو مشاركة الشاشة.",
  // browse
  "Search plugins": "ابحث عن إضافة",
  Category: "الفئة",
  All: "الكل",
  "Browse plugins": "تصفّح الإضافات",
  "Every plugin here was reviewed by Zrzur. Check what each one asks for before you install it.":
    "راجع زرزور كل إضافة هنا. تحقّق مما تطلبه كل واحدة قبل تثبيتها.",
  "Loading…": "جارٍ التحميل…",
  "The plugin store couldn't be loaded": "تعذّر تحميل متجر الإضافات",
  "No plugin matches that": "لا توجد إضافة مطابقة",
  "No plugins are published yet": "لم تُنشر أي إضافات بعد",
  Official: "رسمية",
  // details
  "This plugin isn't available": "هذه الإضافة غير متاحة",
  "Verified publisher": "ناشر موثّق",
  "Review status: {0}": "حالة المراجعة: {0}",
  "Reviewed and approved by Zrzur on {0}.": "راجعها زرزور واعتمدها في {0}.",
  "{0} installs.": "عدد التثبيتات: {0}.",
  "Runs code in an isolated sandbox with no network, no access to the page and limited time and messages.":
    "تشغّل شيفرة داخل بيئة معزولة بلا شبكة ولا وصول إلى الصفحة، مع حدود للوقت والرسائل.",
  "Permissions it asks for": "الأذونات التي تطلبها",
  Install: "تثبيت",
  "Allow {0} to do the things listed above? You can turn it off or uninstall it at any time.":
    "هل تسمح لـ {0} بما هو مذكور أعلاه؟ يمكنك إيقافها أو إلغاء تثبيتها في أي وقت.",
  "Allow and install": "اسمح وثبّت",
  Cancel: "إلغاء",
  Status: "الحالة",
  Enabled: "مفعّلة",
  "Running now.": "تعمل الآن.",
  "Try again": "أعد المحاولة",
  "Clears its error history and starts it again.":
    "يمسح سجل أخطائها ويشغّلها من جديد.",
  Retry: "إعادة المحاولة",
  "Safe Mode is on": "الوضع الآمن مفعّل",
  "No plugin runs until you turn Safe Mode off.":
    "لن تعمل أي إضافة حتى توقف الوضع الآمن.",
  "Switch to a safe version": "انتقل إلى إصدار آمن",
  "This version asks for new permissions:": "يطلب هذا الإصدار أذونات جديدة:",
  "Review and update": "راجع وحدّث",
  "Allow and update": "اسمح وحدّث",
  Update: "تحديث",
  "Plugin settings": "إعدادات الإضافة",
  "Permissions you granted": "الأذونات التي منحتها",
  "Recent problems": "مشكلات حديثة",
  "Kept on this device only. No messages or personal data are recorded.":
    "محفوظة على هذا الجهاز فقط. لا تُسجَّل أي رسائل أو بيانات شخصية.",
  Remove: "إزالة",
  Uninstall: "إلغاء التثبيت",
  "Removes it, its permissions and its settings.":
    "يزيلها مع أذوناتها وإعداداتها.",
  "Yes, uninstall": "نعم، ألغِ التثبيت",
  Versions: "الإصدارات",
  "No changelog.": "لا يوجد سجل تغييرات.",
  Report: "إبلاغ",
  "Thanks, Zrzur will look at it.": "شكرًا، سيطّلع عليها زرزور.",
  "Report this plugin": "أبلغ عن هذه الإضافة",
  "Tell Zrzur if it misbehaves, misleads or looks unsafe.":
    "أخبر زرزور إن أساءت التصرف أو كانت مضلِّلة أو بدت غير آمنة.",
  "What's wrong?": "ما المشكلة؟",
  "Send report": "إرسال البلاغ",
  "What it adds": "ما تضيفه",
  "Theme colours": "ألوان السمة",
  "Reading and motion changes": "تغييرات القراءة والحركة",
  "Changes how notifications are shown": "تغيّر طريقة عرض الإشعارات",
  "Applied whenever this plugin runs.": "تُطبَّق كلما عملت هذه الإضافة.",
  Run: "تشغيل",
  Open: "فتح",
  "Review history": "سجل المراجعة",
  "Reviewer actions": "إجراءات المراجِع",
  "Reason (required)": "السبب (مطلوب)",
  "Suspend plugin": "علّق الإضافة",
  "Reinstate plugin": "أعد الإضافة",
  "Revoke v{0}": "اسحب الإصدار {0}",
  "Suspend publisher": "علّق الناشر",
  // developer
  "That file is too large for a plugin package.":
    "هذا الملف أكبر من أن يكون حزمة إضافة.",
  "That file isn't valid JSON.": "هذا الملف ليس JSON صالحًا.",
  "Submitted. A Zrzur reviewer will look at it; you'll see the result here.":
    "أُرسلت. سيطّلع عليها مراجِع من زرزور، وسترى النتيجة هنا.",
  "Previewing on this device only. Find it under Installed → Local previews.":
    "معاينة على هذا الجهاز فقط. تجدها في المثبّتة ← معاينات محلية.",
  "Previewing code plugins needs a development build of Zrzur.":
    "تتطلب معاينة الإضافات البرمجية نسخة تطوير من زرزور.",
  "Uninstall the store version first to preview this one.":
    "ألغِ تثبيت نسخة المتجر أولًا لمعاينة هذه.",
  "Build a plugin": "ابنِ إضافة",
  "Use the Zrzur plugin SDK: `zrzur-plugin init` makes a project, `validate` checks it and `pack` makes the package you upload here. Plugins describe what they add in a manifest; only official Zrzur plugins can include code for now.":
    "استخدم حزمة تطوير إضافات زرزور: ‎`zrzur-plugin init`‎ ينشئ مشروعًا، و‎`validate`‎ يفحصه، و‎`pack`‎ يصنع الحزمة التي ترفعها هنا. تصف الإضافات ما تضيفه في ملف manifest؛ حاليًا الإضافات الرسمية من زرزور وحدها يمكن أن تتضمن شيفرة.",
  "Your publishing is suspended": "النشر معلّق لحسابك",
  "This account can't publish plugins": "لا يمكن لهذا الحساب نشر إضافات",
  "New plugin": "إضافة جديدة",
  "Plugin id (like yourname.my-plugin)":
    "معرّف الإضافة (مثل yourname.my-plugin)",
  Name: "الاسم",
  "Create plugin": "أنشئ الإضافة",
  Package: "الحزمة",
  "Choose a `.zplugin.json` package (or a manifest) to check it, preview it on this device, or submit it for review.":
    "اختر حزمة ‎`.zplugin.json`‎ (أو ملف manifest) لفحصها أو معاينتها على هذا الجهاز أو إرسالها للمراجعة.",
  "Choose a plugin package": "اختر حزمة إضافة",
  "Valid · {0}": "صالحة · {0}",
  "Scanner notes for the reviewer:": "ملاحظات الفاحص للمراجِع:",
  "What changed (shown to users)": "ما الذي تغيّر (يظهر للمستخدمين)",
  "Submit for review": "أرسل للمراجعة",
  "Preview here": "عاين هنا",
  "Create a plugin with this id first.": "أنشئ إضافة بهذا المعرّف أولًا.",
  "Your plugins": "إضافاتك",
  "You haven't created a plugin yet": "لم تنشئ أي إضافة بعد",
  Withdraw: "اسحب",
  Manifest: "ملف manifest",
  // review
  "Review queue": "طابور المراجعة",
  "Read the manifest, every permission and any code before approving. High-risk releases need an explicit confirmation. You can't approve your own plugin.":
    "اقرأ ملف manifest وكل إذن وأي شيفرة قبل الاعتماد. الإصدارات عالية الخطورة تحتاج إلى تأكيد صريح. لا يمكنك اعتماد إضافتك.",
  "Nothing is waiting for review.": "لا شيء بانتظار المراجعة.",
  "Publisher:": "الناشر:",
  "Hide code": "إخفاء الشيفرة",
  "Show code": "عرض الشيفرة",
  "Note to the publisher (required to reject)": "ملاحظة للناشر (مطلوبة للرفض)",
  "I read the code and every permission, and it's safe to run.":
    "قرأت الشيفرة وكل إذن، وتشغيلها آمن.",
  "I checked who the publisher is: mark them verified":
    "تحققت من هوية الناشر: وثّقه",
  Approve: "اعتماد",
  Reject: "رفض",
  // host
  "Zrzur started in Safe Mode because it didn't start properly with plugins last time. Turn Safe Mode off in Settings → Advanced → Plugins.":
    "بدأ زرزور في الوضع الآمن لأنه لم يعمل بشكل صحيح مع الإضافات في المرة السابقة. أوقف الوضع الآمن من الإعدادات ← متقدم ← الإضافات.",
  "{0} plugin panel": "لوحة الإضافة {0}",
  "Plugin · {0}": "إضافة · {0}",
  Close: "إغلاق",
  "Install, turn on and manage reviewed plugins.":
    "ثبّت الإضافات المراجَعة وشغّلها وأدرها.",
  "New message": "رسالة جديدة",
};

/** Lingui's message id: first 6 chars of base64url(sha256(message + US)) */
async function messageId(message: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(message + "\u001F"),
    ),
  );
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .slice(0, 6);
}

/** Compile `{name}` placeholders into Lingui's compiled message form */
function compile(message: string): string | (string | [string])[] {
  if (!/\{[A-Za-z0-9_]+\}/.test(message)) return message;
  const parts: (string | [string])[] = [];
  let last = 0;
  for (const match of message.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
    if (match.index! > last) parts.push(message.slice(last, match.index));
    parts.push([match[1]]);
    last = match.index! + match[0].length;
  }
  if (last < message.length) parts.push(message.slice(last));
  return parts;
}

let registered: Promise<void> | undefined;

/** Add the plugin screens' Arabic to Lingui (once) */
export function registerPluginTranslations() {
  registered ??= (async () => {
    // never override wording the shared catalog already has
    const existing =
      (
        i18n as unknown as {
          _messages?: Record<string, Record<string, unknown>>;
        }
      )._messages?.ar ?? {};
    const messages: Record<string, unknown> = {};
    for (const [source, translated] of Object.entries(PLUGINS_AR)) {
      const id = await messageId(source);
      if (!(id in existing)) messages[id] = compile(translated);
    }
    i18n.load("ar", messages as Messages);
  })().catch(() => void 0);
  return registered;
}
