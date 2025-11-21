# backend/server.py
import base64
import io
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from cabinet_workflow import CabinetAnalyzer, CabinetConfig

app = FastAPI(title="Phone Box Analyzer API")

# CORS – allow frontends to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can restrict to your GitHub Pages URL later
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = CabinetAnalyzer(CabinetConfig(rows=6, cols=10, empty_threshold=150.0))


class AnalyzeRequest(BaseModel):
    imageBase64: str  # base64 WITHOUT data URL prefix
    totalSlots: int   # kept for compatibility; not strictly needed


class AnalyzeResponse(BaseModel):
    emptySlots: List[int]
    confidence: str


def decode_base64_image(b64: str) -> Image.Image:
    try:
        raw = base64.b64decode(b64)
        return Image.open(io.BytesIO(raw))
    except Exception as e:
        raise ValueError(f"Invalid base64 image: {e}")


@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/api/analyze-cabinet", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    try:
        img = decode_base64_image(req.imageBase64)
        result = analyzer.analyze_image(img)
        empty_slots = result.get("emptySlots", [])
        confidence = result.get("confidence", "unknown")

        return AnalyzeResponse(
            emptySlots=empty_slots,
            confidence=confidence,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")
