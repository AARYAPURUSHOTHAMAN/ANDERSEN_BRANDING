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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
  const SERP_API_KEY = 'daf213863947b26837bcd3a5f0955e62cf5ddaa6257f37b437750fff4b7473bf';
  
  const queryStr = `site:linkedin.com/in "${name}" ${company}`;
  const encodedQuery = encodeURIComponent(queryStr);
  const targetUrl = `https://serpapi.com/search.json?engine=google&q=${encodedQuery}&api_key=${SERP_API_KEY}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Add unique timestamp and attempt ID to bypass any proxy/CDN caching
      const finalUrl = `${targetUrl}&_ts=${Date.now()}&_at=${attempt}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`;

      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Proxy error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.organic_results && Array.isArray(data.organic_results) && data.organic_results.length > 0) {
        for (const result of data.organic_results) {
          const link = result.link;
          if (link && (link.includes('linkedin.com/in/') || link.includes('linkedin.com/pub/'))) {
            return { success: true, url: link.split('?')[0] };
          }
        }
      }

      // If we reach here, search worked but no LinkedIn profile was in results
      return { success: false, message: 'No profile found' };
    } catch (error: any) {
      console.warn(`LinkedIn search attempt ${attempt} failed:`, error.message);
      if (attempt === 3) {
        return { success: false, message: error.message || 'Search failed after multiple attempts' };
      }
      // Wait before next attempt (exponential backoff: 800ms, 1600ms)
      await new Promise(resolve => setTimeout(resolve, 800 * attempt));
    }
  }

  return { success: false, message: 'Unexpected search failure' };
}