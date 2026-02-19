
import { GoogleGenAI, Type } from "@google/genai";
import { ScrapedSpeaker, ScrapeResult } from "../types";

// Initialize Gemini (using the same key as geminiService.ts if available, or process.env)
// Note: In a real app, we should centralize the client creation. For now, we'll recreate it.
// We'll rely on the existing API_KEY context or env.
const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';

// Fallback to the one used in geminiService if specific env var is missing, 
// though strictly we should respect the project's env handling. 
// Assuming the user has set up the env vars correctly or we might need to hardcode specific key if they did in other files (which we saw `process.env.API_KEY` in geminiService, let's use that pattern but safer for Vite)

const GENAI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.API_KEY || 'AIzaSy...'; // We should probably look at how geminiService does it.

// checking geminiService.ts again... it uses `process.env.API_KEY`. 
// We will use the same pattern but safer.

const EXTRACT_SPEAKERS_PROMPT = `
You are an expert data extracting agent. 
I will provide you with the HTML text content of an event website.
Your goal is to extract a list of "Speakers" or "Attendees" or "Key People" from the page.
For each person, extract their Full Name and Company/Organization.
If the company is not explicitly listed next to the name, try to infer it from context if possible, or leave it empty.
Ignore generic names like "TBA" or "Speaker".

Return a JSON object with a key "speakers" which is an array of objects.
Each object should have:
- "name": string
- "company": string (or empty string if not found)
- "role": string (optional, job title if found)

HTML Content:
{{content}}
`;

const EXTRACT_FROM_TEXT_PROMPT = `
You are an expert data extracting agent. 
I will provide you with the text content of an event brochure or participant list extracted from a PDF.
Your goal is to extract a list of "Speakers", "Participants", "Delegates" or "Attendees" from the text.
For each person, extract their Full Name, Company/Organization, and Job Title/Role if available.

Return a JSON object with a key "speakers" which is an array of objects.
Each object should have:
- "name": string
- "company": string (or empty string if not found)
- "role": string (optional, job title if found)

Text Content:
{{content}}
`;

async function callGeminiExtraction(content: string, promptTemplate: string): Promise<ScrapedSpeaker[]> {
    try {
        const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process.env as any).API_KEY;

        if (!apiKey) {
            throw new Error("Gemini API Key is missing");
        }

        const ai = new GoogleGenAI({ apiKey });
        const truncatedContent = content.length > 200000 ? content.substring(0, 200000) : content;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash", // Using 2.0 flash as it is stable and fast
            contents: promptTemplate.replace('{{content}}', truncatedContent),
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        speakers: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    company: { type: Type.STRING },
                                    role: { type: Type.STRING }
                                },
                                required: ["name", "company"]
                            }
                        }
                    },
                    required: ["speakers"]
                }
            }
        });

        const resultText = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
        const result = JSON.parse(resultText || '{}');

        return result.speakers || [];
    } catch (error: any) {
        console.error("Gemini extraction failed:", error);
        return [];
    }
}

export async function extractSpeakersDetails(html: string): Promise<ScrapedSpeaker[]> {
    return callGeminiExtraction(html, EXTRACT_SPEAKERS_PROMPT);
}

export async function extractSpeakersFromText(text: string): Promise<ScrapedSpeaker[]> {
    return callGeminiExtraction(text, EXTRACT_FROM_TEXT_PROMPT);
}

export async function fetchEventPage(url: string): Promise<string> {
    try {
        const apiKey = (import.meta as any).env?.VITE_TAVILY_API_KEY || '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';
        const response = await fetch("https://api.tavily.com/extract", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                urls: [url],
                api_key: apiKey,
                include_images: false,
                extract_depth: "basic"
            })
        });

        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results[0].raw_content || data.results[0].content;
        } else {
            throw new Error("No content extracted from the page.");
        }

    } catch (error: any) {
        console.error("Scraping failed:", error);
        throw new Error(error.message || "Failed to fetch page");
    }
}

export async function scrapeEvent(url: string): Promise<ScrapeResult> {
    try {
        const html = await fetchEventPage(url);
        const speakers = await extractSpeakersDetails(html);

        return {
            success: true,
            speakers: speakers
        };
    } catch (error: any) {
        return {
            success: false,
            speakers: [],
            message: error.message
        };
    }
}
