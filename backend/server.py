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

# Allow all origins (adjust later for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = CabinetAnalyzer(CabinetConfig(rows=6, cols=10))

class AnalyzeRequest(BaseModel):
    imageBase64: str
    totalSlots: int

class AnalyzeResponse(BaseModel):
    emptySlots: List[int]
    confidence: str

def decode_base64_image(b64: str) -> Image.Image:
    try:
        content = base64.b64decode(b64)
        return Image.open(io.BytesIO(content))
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

        return AnalyzeResponse(
            emptySlots=result["emptySlots"],
            confidence=result["confidence"]
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
