# Mafia Party

لعبة مافيا عربية بنظام تمرير الهاتف، تدعم من ٥ إلى ٥٠ لاعباً وتدير الأدوار السرية والليل والنهار والتصويت.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mafia-party/src/App.tsx` — تجربة اللعب كاملة، تعريف الأدوار، وتخزين الجولة محلياً.
- `artifacts/mafia-party/src/index.css` — الثيم RTL والهوية البصرية المتجاوبة.
- `artifacts/mafia-party` — تطبيق الويب القابل للفتح من الهاتف والكمبيوتر.
- `artifacts/mafia-party/android` — غلاف Android محلي يفتح اللعبة دون خادم.
- `.github/workflows/android-apk.yml` — بناء APK تلقائيًا ورفعه كـ GitHub Actions artifact.

## Architecture decisions

- النسخة الحالية Pass-and-play على جهاز واحد، لتبقى بطاقات الأدوار خاصة بدون تسجيل دخول أو خادم مركزي.
- حالة اللعبة تحفظ في `localStorage` لاستعادة الجولة بعد إغلاق المتصفح أو تحديث الصفحة.
- واجهة اللعبة عربية RTL ومصممة أولاً للهاتف مع دعم الشاشات الأكبر.
- الليل يمر على كل لاعب حي بالتتابع، مع شاشة تسليم وإخفاء بعد كل قدرة أو تخطٍ، حتى لا تظهر أدوار اللاعبين لبعضهم.

## Product

- إدخال ٥–٥٠ اسماً مع منع التكرار.
- إعداد أدوار يدوي كامل بلا presets عادية، مع حد أقصى وشرح قوة وصلاحية كل دور.
- أدوار أساسية ومخترعة مثل المخرّب، المسعف الميداني، المحلل النفسي، المتعقّب، مراسل المدينة، العرّافة، المخادع، والزائر الغريب.
- اقتراحات نقاش صباحية اختيارية يمكن تعطيلها قبل بدء اللعبة، ولا تكشف أدوارًا أو تقدم دليلًا زائفًا.
- كشف خاص، أفعال ليلية، تقرير صباحي، تصويت، وتعادل يحسمه العمدة.
- حفظ الجولة، استئنافها، وإعادة ضبطها مع تأكيد.

## User preferences

- المستخدم طلب واجهة بسيطة وجميلة وتجربة كاملة باللغة العربية.

## Gotchas

- تمرير الهاتف جزء أساسي من الخصوصية: يجب إخفاء الشاشة بعد كل كشف أو نتيجة تحقيق.
- بناء APK يحتاج Java 17 وAndroid SDK محليًا؛ عند عدم توفرهما استخدم Workflow GitHub Actions المرفق.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
