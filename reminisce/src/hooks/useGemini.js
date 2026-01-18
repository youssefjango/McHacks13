import { GoogleGenAI, Type } from '@google/genai';

export const useGemini = (geminiKey) => {

    // 1. GENERATE GREETING
    const getGreeting = async (name, bio, history, lastMood, imageBase64) => {
        try {
            const cleanImage = imageBase64.split(',')[1];
            const ai = new GoogleGenAI({ apiKey: geminiKey });

            // specific formatting for history
            const historyText = history && history.length > 0
                ? history.map(h => `[${new Date(h.date).toLocaleDateString()} ${new Date(h.date).toLocaleTimeString()}]: ${h.summary} (Emotion: ${h.emotion})`).join('\n')
                : "No previous history.";

            const prompt = `
                You are a memory aid for a dementia patient. The patient is holding this device.
                You see ${name} in the camera.
                
                **Person Details:**
                - Name: ${name}
                - Relationship/Bio: ${bio || "Unknown"}
                
                **Recent Interaction History:**
                ${historyText}
                
                **Current Context:**
                - Last Obsvered Emotion: ${lastMood}
                
                **Task:**
                Address the *patient* (the user) directly.
                1. Tell them who is here ("Look, it's [Name]...").
                2. Remind them of their relationship (from Bio).
                3. Gently mention a topic from their last conversation if available, referencing *when* it happened (e.g. "Last time you saw them on [Date]...").
                
                **Constraints:**
                - Do NOT say "Hello ${name}".
                - Keep it warm, reassuring, and concise (max 2 sentences).
                - Use the visual input to comment on their current appearance if relevant (smiling, wearing a hat, etc).
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
                    summary: { type: Type.STRING, description: "A concise 2-3-sentence summary of what they said" },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "3-5 short tags/keywords relevant to this person based on the conversation (e.g. 'Fishing', 'Grandson', 'Doctor', 'Love')"
                    }
                },
                required: ["transcript", "emotion", "summary", "tags"]
            };

            const ai = new GoogleGenAI({ apiKey: geminiKey });

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
                              3. Summarize what was said in 2-3 sentences.
                              4. Generate 3-5 keywords/tags that categorize this person or this specific interaction (topics, relationship, mood).
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
