
import { GoogleGenAI, Type } from "@google/genai";
import { ScrapedSpeaker, ScrapeResult } from "../types";

// Initialize Gemini

const EXTRACT_SPEAKERS_PROMPT = `
You are a highly specialized data extraction agent. 
I will provide you with the text content of an event website or a page containing a list of people (Speakers, Participants, Advisors, Team Members).

Your absolute priority is to extract every person mentioned along with their JOB TITLE and COMPANY.

For each person, extract exactly:
- Full Name
- Job Title / Role (e.g., CEO, Founder, VP of Engineering, Research Lead)
- Company / Organization (e.g., Google, Microsoft, Startup XYZ)

Critical Guidelines:
1. Don't be lazy. If the company or role is not right next to the name, look for it in the surrounding text, bio snippets, or headings.
2. Often, companies are listed in a separate block or as logos - if you see a company listed nearby and it seems to belong to the person, use it.
3. If you can only find a name, still include it but use your best guess for the company based on general event themes if a specific one isn't there, or use "Company TBA" instead of just "Unknown".
4. If a person is listed multiple times, use the entry with the most information.
5. Ignore generic placeholders like "Speaker 1" or "To Be Announced".

Return a JSON object with a key "speakers" which is an array of objects.

HTML/Text Content:
{{html_content}}
`;

export async function fetchEventPage(url: string): Promise<string> {
    try {
        const apiKey = (import.meta as any).env?.VITE_TAVILY_KEY || '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';
        const response = await fetch("/api-tavily/extract", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                urls: [url],
                api_key: apiKey,
                include_images: false,
                extract_depth: "advanced"
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
        const truncatedHtml = html.length > 200000 ? html.substring(0, 200000) : html;

        const response = await fetch('/api-vertex/api/vertex/generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: EXTRACT_SPEAKERS_PROMPT.replace('{{html_content}}', truncatedHtml) }]
                }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            speakers: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        name: { type: "STRING" },
                                        company: { type: "STRING" },
                                        role: { type: "STRING" }
                                    },
                                    required: ["name", "company", "role"]
                                }
                            }
                        },
                        required: ["speakers"]
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Proxy error: ${response.statusText}`);
        }

        const data = await response.json();
        const result = JSON.parse(data.text || '{}');

        return result.speakers || [];

    } catch (error: any) {
        console.error("Vertex extraction failed:", error);
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
