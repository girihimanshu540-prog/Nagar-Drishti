---
name: Model validation provenance
description: Distinguish ONNX metadata from verified training-label class indices.
---

Do not remap pothole output channels or diagnose low confidence from class names
alone. Check the exact training export's class configuration and numeric labels
against the exported model, then compare predictions with labeled boxes.

**Why:** The model's class names contain dataset attribution text, while a public
annotation in its referenced source dataset uses a different pothole index.
This is a mapping warning, not proof of the numeric mapping used during training.
The referenced dataset version also specifies stretching, so standard YOLO
letterboxing must not automatically be assumed to fix preprocessing.

**How to apply:** Require the actual training configuration and validation
images/labels before changing class selection or claiming detector accuracy.
Public source images with unknown training-export membership are not a verified
validation split. Synthetic decoder tests prove only decoding behavior.
