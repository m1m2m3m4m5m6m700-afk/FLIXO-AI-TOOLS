export type WhyFlixoSection = Readonly<{
  id: string;
  title: string;
  body: string[];
  bullets?: string[];
  table?: ReadonlyArray<readonly [string, string]>;
}>;

export const WHY_FLIXO = Object.freeze({
  ar: Object.freeze({
    button: 'لماذا FLIXO؟',
    eyebrow: 'THE PRIVACY-FIRST EDITOR MANIFESTO',
    title: 'لماذا FLIXO؟',
    lead: 'لا نطلب منك أن تثق بنا. نبني المنتج بحيث يكون ما لا نملكه أصلًا هو جزءًا من الحماية.',
    close: 'إغلاق',
    verify: 'تحقق بنفسك',
    sections: Object.freeze([
      Object.freeze({
        id: 'truth',
        title: 'قبل أي شيء — تعريف صادق',
        body: [
          'FLIXO ليس محررًا يعمل في السحابة ثم يدّعي الخصوصية.',
          'الفكرة المعمارية التي ندافع عنها أبسط: كلما كانت ملفاتك داخل المتصفح وعلى جهازك، قلّت البيانات التي يمكن أن تغادره.',
          'الخصوصية هنا ليست زرًا تجميليًا يمكن تشغيله وإيقافه؛ هي قرار هندسي يجب أن يكون مرئيًا ويمكن التحقق منه.'
        ]
      }),
      Object.freeze({
        id: 'why',
        title: 'السؤال الوحيد المهم',
        body: [
          'كل منتج يقول: «نحن نهتم بخصوصيتك». السؤال الأفضل هو: ماذا تستطيع البنية نفسها أن تمنع؟',
          'في FLIXO، هدفنا أن تتحول الخصوصية من وعد تسويقي إلى خاصية قابلة للفحص: معالجة محلية حيثما يسمح المنتج، وعدم إرسال الملف عندما لا تكون هناك حاجة لذلك.'
        ],
        bullets: [
          'الوعد يعتمد على السياسة والنوايا.',
          'الضمان التقني يعتمد على ما تسمح به البنية فعليًا.',
          'لهذا نعرض للمستخدم ما يحدث بدل أن نطلب منه الإيمان به.'
        ]
      }),
      Object.freeze({
        id: 'tradeoffs',
        title: 'التنازل كتأكيد',
        body: [
          'كل ميزة لم نبنها ليست بالضرورة نقصًا. عندما نحذف اعتمادًا سحابيًا غير ضروري، نحذف معه فئة كاملة من المخاطر والمسارات التي يجب حمايتها.'
        ],
        table: [
          ['ما لا نبنيه', 'ما نريد أن يثبته للمستخدم'],
          ['لا تخزين سحابي للملفات عند تنفيذ الأداة محليًا', 'تقليل سطح البيانات الذي يمكن أن يغادر الجهاز'],
          ['لا تتبع غير ضروري', 'تقليل البصمة السلوكية'],
          ['لا مزامنة سحابية مفروضة', 'الملف يبقى تحت سيطرة المستخدم عندما تعمل الأداة محليًا'],
          ['لا مفاتيح API يديرها المستخدم داخل الواجهة', 'تقليل تسرب الأسرار إلى تجربة التحرير'],
          ['لا AI سحابي عند توفر مسار محلي مناسب', 'المعالجة الحساسة تبقى أقرب إلى جهاز المستخدم']
        ]
      }),
      Object.freeze({
        id: 'limits',
        title: 'لكن ماذا عن التنازلات؟',
        body: [
          'الصدق جزء من المنتج. الخصوصية القوية تعني أحيانًا قبول حدود حقيقية: لا مزامنة تلقائية بين الأجهزة، ولا تعاون سحابي لحظي، وبعض مهام الذكاء الاصطناعي قد تحتاج موارد محلية أو مسارًا خارجيًا واضحًا.',
          'التنازل هنا مقصود: المستخدم يعرف ما يكسبه مقابل ما لا نقدمه.'
        ],
        bullets: [
          'لا مزامنة تلقائية بين الأجهزة: تحكم أكبر في مكان المشروع.',
          'لا تعاون سحابي مفروض: لا يرى المشروع طرف آخر دون مشاركة مقصودة.',
          'قدرات محلية محدودة بقدرات الجهاز: لا سقف خفي تفرضه فاتورة سحابية على ملفك.',
          'الحفظ المحلي يعني أن فقدان تخزين المتصفح قد يعني فقدان المشروع: الحماية لا تلغي مسؤولية النسخ الاحتياطي.'
        ]
      }),
      Object.freeze({
        id: 'audience',
        title: 'لمن بنينا FLIXO؟',
        body: [
          'FLIXO موجه خصوصًا لمن يتعامل مع صور وفيديو ومعلومات لا يريد أن تتحول تلقائيًا إلى بيانات طرف ثالث.'
        ],
        bullets: [
          'الصحفيون والتحقيقات: مواد لم تُنشر ومصادر حساسة.',
          'المحامون والباحثون: مستندات وأدلة تحتاج إلى تقليل مسارات التسريب.',
          'الأطباء والفرق البحثية: مواد قد تتطلب عناية إضافية بالخصوصية والحوكمة.',
          'أي شخص يريد تحرير ملفه دون رفعه إلى خدمة تحرير لمجرد تنفيذ عملية محلية.'
        ]
      }),
      Object.freeze({
        id: 'verification',
        title: 'تحقق بنفسك — لا تثق بنا فقط',
        body: [
          'الخصوصية الجيدة لا تحتاج إلى تصفيق. تحتاج إلى أدلة.',
          'افتح DevTools وراقب Network. وعندما تعرض FLIXO بيانات شبكة أو إيصال خصوصية، اعتبرها طبقة شفافية تساعدك على الفحص، لا بديلًا عن الفحص نفسه.'
        ],
        bullets: [
          'Network Monitor: ما هي الاتصالات التي خرجت من الصفحة؟',
          'Privacy Receipt: ما الذي حدث أثناء العملية الحالية؟',
          'الكود المصدري: هل السلوك المعلن يتطابق مع التنفيذ؟'
        ]
      }),
      Object.freeze({
        id: 'trust',
        title: 'المعيار الحقيقي للثقة',
        body: [
          'عندما يقول المستخدم «أنا أثق بـ FLIXO»، نريد أن تكون الثقة مبنية على شيء يمكن فحصه: أقل بيانات ممكنة، معالجة محلية حيثما أمكن، وحدود معلنة بوضوح.'
        ],
        bullets: [
          'لا ثقة عمياء في السياسة وحدها.',
          'لا أسرار مخفية خلف عبارة «خصوصية أولًا».',
          'لا فرق بين ما نقوله وما يستطيع المستخدم التحقق منه.'
        ]
      }),
      Object.freeze({
        id: 'free',
        title: 'لماذا المجانية مختلفة هنا؟',
        body: [
          'المجانية ليست وعدًا بأن لا توجد تكاليف إلى الأبد. المقصود أن تجربة التحرير المحلية لا تحتاج إلى تحويل ملفات المستخدم إلى مصدر دخل.',
          'عندما تكون المعالجة محلية، لا توجد ضرورة لبناء نموذج أعمال قائم على استضافة كل ملف يرفعه المستخدم.'
        ]
      }),
      Object.freeze({
        id: 'promise',
        title: 'الوعد الوحيد',
        body: [
          'لا نعد بأن FLIXO هو أسرع محرر في العالم أو أنه يفعل كل شيء.',
          'نعد بشيء أكثر قابلية للفحص: عندما تكون العملية مصممة لتعمل محليًا، لا نحتاج إلى رؤية الملف كي ننفذها.'
        ]
      }),
      Object.freeze({
        id: 'manifesto',
        title: 'العبارات التي تلخّص الفكرة',
        bullets: [
          'بياناتك لا تترك جهازك عندما تكون الأداة محلية.',
          'لا تخزن ما لا تحتاج إلى تخزينه.',
          'لا تثق بنا فقط — تحقق بنفسك.',
          'الخصوصية في FLIXO قرار معماري، وليست ملصقًا تسويقيًا.',
          'المستخدم يملك الملف؛ الواجهة تساعده على العمل عليه.'
        ]
      }),
      Object.freeze({
        id: 'closing',
        title: 'الخلاصة',
        body: [
          'FLIXO لا يريد أن تكون الخصوصية فقرة صغيرة في سياسة استخدام طويلة.',
          'نريد أن تكون الخصوصية جزءًا من طريقة بناء المحرر نفسه: بيانات أقل، معالجة محلية حيثما يمكن، وشفافية أكبر حول ما يحدث فعلًا.'
        ]
      })
    ] as const)
  }),
  en: Object.freeze({
    button: 'Why FLIXO?',
    eyebrow: 'THE PRIVACY-FIRST EDITOR MANIFESTO',
    title: 'Why FLIXO?',
    lead: 'We do not ask for blind trust. We design the product so that data we do not need is not part of the editing path.',
    close: 'Close',
    verify: 'Verify yourself',
    sections: Object.freeze([
      Object.freeze({
        id: 'truth',
        title: 'First — an honest definition',
        body: [
          'FLIXO is built around browser-first, local processing where the tool allows it.',
          'Privacy is not a decorative toggle. It is an architectural decision that should be visible and verifiable.'
        ]
      }),
      Object.freeze({
        id: 'why',
        title: 'The only important question',
        body: [
          'Every product can say it cares about privacy. The stronger question is: what can the architecture itself prevent?',
          'FLIXO aims to make privacy inspectable: process locally where appropriate and avoid sending the original file when the task does not require it.'
        ]
      }),
      Object.freeze({
        id: 'tradeoffs',
        title: 'A trade-off can be a protection',
        body: [
          'Removing an unnecessary cloud dependency can also remove an entire class of storage, transfer, and access paths.'
        ],
        table: [
          ['What we avoid', 'What it is intended to improve'],
          ['Unnecessary cloud file storage', 'A smaller data surface outside the device'],
          ['Unnecessary tracking', 'A smaller behavioral footprint'],
          ['Forced cloud sync', 'More direct control over local projects'],
          ['Unnecessary API-key handling', 'Fewer secrets exposed to the editing experience'],
          ['Cloud AI where a local path is suitable', 'Sensitive work can stay closer to the device']
        ]
      }),
      Object.freeze({
        id: 'limits',
        title: 'And what about the trade-offs?',
        body: [
          'Strong privacy can require real limits: no forced automatic cloud sync, no built-in live cloud collaboration, and some AI workloads may depend on local device resources or an explicitly disclosed external path.'
        ]
      }),
      Object.freeze({
        id: 'audience',
        title: 'Who is FLIXO for?',
        body: [
          'FLIXO is especially useful for people working with images, video, and information they do not want to turn into third-party data by default.'
        ],
        bullets: [
          'Journalists and investigators.',
          'Lawyers, researchers, and evidence-heavy workflows.',
          'Medical and research teams with privacy-sensitive material.',
          'Anyone who wants to edit locally when a cloud upload is unnecessary.'
        ]
      }),
      Object.freeze({
        id: 'verification',
        title: 'Verify it yourself',
        body: [
          'Privacy should produce evidence, not applause. Use browser DevTools and inspect Network activity yourself.'
        ],
        bullets: [
          'Network Monitor: what connections left the page?',
          'Privacy Receipt: what happened during this operation?',
          'Source code: does the implementation match the claim?'
        ]
      }),
      Object.freeze({
        id: 'trust',
        title: 'The real trust standard',
        body: [
          'When a user says “I trust FLIXO,” we want that trust grounded in inspectable architecture: less data, local processing where possible, and explicit limits.'
        ]
      }),
      Object.freeze({
        id: 'free',
        title: 'Why the free model is different here',
        body: [
          'Local editing does not require turning every uploaded file into a hosted asset or a behavioral data source.'
        ]
      }),
      Object.freeze({
        id: 'promise',
        title: 'The one promise',
        body: [
          'We do not promise to be the fastest editor in the world or to do everything.',
          'We aim for something more testable: when a workflow is designed to run locally, the editor does not need to see the original file to perform that local operation.'
        ]
      }),
      Object.freeze({
        id: 'manifesto',
        title: 'The lines that summarize it',
        bullets: [
          'Your data stays on your device when the operation is local.',
          'Do not store what you do not need to store.',
          'Do not trust us only — verify.',
          'Privacy is an architectural choice, not a marketing sticker.'
        ]
      }),
      Object.freeze({
        id: 'closing',
        title: 'In one line',
        body: [
          'FLIXO treats privacy as part of how the editor is built: less data, more local processing where possible, and clearer evidence of what actually happened.'
        ]
      })
    ] as const)
  })
} as const);
