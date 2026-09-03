# Mafia Party for Windows

هذه المجلدات تغلّف نسخة الويب المحلية داخل تطبيق Electron مستقل.

## بناء ملف التثبيت

من مجلد `artifacts/mafia-party`:

```bash
pnpm install
pnpm run build:desktop
```

سيظهر التطبيق المحمول داخل `release/win-unpacked/`، والملف القابل للتشغيل هو `Mafia Party.exe`.
يجب إبقاء الملف داخل مجلد `win-unpacked` مع بقية الملفات الموجودة بجانبه.

لبناء مُثبّت Windows تقليدي باسم `Mafia Party Setup.exe`، شغّل:

```bash
pnpm run build:desktop:installer
```

يفضّل تشغيل أمر المُثبّت على Windows لتجنب اعتماد NSIS على Wine عند البناء من Linux.

## التشغيل أثناء التطوير

```bash
BASE_PATH=./ PORT=3000 pnpm run build
pnpm exec electron .
```

لا تحتاج اللعبة إلى اتصال إنترنت بعد تثبيتها؛ الجولة تحفظ داخل جهاز اللاعب باستخدام localStorage.