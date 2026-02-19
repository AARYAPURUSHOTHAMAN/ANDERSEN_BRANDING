
import { GoogleGenAI, Type } from "@google/genai";
import { ScrapedSpeaker, ScrapeResult } from "../types";

// Initialize Gemini

const EXTRACT_SPEAKERS_PROMPT = `
You are an expert data extracting agent. 
I will provide you with the text content of an event website or a page containing participant information.
Your goal is to extract a list of "Speakers", "Attendees", "Participants", or "Key People" from the page.

For each person, extract:
- Full Name
- Job Title / Role (e.g., CEO, Founder, Senior Engineer)
- Company / Organization

Guidelines:
1. If the company or role is not explicitly listed next to the name, try to infer it from context if possible, or use "Unknown".
2. Ignore generic names like "TBA", "Moderator", or "Speaker".
3. Ensure every entry has a name, role, and company.

Return a JSON object with a key "speakers" which is an array of objects.

HTML Content:
{{html_content}}
`;

export async function fetchEventPage(url: string): Promise<string> {
    try {
        const apiKey = (import.meta as any).env?.VITE_TAVILY_KEY || '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';
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

export async function extractSpeakersDetails(html: string): Promise<ScrapedSpeaker[]> {
    try {
        // We need an API key. We'll use the one from the environment.
        // In the existing geminiService.ts, it uses `process.env.API_KEY`.
        // We'll try to retrieve it similarly.
        // We'll try to retrieve it similarly.
        const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process.env as any).API_KEY;

        if (!apiKey) {
            throw new Error("Gemini API Key is missing");
        }

        const ai = new GoogleGenAI({ apiKey });

        // Truncate HTML if it's too massive to avoid token limits, though 1.5 Flash has a large context.
        // Let's safe-guard slightly, maybe 100k chars is enough for most bodies.
        const truncatedHtml = html.length > 200000 ? html.substring(0, 200000) : html;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: EXTRACT_SPEAKERS_PROMPT.replace('{{html_content}}', truncatedHtml),
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
                                required: ["name", "company", "role"]
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
