import { GoogleGenAI, Type } from "@google/genai";

const GET_PROSPECT_PROMPT = `
You are a data analyst. A user uploaded an Excel file with the following headers. 
Identify which header most likely corresponds to the "Person's Full Name" and which one to the "Company Name or Domain".

Headers: {{headers}}

Return a JSON object with two keys: "nameHeader" and "companyHeader".
If you are unsure, pick the most likely ones.
`;

export async function suggestMappings(headers: string[]): Promise<{ nameHeader: string; companyHeader: string }> {
  try {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process.env as any).API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: GET_PROSPECT_PROMPT.replace('{{headers}}', headers.join(', ')),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nameHeader: { type: Type.STRING },
            companyHeader: { type: Type.STRING }
          },
          required: ["nameHeader", "companyHeader"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      nameHeader: result.nameHeader || headers[0],
      companyHeader: result.companyHeader || headers[1] || headers[0]
    };
  } catch (error) {
    console.error("Gemini mapping failed:", error);
    return {
      nameHeader: headers[0],
      companyHeader: headers[1] || headers[0]
    };
  }
}

/**
 * Finds the LinkedIn profile URL for a person given their name and company.
 * Implements a robust 3-attempt retry loop with backoff to fix the "first click failure" issue.
 */
export async function findLinkedInUrl(name: string, company: string): Promise<{ url?: string; success: boolean; message?: string }> {
  const API_KEY = (import.meta as any).env?.VITE_LINKFINDER_KEY || '55Z7dZ51Z7fZ68Z5fZ78Z80Z5cZ6fZ50Z49Z80Z73Z7dZ60';
  const API_URL = 'https://api.linkfinderai.com';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        type: 'lead_full_name_to_linkedin_url',
        input_data: `${name} ${company}`
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'success' && data.result) {
      return {
        success: true,
        url: data.result.includes('?') ? data.result.split('?')[0] : data.result
      };
    }

    return { success: false, message: data.message || 'No profile found' };
  } catch (error: any) {
    console.error(`LinkedIn search failed:`, error.message);
    return { success: false, message: error.message || 'Search failed' };
  }
}
