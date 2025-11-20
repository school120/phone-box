import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/api/analyze-cabinet', async (req, res) => {
  try {
    const { imageData, prompt } = req.body;

    if (!imageData || !prompt) {
      return res.status(400).json({ error: 'Missing imageData or prompt' });
    }

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_image',
              image_url: {
                url: imageData,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_output_tokens: 300,
    });

    const text = (response.output_text || '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse model JSON');
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
    console.error('OpenAI vision error:', err);
    res.status(500).json({
      error: 'OpenAI vision call failed',
      details: err.message,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
