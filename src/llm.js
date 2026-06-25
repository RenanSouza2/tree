const { GoogleGenAI } = require('@google/genai');
const { setTimeout } = require('node:timers/promises');

// The SDK automatically picks up the GEMINI_API_KEY environment variable
const ai = new GoogleGenAI({});

async function tryCallGemini(promptPayload) {
    console.warn(`[~] Throttling engine (sleeping 4s)...`);
    await setTimeout(4000);
    console.warn(`[~] Dialing Gemini API...`);

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
}

async function callGemini(promptPayload) {
    console.warn(`-------------------`);
    console.warn(`New request`);
    const baseWaitTime = 2000;
    const maxRetries = 10;
    for(let attempt=0; attempt<maxRetries; attempt++) {
        try {
            console.warn(`attempt: ${attempt}`);
            return await tryCallGemini(promptPayload);
        } catch (error) {
            const errorMessage = error.message || "";
            const isHighDemand = errorMessage.includes('"code":503') || 
                                 errorMessage.includes('UNAVAILABLE') || 
                                 error.status === 503;

            // 2. If it is a 503 AND we have retries left, wait and try again
            if (isHighDemand) {
                // Exponential backoff: 2s, 4s, 8s, 16s... 
                // We also add "jitter" (up to 1 random second) to prevent all your 
                // parallel requests from retrying at the exact same millisecond.
                const waitTime = (baseWaitTime * Math.pow(2, attempt - 1)) + (Math.random() * 1000);
                
                console.warn(`[!] API High Demand (503). Retrying (${attempt + 1}/${maxRetries}) in ${Math.round(waitTime/1000)}s...`);
                await setTimeout(waitTime);
                continue; // Loop back and try the API call again
            }

            // 3. If it is NOT a 503 (e.g., invalid prompt, auth error), 
            // OR we ran out of retries, we throw the error so the script crashes gracefully.
            console.error(`[!] API Call Failed fatally after ${attempt} attempts:`, errorMessage);
            throw error;
        }
    }
}

module.exports = { callGemini };