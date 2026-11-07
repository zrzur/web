import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const translations = {
  "Voice participant actions": [
    "إجراءات المشارك الصوتي",
    "Aktionen für Sprachteilnehmer",
  ],
  "View profile": ["عرض الملف الشخصي", "Profil ansehen"],
  "Send message": ["إرسال رسالة", "Nachricht senden"],
  "Local volume": ["مستوى الصوت عندي", "Lokale Lautstärke"],
  "Unmute for me": ["إلغاء الكتم عندي", "Für mich Stummschaltung aufheben"],
  "Mute for me": ["كتم عندي", "Für mich stummschalten"],
  "Mute microphone": ["كتم الميكروفون", "Mikrofon stummschalten"],
  "Unmute microphone": ["إلغاء كتم الميكروفون", "Mikrofon aktivieren"],
  "Undeafen myself": ["تشغيل الصوت عندي", "Eigenen Ton einschalten"],
  "Deafen myself": ["إيقاف الصوت عندي", "Eigenen Ton ausschalten"],
  "Leave voice": ["مغادرة المحادثة الصوتية", "Sprachkanal verlassen"],
  "Voice moderation": ["الإشراف الصوتي", "Sprachmoderation"],
  "Remove server mute": [
    "إلغاء الكتم من السيرفر",
    "Server-Stummschaltung aufheben",
  ],
  "Server mute": ["كتم من السيرفر", "Auf dem Server stummschalten"],
  "Remove server deafen": [
    "إلغاء إيقاف الصوت من السيرفر",
    "Server-Tonausschaltung aufheben",
  ],
  "Server deafen": ["إيقاف الصوت من السيرفر", "Ton auf dem Server ausschalten"],
  "Server muted": ["مكتوم من السيرفر", "Vom Server stummgeschaltet"],
  "Server deafened": ["الصوت متوقف من السيرفر", "Ton vom Server ausgeschaltet"],
  "Move to voice channel": [
    "نقل إلى غرفة صوتية",
    "In einen Sprachkanal verschieben",
  ],
  "Destination voice channel": ["الغرفة الصوتية الوجهة", "Zielsprachkanal"],
  "No accessible voice channels": [
    "لا توجد غرف صوتية متاحة",
    "Keine zugänglichen Sprachkanäle",
  ],
  "Disconnect from voice": [
    "فصل من المحادثة الصوتية",
    "Aus dem Sprachkanal trennen",
  ],
  "Voice state updated.": [
    "تم تحديث الحالة الصوتية.",
    "Sprachstatus aktualisiert.",
  ],
  "Applying…": ["جارٍ التطبيق…", "Wird angewendet…"],
  "Waiting for voice state…": [
    "بانتظار تأكيد الحالة الصوتية…",
    "Sprachstatus wird bestätigt…",
  ],
  "The server has not confirmed the voice change. Check the participant state before retrying.":
    [
      "لم يؤكد السيرفر التغيير الصوتي. تحقق من حالة المشارك قبل إعادة المحاولة.",
      "Der Server hat die Änderung nicht bestätigt. Prüfe den Teilnehmerstatus vor einem erneuten Versuch.",
    ],
  "This voice channel is full.": [
    "هذه الغرفة الصوتية ممتلئة.",
    "Dieser Sprachkanal ist voll.",
  ],
  "You don't have permission.": [
    "ليست لديك الصلاحية.",
    "Dir fehlt die Berechtigung.",
  ],
  "That member's role is too high.": [
    "رتبة هذا العضو أعلى من الصلاحية المتاحة.",
    "Die Rolle dieses Mitglieds ist zu hoch.",
  ],
  "You can't do that to the server owner.": [
    "لا يمكنك تنفيذ هذا الإجراء على مالك السيرفر.",
    "Diese Aktion ist beim Serverinhaber nicht möglich.",
  ],
  "That member is not in a voice channel.": [
    "هذا العضو ليس في غرفة صوتية.",
    "Dieses Mitglied ist in keinem Sprachkanal.",
  ],
  "That voice channel is no longer available.": [
    "هذه الغرفة الصوتية لم تعد متاحة.",
    "Dieser Sprachkanal ist nicht mehr verfügbar.",
  ],
  "Allow microphone or camera access in your browser settings.": [
    "اسمح باستخدام الميكروفون أو الكاميرا من إعدادات المتصفح.",
    "Erlaube Mikrofon oder Kamera in den Browsereinstellungen.",
  ],
  "No media device was found. Check your device settings.": [
    "لم يتم العثور على جهاز صوت أو فيديو. تحقق من إعدادات الأجهزة.",
    "Kein Mediengerät gefunden. Prüfe deine Geräteeinstellungen.",
  ],
  "Voice connection failed. Check your connection and try again.": [
    "تعذر الاتصال الصوتي. تحقق من اتصالك وحاول مجددًا.",
    "Sprachverbindung fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut.",
  ],
  "User limit": ["الحد الأقصى للمشاركين", "Teilnehmerlimit"],
  Unlimited: ["بلا حد", "Unbegrenzt"],
  "Leave empty for unlimited participants. Lowering the limit does not disconnect anyone.":
    [
      "اتركه فارغًا للسماح بعدد غير محدود. تخفيض الحد لا يفصل المشاركين الحاليين.",
      "Leer lassen für unbegrenzte Teilnehmer. Ein niedrigeres Limit trennt niemanden.",
    ],
  Participants: ["المشاركون", "Teilnehmer"],
  Full: ["ممتلئة", "Voll"],
  "Room full. Admission is checked by the server.": [
    "الغرفة ممتلئة. يتحقق السيرفر من إمكانية الانضمام.",
    "Raum voll. Der Server prüft den Zutritt.",
  ],
  "You don't have permission to join.": [
    "ليست لديك صلاحية الانضمام.",
    "Du hast keine Berechtigung zum Beitreten.",
  ],
  "Voice Connected": ["متصل بالصوت", "Sprache verbunden"],
  "Full screen": ["ملء الشاشة", "Vollbild"],
  "Exit full screen": ["الخروج من ملء الشاشة", "Vollbild beenden"],
  Disconnect: ["قطع الاتصال", "Verbindung trennen"],
  "Camera unavailable": ["الكاميرا غير متاحة", "Kamera nicht verfügbar"],
  "Screen share unavailable": [
    "مشاركة الشاشة غير متاحة",
    "Bildschirmfreigabe nicht verfügbar",
  ],
  "Join Voice": ["انضم إلى الغرفة الصوتية", "Sprachkanal beitreten"],
  "Switch to this channel": [
    "الانتقال إلى هذه الغرفة",
    "Zu diesem Kanal wechseln",
  ],
  "No one is here yet. Start the conversation.": [
    "لا يوجد أحد هنا بعد. ابدأ المحادثة.",
    "Noch niemand hier. Starte das Gespräch.",
  ],
  "1 person is in this voice channel": [
    "شخص واحد في هذه الغرفة الصوتية",
    "1 Person ist in diesem Sprachkanal",
  ],
  "{0} people are in this voice channel": [
    "{0} أشخاص في هذه الغرفة الصوتية",
    "{0} Personen sind in diesem Sprachkanal",
  ],
};
for (const locale of ["en", "ar", "de"]) {
  const index = ["ar", "de"].indexOf(locale);
  const path = `components/i18n/catalogs/${locale}/messages.po`;
  const extracted = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const baseline = execFileSync(
    "git",
    ["show", `HEAD:packages/client/${path}`],
    { encoding: "utf8" },
  ).replace(/\r\n/g, "\n");
  const messageKey = (block) => {
    const match = block.match(/^msgid (".*"(?:\n".*")*)/m);
    return match
      ? match[1]
          .split("\n")
          .map((line) => JSON.parse(line))
          .join("")
      : undefined;
  };
  const existing = new Set(baseline.split("\n\n").map(messageKey));
  const added = extracted.split("\n\n").filter((block) => {
    const key = messageKey(block);
    return key && translations[key] && !existing.has(key);
  });
  const source = baseline.trimEnd() + "\n\n" + added.join("\n\n") + "\n";
  let count = 0;
  const updated = source
    .split("\n\n")
    .map((block) => {
      const match = block.match(/^msgid (".*"(?:\n".*")*)/m);
      if (!match) return block;
      const key = match[1]
        .split("\n")
        .map((line) => JSON.parse(line))
        .join("");
      if (!translations[key] || index < 0) return block;
      count++;
      return block.replace(
        /^msgstr ".*"(?:\n".*")*/m,
        "msgstr " + JSON.stringify(translations[key][index]),
      );
    })
    .join("\n\n");
  writeFileSync(path, updated);
  console.log(`${locale}: ${count} voice strings translated`);
}
