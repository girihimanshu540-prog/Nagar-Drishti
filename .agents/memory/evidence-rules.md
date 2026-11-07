---
name: Field acceptance evidence
description: What evidence is needed to claim real-world road repair verification works.
---

Do not describe passing deterministic closure-policy fixtures or a successful vision
connectivity check as proof that real-world repairs can be verified accurately.

**Why:** The requested acceptance cases include genuinely repaired same-location photos.
Synthetic image examples and injected vision verdicts prove policy execution, not whether
the vision model and feature matching correctly identify physical repairs.

**How to apply:** Keep observed policy-test results separate from genuine live-camera,
known-location before/after field acceptance. Closure accuracy and cross-device acceptance
need authentic evidence and the relevant clients, not seeded score examples.

Field validation is paused until authentic known-location before/after photos are
available. Continue native Expo app development separately; do not use demo images
or claim field validation passed.

**Why:** The user said they do not have authentic before-and-after photos from a
known location yet and explicitly requested this pause.

**How to apply:** Resume field acceptance only when genuine evidence is available.
Keep the native app deliverable separate from claims about real-world accuracy.
