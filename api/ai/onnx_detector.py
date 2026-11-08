"""Validated, CPU-only YOLO detector; weights are cached locally, durable in App Storage."""
import ast
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import tempfile

import cv2
import numpy as np

MODEL_PATH = Path(__file__).resolve().parents[1] / "models/pothole.onnx"
MANIFEST_PATH = MODEL_PATH.with_suffix(".json")


def ensure_model():
    if MODEL_PATH.exists():
        return MODEL_PATH
    # The binary is intentionally not in Git. Restore only the pinned model,
    # using the same private App Storage credentials as the evidence service.
    manifest = json.loads(MANIFEST_PATH.read_text())
    from ..storage import client
    bucket, prefix = os.environ["PRIVATE_OBJECT_DIR"].strip("/").split("/", 1)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=MODEL_PATH.parent, suffix=".download")
    os.close(fd)
    temporary = Path(name)
    try:
        client().bucket(bucket).blob(f"{prefix}/{manifest['storage_key']}").download_to_filename(str(temporary), timeout=60)
        if temporary.stat().st_size != manifest["size_bytes"] or hashlib.sha256(temporary.read_bytes()).hexdigest() != manifest["sha256"]:
            raise ValueError("Stored ONNX weights failed integrity validation.")
        temporary.replace(MODEL_PATH)
    finally:
        temporary.unlink(missing_ok=True)
    return MODEL_PATH


@lru_cache(maxsize=1)
def load_session():
    import onnxruntime as ort
    path = ensure_model()
    manifest = json.loads(MANIFEST_PATH.read_text())
    if hashlib.sha256(path.read_bytes()).hexdigest() != manifest["sha256"]:
        raise ValueError("Local ONNX weights do not match the pinned model.")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    session = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
    inputs, outputs = session.get_inputs(), session.get_outputs()
    if len(inputs) != 1 or inputs[0].shape != [1, 3, 640, 640] or inputs[0].type != "tensor(float)":
        raise ValueError("Unsupported ONNX input; expected float32 [1,3,640,640].")
    if len(outputs) != 1 or outputs[0].shape != [1, 9, 8400]:
        raise ValueError("Unsupported ONNX output; expected YOLO detection [1,9,8400].")
    metadata = session.get_modelmeta().custom_metadata_map
    names = ast.literal_eval(metadata.get("names", "{}"))
    class_id = manifest["pothole_class_id"]
    if metadata.get("task") != "detect" or str(names.get(class_id, "")).strip().lower() != "pothole":
        raise ValueError("ONNX metadata does not identify the configured pothole class.")
    return session, class_id


def decode_detections(output, class_id, threshold):
    if output.shape != (1, 9, 8400) or not np.isfinite(output).all():
        raise ValueError("ONNX inference returned invalid detections.")
    rows = output[0].T
    # Four other channels are attribution-like labels, not road hazards.
    rows = rows[(rows[:, 4 + class_id] >= threshold) & (rows[:, 4:].argmax(axis=1) == class_id)]
    boxes, scores = [], []
    for row in rows:
        x, y, width, height = [float(v) for v in row[:4]]
        if width <= 0 or height <= 0:
            continue
        x1, y1 = max(0., x - width / 2), max(0., y - height / 2)
        x2, y2 = min(640., x + width / 2), min(640., y + height / 2)
        if x2 <= x1 or y2 <= y1:
            continue
        boxes.append([x1, y1, x2 - x1, y2 - y1])
        scores.append(float(row[4 + class_id]))
    if not boxes:
        return []
    indices = np.asarray(cv2.dnn.NMSBoxes(boxes, scores, threshold, 0.45)).reshape(-1)
    return [{"bbox": [boxes[i][0]/640, boxes[i][1]/640, (boxes[i][0]+boxes[i][2])/640, (boxes[i][1]+boxes[i][3])/640],
             "confidence": scores[i]} for i in indices]


def detect_potholes(rgb, threshold):
    session, class_id = load_session()
    image = cv2.resize(rgb, (640, 640)).astype(np.float32) / 255
    tensor = np.ascontiguousarray(image.transpose(2, 0, 1)[None])
    output = session.run(None, {session.get_inputs()[0].name: tensor})[0]
    return decode_detections(output, class_id, threshold)
