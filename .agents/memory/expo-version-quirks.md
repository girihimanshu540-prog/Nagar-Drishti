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
