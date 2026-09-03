---
name: Windows packaging
description: Cross-platform Electron packaging behavior for this project.
---

Electron Builder can create the Windows `dir` target from the Linux workspace, producing a runnable `win-unpacked` folder with `Mafia Party.exe`. The NSIS installer target is not dependable here because Wine may be absent or incompatible.

**Why:** The portable target completed successfully, while the NSIS target failed when Wine could not execute the generated Windows helper.

**How to apply:** Use the portable build for workspace verification and build the NSIS installer on Windows or a known-good Wine runner.