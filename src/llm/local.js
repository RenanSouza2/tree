const OpenAI = require('openai');
const { setTimeout } = require('node:timers/promises');

// Initialize the client pointing directly to your WSL background service
const ai = new OpenAI({
    baseURL: "http://localhost:11434/v1", 
    apiKey: "ollama" // Required by the SDK architecture, but ignored by Ollama
});

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

    // 2. Build the messages array payload for the OpenAI SDK
    const messagesPayload = [
        {
            role: "system",
            content: `You are a strict C code reviewer analyzing a cluster of functions. This cluster may be a single function or a mutually recursive state machine. 
Review them together. Focus strictly on extracting facts that a parent function would need to know to avoid crashing.

=== PROJECT RULES ===
\`\`\`json
[
    "IDIOM WHITELIST: Early termination via exit(), abort(), or panic macros on failure (especially memory allocation failure) is INTENTIONAL and SAFE. DO NOT flag this as a warning or red alert.",
    "ZERO TRUST RULE: DO NOT flag theoretical integer overflows, buffer overflows, or NULL dereferences UNLESS the code explicitly allows unvalidated input to reach the vulnerable operation. Assume the caller handled standard C idioms correctly.",
    "Target Standard: C23",
    "Code State: You are evaluating code that has already been preprocessed (macros are expanded)."
]
\`\`\`
=== CUSTOM TYPES ===
\`\`\`c
typedef uint64_t * uint64_p;

typedef uint64_t * chunk_p;

typedef struct _num_config num_config_t; typedef struct _num_config * num_config_p; struct _num_config
{
    uint64_t disk_threshold;
    const char* disk_path;
};

typedef struct _num num_t; typedef struct _num * num_p; struct _num
{
    uint64_t size;
    uint64_t count;
    bool cannot_expand;
    bool is_mmap;
    chunk_p chunk;
};

typedef struct _ssm_params ssm_params_t; typedef struct _ssm_params * ssm_params_p; struct _ssm_params
{
    uint64_t count;
    uint64_t M;
    uint64_t K;
    uint64_t Q;
    uint64_t n;
};

\`\`\`
=== OUTPUT FORMAT ===
You must respond with ONLY valid JSON matching this schema. The keys of the root object MUST be the exact names of the functions provided in the RAW CODE CLUSTER:
\`\`\`json
{
    "[Insert Exact Function Name]": {
        "summary": "string (1-2 sentences explaining the high-level intent of the function)",
        "red_alerts": [
            "string (CRITICAL ONLY: List guaranteed crashes, use-after-free, double-free, out-of-bounds writes, or division by zero. DO NOT include theoretical overflows or styling complaints here.)"
        ],
        "mutated_state": [
            "string (List any pointer arguments or global variables modified by this function)"
        ],
        "memory_ownership_transfer": [
            "string (State clearly if the function allocates memory the caller must free, or if it frees an argument)"
        ],
        "error_signaling": [
            "string (State if the function exits, returns NULL, or returns an error code on failure)"
        ],
        "arguments_assumptions": [
            "string (State specific constraints, e.g., 'arg c must not be NULL')"
        ],
        "return_assumptions": [
            "string (State exact return behavior, e.g., 'returns parsed integer')"
        ],
        "architectural_warnings": [
            "string (List dangerous edge-cases or missing base cases)"
        ],
        "open_questions": [
            "string (List ONLY missing local facts needed to verify safety)"
        ]
    }
}
\`\`\``
        },
        {
            role: "user",
            content: `=== AST DATA CLUSTER ===
\`\`\`json
${JSON.stringify(astCluster, null, 4)} 
\`\`\`

=== EXTERNAL CONTEXT (Previously solved dependencies) ===
\`\`\`json
${JSON.stringify(externalContext, null, 4)}
\`\`\`

=== RAW CODE CLUSTER ===
\`\`\`c
${combinedSourceCode.trim()}
\`\`\``
        }
    ];

    return messagesPayload;
}

async function tryCallLocalLLM(promptPayload) {
    console.warn(`[~] Dialing local Ollama API...`);

    const startTime = performance.now();
    const response = await ai.chat.completions.create({
        model: 'qwen2.5-coder:14b', // This must match the exact tag you downloaded
        messages: promptPayload,
        // The magic bullet for the OpenAI spec. It forces pure JSON output.
        response_format: { type: "json_object" }, 
        temperature: 0.1, 
    });
    
    const endTime = performance.now();
    const elapsedTime = endTime - startTime;
    console.warn(`[~] Elapsed time ${elapsedTime / 1000}s`);

    // The API returns the pure JSON string nested inside the choices array.
    const rawText = response.choices[0].message.content;
    const parsedJson = JSON.parse(rawText);
    
    return parsedJson;
}

async function callLocalLLM(graph, set, evaluation) {
    const promptPayload = getPrompt(graph, set, evaluation);

    console.warn(`-------------------`);
    console.warn(`New local request`);
    const baseWaitTime = 2000;
    const maxRetries = 10;
    
    for(let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.warn(`attempt: ${attempt}`);
            return await tryCallLocalLLM(promptPayload);
        } catch (error) {
            const errorMessage = error.message || "";
            
            // Check for local engine failures (e.g., service offline, GPU timeout)
            const isLocalEngineOverloaded = errorMessage.includes('ECONNREFUSED') || 
                                            errorMessage.includes('fetch failed') || 
                                            error.status === 503 ||
                                            error.status === 429;

            // If the engine crashed or is restarting, wait and try again
            if (isLocalEngineOverloaded) {
                const waitTime = (baseWaitTime * Math.pow(2, attempt - 1)) + (Math.random() * 1000);
                
                console.warn(`[!] Engine Unavailable. Retrying (${attempt + 1}/${maxRetries}) in ${Math.round(waitTime/1000)}s...`);
                await setTimeout(waitTime);
                continue; 
            }

            // Throw on syntax errors, malformed JSON, or hard failures
            console.error(`[!] API Call Failed fatally after ${attempt} attempts:`, errorMessage);
            throw error;
        }
    }
}

module.exports = { callLocalLLM };