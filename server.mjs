// server.mjs
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Your HuggingFace token (set this in Render)
const HF_TOKEN = process.env.HF_TOKEN;

// NEW router API endpoint (free tier)
const MODEL_URL = "https://router.huggingface.co/hf-inference/models/Qwen/Qwen2-VL-7B-Instruct";

app.post('/api/analyze-cabinet', async (req, res) => {
  try {
    const { imageData, prompt } = req.body;

    if (!HF_TOKEN) {
      return res.status(500).json({ error: 'Missing HF_TOKEN on the server' });
    }
    if (!imageData || !prompt) {
      return res.status(400).json({ error: 'Missing imageData or prompt' });
    }

    // Convert Data URL -> base64
    const base64 = imageData.split(',')[1];
    if (!base64) {
      return res.status(400).json({ error: 'Invalid image data URL' });
    }

    // Strict JSON formatting instruction
    const strictPrompt = `
${prompt}

IMPORTANT:
Respond ONLY with a single JSON object with:
{
  "emptySlots": [...],
  "totalSlotsVisible": 60,
  "confidence": "high"
}
No markdown. No backticks. No extra text. JSON ONLY.
`;

    // HF Router requires this payload for multimodal input
    const payload = {
      inputs: {
        text: strictPrompt,
        image: base64
      }
    };

    const response = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HF error ${response.status}: ${text}`);
    }

    const result = await response.json();

    // Qwen returns: [{generated_text: "..."}]
    let answer = "";
    if (Array.isArray(result) && result[0]?.generated_text) {
      answer = result[0].generated_text.trim();
    } else if (result.generated_text) {
      answer = result.generated_text.trim();
    } else {
      answer = JSON.stringify(result);
    }

    // Extract JSON
    let parsed;
    try {
      parsed = JSON.parse(answer);
    } catch (e) {
      const match = answer.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse JSON: " + answer.slice(0, 200));
    }

    res.json({
      emptySlots: parsed.emptySlots || [],
      totalSlotsVisible: parsed.totalSlotsVisible || 60,
      confidence: parsed.confidence || "unknown"
    });

  } catch (err) {
    console.error("HF Vision error:", err);
    res.status(500).json({ error: "Vision analysis failed", details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`phone-box backend (HF Router Vision) running on port ${PORT}`);
});
