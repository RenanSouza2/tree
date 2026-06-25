const { GoogleGenAI } = require('@google/genai');

// The SDK automatically picks up the GEMINI_API_KEY environment variable
const ai = new GoogleGenAI({});

async function callGemini(promptPayload) {
    try {
        console.log(`[~] Dialing Gemini API...`);
        
        // We use flash for speed and cost efficiency in a massive pipeline. 
        // If the C code is incredibly complex, you can bump this to 'gemini-2.5-pro'.
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: promptPayload,
            config: {
                // This is the magic bullet. It forces pure JSON output.
                responseMimeType: "application/json",
                // Temperature 0.1 keeps it deterministic and strict. No creative writing.
                temperature: 0.1, 
            }
        });

        // The API returns the pure JSON string. We parse it into a JavaScript object.
        const parsedJson = JSON.parse(response.text);
        
        return parsedJson;

    } catch (error) {
        console.error(`[!] Gemini API Call Failed:`, error.message);
        // Returning null tells your orchestrator loop to skip and try again later,
        // or flag it as a failure without crashing the whole pipeline.
        return null; 
    }
}

module.exports = { callGemini };