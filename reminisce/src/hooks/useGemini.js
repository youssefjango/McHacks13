import { GoogleGenAI, Type } from '@google/genai';

export const useGemini = () => {

    // 1. GENERATE GREETING
    const getGreeting = async (name, context, lastMood, imageBase64) => {
        try {
            const cleanImage = imageBase64.split(',')[1];
            const apiKey = import.meta.env.VITE_GEMINI_KEY;
            const ai = new GoogleGenAI({ apiKey });

            const prompt = `
                You are a memory aid for a dementia patient. The patient is holding this device.
                You see ${name} in the camera.
                History: ${name} was feeling ${lastMood} last time.
                
                Task: Address the *patient* (the user).
                Tell them who is here (${name}) and offer a gentle reminder of who they are or how they felt last time.
                Do NOT say "Hello ${name}". Say "Look, it's ${name}..." or "Your friend ${name} is here...".
                Keep it warm and short (1 sentence).
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: cleanImage } }
                    ]
                }]
            });

            return response.text;
        } catch (e) {
            console.error("Greeting Error:", e);
            if (e.message?.includes('429') || e.status === 429) {
                console.warn("Quota exceeded. Using offline greeting.");
                return `Look, it's ${name}.`;
            }
            return `Look, it's ${name}`;
        }
    };

    // 2. PROCESS MEMORY
    const processMemory = async (name, textTranscript) => {
        console.log(`Processing memory for ${name}: "${textTranscript}"`);
        if (!textTranscript || textTranscript.trim().length === 0) {
            console.log("Transcript empty. Skipping.");
            return null;
        }

        try {
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    transcript: { type: Type.STRING },
                    emotion: { type: Type.STRING, enum: ["Happy", "Sad", "Angry", "Neutral", "Excited"] },
                    summary: { type: Type.STRING, description: "A concise 2-sentence summary of what they said" }
                },
                required: ["transcript", "emotion", "summary"]
            };

            const apiKey = import.meta.env.VITE_GEMINI_KEY;
            const ai = new GoogleGenAI({ apiKey });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{
                    parts: [
                        {
                            text: `
                              Analyze this conversation transcript.
                              Speaker: ${name}
                              Transcript: "${textTranscript}"
        
                              1. Use the provided transcript as the ground truth.
                              2. Detect the primary emotion.
                              3. Summarize what was said in 2 sentences.
                            ` }
                    ]
                }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            });

            const jsonText = response.text;
            const json = JSON.parse(jsonText);
            console.log("Memory Analysis:", json);
            return json;

        } catch (e) {
            console.error("Memory Processing Error:", e);
            return null;
        }
    };

    return { getGreeting, processMemory };
};
