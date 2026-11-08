---
name: Model validation provenance
description: Distinguish ONNX metadata from verified training-label class indices.
---

Do not remap pothole output channels or diagnose low confidence from class names
alone. Check the exact training export's class configuration and numeric labels
against the exported model, then compare predictions with labeled boxes.

**Why:** The supplied model and training YAML agree on class names, but those
names include attribution text that does not describe the supplied validation
labels' visible objects. Metadata-to-YAML agreement alone cannot validate label
indices. A useful pothole prediction can still occur under a different index
from the validation annotation, so blindly switching output channels can discard
the useful signal rather than fix the dataset.
The referenced dataset version also specifies stretching, so standard YOLO
letterboxing must not automatically be assumed to fix preprocessing.

**How to apply:** Require the actual training configuration and validation
images/labels before changing class selection or claiming detector accuracy.
Inspect train/valid/test numeric labels separately when they disagree; validation
inconsistency alone does not prove that the training split has the same issue.
Public source images with unknown training-export membership are not a verified
validation split. Synthetic decoder tests prove only decoding behavior.

Inspect the checkpoint's saved `classes` filter, not just its class names.
With `single_cls=False`, that filter selects numeric IDs; it does not remap
other IDs into the selected class.

**Why:** A saved class filter excluded the IDs used by the supplied validation
potholes even though checkpoint and ONNX class names agreed. Later
pothole-containing training examples matched the filter, establishing a
cross-split mapping difference rather than proof of discarded training positives.
Matching export metadata alone did not establish consistent evaluation labels.

**How to apply:** Verify the semantic training IDs with actual pothole-containing
image/label pairs. Animal-only samples cannot establish the pothole ID. Recommend
retraining when positive supervision was discarded or inconsistent, but distinguish
that from a validation-only mapping error that first needs corrected evaluation.

**How to interpret this project's evidence:** The audited training target and
the selected ONNX output class agree. Correcting validation class IDs will fix
class-aware scoring, not low confidence or missed boxes. Do not recommend
mandatory retraining solely from this cross-split mismatch; first evaluate a
consistently labeled, representative validation set.
