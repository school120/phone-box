// server.mjs
import express from 'express';
import cors from 'cors';

const app = express();

// Ollama Cloud config via environment variables on your host
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3'; // pick a vision-capable cloud model
const OLLAMA_BASE_URL = 'https://ollama.com/api';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/api/analyze-cabinet', async (req, res) => {
  try {
    const { imageData, prompt } = req.body;

    if (!imageData || !prompt) {
      return res.status(400).json({ error: 'Missing imageData or prompt' });
    }
    if (!OLLAMA_API_KEY) {
      return res.status(500).json({ error: 'Missing OLLAMA_API_KEY on the server' });
    }

    // imageData is a data URL: data:image/jpeg;base64,xxxx...
    const base64 = imageData.split(',')[1];
    if (!base64) {
      return res.status(400).json({ error: 'Invalid image data URL' });
    }

    // Strict prompt to force JSON output
    const strictPrompt = `
You are analyzing a phone storage cabinet image.

${prompt}

IMPORTANT:
- Respond ONLY with a single JSON object.
- No Markdown, no explanation, no backticks.
- The JSON must have exactly these keys:
  {
    "emptySlots": [1, 5, 23],
    "totalSlotsVisible": 60,
    "confidence": "high"
  }
`;

    // Call Ollama Cloud /api/chat with a vision model and base64 image
    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Cloud auth: Bearer OLLAMA_API_KEY
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'user',
            content: strictPrompt,
            images: [base64], // base64-encoded image
          },
        ],
        stream: false,
      }),
    });

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text().catch(() => '');
      throw new Error(`Ollama Cloud error: HTTP ${ollamaResponse.status} ${errText}`);
    }

    const data = await ollamaResponse.json();

    // Try to extract text from common shapes
    let textResponse = '';
    if (data.message?.content) {
      textResponse = String(data.message.content).trim();
    } else if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
      textResponse = String(data.choices[0].message.content).trim();
    } else if (typeof data.response === 'string') {
      textResponse = data.response.trim();
    } else {
      textResponse = JSON.stringify(data);
    }

    // Parse JSON from the model
    let parsed;
    try {
      parsed = JSON.parse(textResponse);
    } catch {
      const match = textResponse.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse model JSON: ' + textResponse.slice(0, 200));
      }
    }

    const result = {
      emptySlots: Array.isArray(parsed.emptySlots) ? parsed.emptySlots : [],
      totalSlotsVisible:
        typeof parsed.totalSlotsVisible === 'number'
          ? parsed.totalSlotsVisible
          : 60,
      confidence:
        typeof parsed.confidence === 'string' ? parsed.confidence : 'unknown',
    };

    res.json(result);
  } catch (err) {
    console.error('Ollama Cloud vision error:', err);
    res.status(500).json({
      error: 'Vision analysis failed',
      details: err.message,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`phone-box backend (Ollama Cloud) listening on port ${PORT}`);
});
