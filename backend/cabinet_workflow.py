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
    empty_threshold: float = 150.0  # 0–255 brightness threshold


class CabinetAnalyzer:
    """
    Simple analyzer:
    - Converts image to grayscale
    - Resizes to fixed width
    - Splits into rows x cols grid
    - Computes average brightness per cell
    - If avg >= threshold → mark slot as EMPTY
    """

    def __init__(self, cfg: CabinetConfig | None = None):
        self.cfg = cfg or CabinetConfig()

    def analyze_image(self, image: Image.Image) -> Dict[str, Any]:
        # Normalize size & grayscale
        img = image.convert("L")
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
                x0 = int(c * cell_w)
                x1 = int((c + 1) * cell_w)
                y0 = int(r * cell_h)
                y1 = int((r + 1) * cell_h)

                cell = arr[y0:y1, x0:x1]
                avg = float(cell.mean())

                if avg >= self.cfg.empty_threshold:
                    empty_slots.append(slot_num)

                slot_num += 1

        return {
            "emptySlots": empty_slots,
            "confidence": "unknown",
        }
