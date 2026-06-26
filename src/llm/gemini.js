const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');
const { setTimeout } = require('node:timers/promises');

// The SDK automatically picks up the GEMINI_API_KEY environment variable
const ai = new GoogleGenAI({});

function getPrompt(graph, set, evaluation) {
    const astCluster = {};
    const externalContext = {};
    let combinedSourceCode = "";

    // 1. Loop through every function in the current evaluation set
    for (const funcName of set) {
        const funcDetails = graph[funcName];

        // Bundle AST Data
        astCluster[funcName] = {
            returnType: funcDetails.returnType,
            parameters: funcDetails.parameters,
            calls: funcDetails.calls
        };

        // Stack the raw code physically on top of each other
        combinedSourceCode += `\n// --- ${funcName} ---\n${funcDetails.sourceCode}\n`;

        // Grab Context: Only inject context for functions that are NOT in this current set
        for (const call of funcDetails.calls) {
            const target = call.target;
            if (evaluation[target] && !set.has(target)) {
                externalContext[target] = evaluation[target];
            }
        }
    }

    // 2. Build the exact payload
    const promptPayload = `=== SYSTEM INSTRUCTIONS ===
You are a strict C code reviewer analyzing a cluster of functions. This cluster may be a single function or a mutually recursive state machine. 
Review them together. Focus strictly on extracting facts that a parent function would need to know to avoid crashing.

=== AST DATA CLUSTER ===
\`\`\`json
${JSON.stringify(astCluster, null, 4)} 
\`\`\`

=== EXTERNAL CONTEXT (Previously solved dependencies) ===
\`\`\`json
${JSON.stringify(externalContext, null, 4)}
\`\`\`

=== PROJECT RULES ===
\`\`\`json
[
    "design decision: to exit in case of faillure (early exit)",
    "C23",
    "you're seeing the already preprocessed code"
]
\`\`\`

=== RAW CODE CLUSTER ===
\`\`\`c
${combinedSourceCode}
\`\`\`

=== OUTPUT FORMAT ===
You must respond with ONLY valid JSON matching this schema. The keys of the root object MUST be the exact names of the functions provided in the RAW CODE CLUSTER:
\`\`\`json
{
    "[Insert Exact Function Name]": {
        "arguments_assumptions": [
            "string (State specific constraints, e.g., 'arg c must not be NULL')"
        ],
        "return_assumptions": [
            "string (State exact return behavior, e.g., 'returns parsed integer')"
        ],
        "architectural_warnings": [
            "string (List dangerous side-effects, state mutations, or missing base cases)"
        ],
        "open_questions": [
            "string (List ONLY missing local facts needed to verify safety)"
        ]
    }
}
\`\`\``;

    return promptPayload.trim();
}

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

async function callGemini(graph, set, evaluation) {
    const promptPayload = getPrompt(graph, set, evaluation);

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