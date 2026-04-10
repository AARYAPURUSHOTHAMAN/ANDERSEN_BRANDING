import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import { VertexAI } from '@google-cloud/vertexai';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Diagnostic Logging for Vertex Credentials (Masked)
const checkEnv = (name) => {
    const val = process.env[name];
    if (!val) {
        console.warn(`[DIAGNOSTIC] ${name} is MISSING in Environment`);
        return false;
    }
    console.log(`[DIAGNOSTIC] ${name} is set (Length: ${val.length}, Starts with: ${val.substring(0, 10)}...)`);
    return true;
};

app.post('*', async (req, res) => {
  try {
    console.log('--- Vertex AI Request (Gemini 2.5 Flash) ---');
    checkEnv('GCP_PROJECT_ID');
    checkEnv('GCP_CLIENT_EMAIL');
    checkEnv('GCP_PRIVATE_KEY');

    const { contents, config } = req.body;
    
    if (!contents) {
      return res.status(400).json({ error: 'Contents are required' });
    }

    const project = process.env.GCP_PROJECT_ID;
    const credentials = {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: process.env.GCP_PRIVATE_KEY?.replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
    };

    const locations = ['us-central1', 'us-east4', 'europe-west1'];

    // Attempt Vertex AI (Multiple Regions)
    for (const loc of locations) {
      try {
        console.log(`Attempting Vertex AI (${loc})...`);
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
        // Specifically log if it's an auth error
        if (e.message.toLowerCase().includes('auth') || e.message.toLowerCase().includes('credential')) {
            console.error(`AUTHENTICATION ERROR in ${loc}: This usually means GCP_PRIVATE_KEY or GCP_CLIENT_EMAIL is incorrect.`);
        }
      }
    }

    throw new Error('Vertex AI failed to respond in all attempted regions. Please verify your Service Account permissions and Environment Variables in Vercel.');

  } catch (error) {
    console.error('Final Proxy Error:', error);
    res.status(500).json({ 
      error: 'Vertex AI Error', 
      message: error.message 
    });
  }
});

export default app;
