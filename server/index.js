import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '../.env' });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Vertex AI
const project = process.env.GCP_PROJECT_ID;
const credentials = {
  client_email: process.env.GCP_CLIENT_EMAIL,
  private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const locations = ['us-central1', 'us-east4', 'europe-west1'];

app.post('/api/vertex/generateContent', async (req, res) => {
  try {
    const { contents, config } = req.body;
    
    if (!contents) {
      return res.status(400).json({ error: 'Contents are required' });
    }

    // Attempt 1: Vertex AI (Try common locations with gemini-2.5-flash)
    for (const loc of locations) {
      try {
        console.log(`Attempting Vertex AI (${loc}) with gemini-2.5-flash...`);
        const vertexAI = new VertexAI({ project, location: loc, googleAuthOptions: { credentials } });
        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent({ contents, generationConfig: config });
        const response = await result.response;
        
        if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(`Vertex AI (${loc}) Success`);
          return res.json({ text: response.candidates[0].content.parts[0].text });
        }
      } catch (e) {
        console.warn(`Vertex AI (${loc}) failed:`, e.message);
      }
    }

    // Attempt 2: Google AI Studio Fallback (Direct v1 with gemini-2.5-flash)
    try {
      console.log('Attempting Google AI Studio Fallback with gemini-2.5-flash...');
      const apiKey = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contents, ...config })
      });
      const data = await response.json();

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log('Google AI Studio Fallback Success');
        return res.json({ text: data.candidates[0].content.parts[0].text });
      } else {
        console.warn('Google AI Studio returned error:', JSON.stringify(data));
      }
    } catch (e) {
      console.error('AI Studio fallback failed:', e.message);
    }

    throw new Error('All AI providers (Vertex & AI Studio) failed to respond with Gemini 2.5 Flash.');

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Final Proxy Error', message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Dynamic Proxy (Gemini 2.5 Flash) listening at http://localhost:${port}`);
});
