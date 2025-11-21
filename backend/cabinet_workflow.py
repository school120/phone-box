# backend/cabinet_workflow.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List

from PIL import Image
import numpy as np

@dataclass
class CabinetConfig:
    rows: int = 6
    cols: int = 10
    empty_threshold: float = 150.0   # brightness threshold


class CabinetAnalyzer:
    def __init__(self, cfg: CabinetConfig | None = None):
        self.cfg = cfg or CabinetConfig()

    def analyze_image(self, image: Image.Image) -> Dict[str, Any]:
        img = image.convert("L")    # grayscale
        target_width = 600
        scale = target_width / img.width
        img = img.resize((target_width, int(img.height * scale)))
        arr = np.array(img, dtype=np.float32)

        h, w = arr.shape
        cell_w = w / self.cfg.cols
        cell_h = h / self.cfg.rows

        empty_slots: List[int] = []
        slot_num = 1

        for r in range(self.cfg.rows):
            for c in range(self.cfg.cols):
                x0, x1 = int(c * cell_w), int((c + 1) * cell_w)
                y0, y1 = int(r * cell_h), int((r + 1) * cell_h)

                cell = arr[y0:y1, x0:x1]
                avg = cell.mean()

                if avg >= self.cfg.empty_threshold:
                    empty_slots.append(slot_num)

                slot_num += 1

        return {
            "emptySlots": empty_slots,
            "confidence": "unknown",
        }
