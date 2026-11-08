---
name: Expo navigation and configuration compatibility
description: SDK-specific pitfalls when maintaining the NagarDrishti native companion alongside its web app.
---

Use the installed Expo Router's navigation hooks, not a separately installed
React Navigation context.

**Why:** In this project's Expo SDK 58, Router vendors its own navigation
implementation. External React Navigation hooks compile and even bundle, but
crash at runtime with a missing-navigation-context error on the camera screen.
Bundle success is not proof that screen-level navigation hooks work.

**How to apply:** Check the installed Router exports when adding navigation
hooks, and confirm a changed authenticated route at runtime. Older Expo examples
may import from a different context. This SDK also validates splash configuration
through its splash-screen plugin rather than the older top-level splash field;
use Expo's compatibility/schema checks instead of assuming older config examples
still apply.

Restart Metro after shared API code generation if it reports missing generated
modules even though generation and type checks succeeded.

**Why:** The generator temporarily deletes its output directory. Metro can retain
the resulting failed module resolution after those files have been recreated;
restarting the existing mobile workflow cleared that state.

**How to apply:** Finish code generation first, verify the files exist, then
restart the mobile workflow only if Metro remains in that failed state. Do not
rewrite imports or generate a duplicate client to work around it.
