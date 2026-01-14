
import { GoogleGenAI } from "@google/genai";
import { CONTACT_PHONE } from "./constants.tsx";

// Always use named parameter for apiKey and direct env access
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const systemInstruction = `
You are a friendly and efficient customer support agent for "Ray's Laundromat". 
Your tone is professional yet welcoming. 
Refer to the following pricing for all inquiries:
- Assorted Clothes/Bedding: Wash, dry & fold at Ksh 90/kg. Wash, dry, fold & iron at Ksh 140/kg. (Minimum 5kg).
- Duvets: Small (White: 600-700, Colors: 500-600), Medium (White: 700-800, Colors: 600-700), Large (White: 800-900, Colors: 700-800).
- Sleeping Bags: White (400-600), Colors (300-500).
- Suits: 2-piece (500), 3-piece (600).
- Gowns: Graduation (500), Wedding (2000).
- Trench coats, Hoodies, Jackets: 200.
- Leather Jackets: 300-700.
- Cassock: 200.
- Contact Number: ${CONTACT_PHONE}.

IMPORTANT: If a customer seems frustrated, or asks for something you can't handle, or explicitly asks for a human, say "I'll notify a team member to take over right away."
`;

export const getAIResponse = async (userMessage: string, history: any[]) => {
  try {
    // Correct way to call generateContent with model name and prompt
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    // Extract text output directly from the response object
    const text = response.text || "I'm sorry, I'm having trouble connecting right now. Please try again or call us.";
    const needsAdmin = text.toLowerCase().includes("team member") || 
                       userMessage.toLowerCase().includes("human") ||
                       userMessage.toLowerCase().includes("admin") ||
                       userMessage.toLowerCase().includes("manager");

    return { text, needsAdmin };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { text: "Our staff will be with you shortly. Please feel free to call us at " + CONTACT_PHONE, needsAdmin: true };
  }
};
