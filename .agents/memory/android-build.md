---
name: Android build
description: Constraints and the supported path for producing an APK from this workspace.
---

The workspace can prepare an Android WebView project and copy the Vite build into its assets, but it does not provide Android SDK tooling by default. The reliable release path is the repository workflow, which installs Java, Android SDK packages, Gradle, builds the web assets, and uploads the APK artifact.

**Why:** A local Gradle attempt cannot run without Android SDK and Gradle, while the GitHub runner provides both through explicit setup steps.

**How to apply:** Keep the Android project source and the GitHub workflow together; treat a locally copied web build as preparation, not proof that an APK was produced.