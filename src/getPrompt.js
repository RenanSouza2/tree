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

module.exports = { getPrompt };