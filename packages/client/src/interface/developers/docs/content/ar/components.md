# الأزرار والقوائم والنماذج

ضع أزرارًا وقوائم اختيار على رسالة، ورتب المحتوى في كتل، واطلب مدخلات بنموذج. البوتات وحدها ترسل المكوّنات.

## ما تحتاج إليه {#you-will-need}

نية الاتصال `INTERACTIONS`. تصل كل نقرة في صورة `InteractionCreate` من نوع `Component`، وكل نموذج من نوع `ModalSubmit`. ولكليهما الثواني الثلاث نفسها كالأمر: انظر [المهل الزمنية](/developers/docs/interactions#time-limits).

## الأزرار {#buttons}

في الرسالة `components`، وهي قائمة كتل. يحمل `ActionRow` حتى خمسة أزرار أو قائمة اختيار واحدة.

@@0

| الحقل       | المعنى                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| `style`     | `Primary` أو `Secondary` أو `Success` أو `Danger` أو `Link`             |
| `label`     | حتى 80 حرفًا. يحتاج الزر إلى `label` أو `emoji`                         |
| `emoji`     | حتى 32 حرفًا، بلا مسافات                                                |
| `custom_id` | حتى 100 حرف، يُرسل إلى بوتك، وفريد في الرسالة. لا يكون مع `Link`        |
| `url`       | مع `Link` فقط. يفتح العنوان ولا ينتج تفاعلًا                            |
| `disabled`  | ظاهر لكنه غير قابل للاستخدام                                            |
| `restrict`  | من يستطيع استخدامه، انظر أدناه                                          |

ضع ما تحتاج إليه في `custom_id`، مثل `flip:heads` أو `note:3`، فيعود إليك في `interaction.component.custom_id`. رد بـ`UpdateMessage` لتغيير الرسالة، أو `Message` لرسالة جديدة.

## من يستطيع النقر {#restrict}

@@1

حتى 25 معرّفًا لكل منهما. يرفض السيرفر نقرات غيرهم، فلا يراها بوتك. لا يصلح لأزرار `Link` ولا لحقول النماذج.

## قوائم الاختيار {#selects}

| `type`              | تعرض               | حقول إضافية                        |
| ------------------- | ------------------ | ---------------------------------- |
| `StringSelect`      | قائمتك أنت         | `options`، من 1 إلى 25             |
| `UserSelect`        | الأعضاء            | `default_values`                   |
| `RoleSelect`        | الأدوار            | `default_values`                   |
| `MentionableSelect` | الأعضاء والأدوار   | `default_values`                   |
| `ChannelSelect`     | القنوات            | `default_values` و`channel_types`  |

تأخذ كلها `custom_id` و`placeholder` (حتى 150) و`min_values` و`max_values` (من 0 إلى 25، والافتراضي 1) و`disabled` و`restrict`.

لعنصر `options` الحقلان `label` و`value` (كل منهما حتى 100، في سطر واحد)، وله أن يحمل `description` و`emoji` و`default`. القيم فريدة.

@@2

يصل الاختيار في `interaction.component.values`. وتأتي المستخدمون والأدوار والقنوات كائنات أيضًا في `interaction.component.resolved`.

## كتل التخطيط {#blocks}

| `type`      | الحقول                                                 | تعرض                               |
| ----------- | ------------------------------------------------------ | ---------------------------------- |
| `ActionRow` | `components`                                           | أزرار أو قائمة اختيار واحدة        |
| `Text`      | `content`                                              | نص Markdown                        |
| `Section`   | `text` (من 1 إلى 3)، و`button` أو `thumbnail`          | فقرات يليها عنصر في النهاية        |
| `Gallery`   | `items` (من 1 إلى 10)                                  | صور في شبكة                        |
| `File`      | `attachment` و`spoiler`                                | ملف من هذه الرسالة في مكانه        |
| `Separator` | `divider` و`spacing` (`Small` أو `Large`)              | فراغ                               |
| `Container` | `components` و`accent` (`#RRGGBB`) و`spoiler`          | بطاقة حول كتل أخرى                 |

للصورة `url` أو `attachment` (معرّف ملف في الرسالة نفسها)، ولها أن تحمل `description` و`spoiler`. لا تتداخل الحاويات.

## حدود الرسالة {#limits}

| ما يُحدّ                                           | الحد |
| -------------------------------------------------- | ---- |
| الصفوف في المستوى الأعلى، وداخل الحاوية الواحدة    | 5    |
| الكتل والمكوّنات معًا، مع المتداخلة                | 40   |
| الأزرار في الصف                                    | 5    |
| كل نص كتل `Text` و`Section` معًا                   | 4000 |

تتخطى التطبيقات الكتل التي لا تعرفها. أما الويب هوك الذي لا يتبع بوتًا فلا ينشر إلا كتلًا لا يمكن التفاعل معها: نصوصًا وصورًا وأزرار روابط.

## النماذج {#forms}

يفتح النموذج على شاشة الشخص ردًا على أمر أو نقرة. لا يكون ردًا على نموذج آخر ولا على إكمال تلقائي.

@@3

لحقل `title` حتى 45 حرفًا. في النموذج حتى 5 حقول، وحتى 10 كتل مع `Text`. يحمل `Field` الحقول `label` و`description` (حتى 100) و`component` واحدًا:

| `component.type` | الحقول                                                         | تصل القيمة في     |
| ---------------- | -------------------------------------------------------------- | ----------------- |
| `TextInput`      | `style` (`Short` أو `Paragraph`) و`placeholder` و`required` و`min_length` و`max_length` (حتى 4000) و`value` | `value` |
| `RadioGroup`     | `options` (حتى 10) و`required`                                 | `value`           |
| `CheckboxGroup`  | `options` (حتى 10) و`min_values` و`max_values` و`required`     | `values`          |
| `Checkbox`       | `default`                                                      | `checked`         |
| `FileUpload`     | `min_values` و`max_values` (حتى 10) و`file_types` و`required`  | `values`، معرّفات ملفات |
| قائمة اختيار     | كما سبق                                                        | `values`          |

`required` يساوي `true` ما لم تحدد غير ذلك. يسرد `file_types` القيم `image` أو `video` أو `audio` أو امتدادًا مثل `.pdf`.

حين يرسل الشخص النموذج يصلك تفاعل من نوع `ModalSubmit`:

@@4

رد خلال 3 ثوانٍ. لا يعمل `UpdateMessage` إلا إذا فُتح النموذج من زر.

قد يغلق الشخص النموذج ولا يسمع بوتك شيئًا، فلا تنتظره.

## الأخطاء الشائعة {#errors}

| الخطأ              | السبب                                      | الحل                              |
| ------------------ | ------------------------------------------ | --------------------------------- |
| `FailedValidation` | حد أو قاعدة، ويبيّن `error` أيها           | صحّح المكوّنات                    |
| `InvalidOperation` | `Modal` ردًا على نموذج                     | رد بـ`Message`                    |
| `IsBot`            | حاول بوت النقر                             | الأشخاص وحدهم يستخدمون المكوّنات  |

## التالي {#next}

- [ابنِ بوتًا كاملًا](/developers/docs/tutorial-full-bot)
- [ألعاب بالأزرار](/developers/docs/tutorial-games)
