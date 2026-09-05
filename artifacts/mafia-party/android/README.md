# Mafia Party Android APK

هذا المشروع عبارة عن غلاف Android محلي للعبة الويب. لا يحتاج خادمًا أو حسابًا؛ تحفظ الجولة داخل الجهاز باستخدام `localStorage`.

## بناء APK محليًا

تحتاج إلى Java 17 وAndroid SDK وGradle 8.9 أو أحدث:

```bash
cd artifacts/mafia-party
pnpm run build:android
cd android
gradle assembleDebug
```

سيظهر الملف هنا:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## بناء APK على GitHub

الملف `.github/workflows/release.yml` يبني APK مع نسخة Windows تلقائيًا عند دفع
tag مثل `v1.0.0` أو من تبويب Actions يدويًا، ثم ينشئ GitHub Release بالملفين.