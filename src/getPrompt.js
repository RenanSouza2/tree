function getPrompt(funcDetails) {
    const astData = {
        returnType: funcDetails.returnType,
        parameters: funcDetails.parameters,
        calls: funcDetails.calls
    };

    const promptPayload = ` \
=== SYSTEM INSTRUCTIONS === \
You are a strict C code reviewer. Review this function for quality, readability, and hidden C-native bugs. Focus strictly on extracting facts that a parent function would need to know to avoid crashing.

=== AST DATA ===
\`\`\`json
${JSON.stringify(astData, null, 4)} 
\`\`\`
=== EXTRA CONTEXT ===
\`\`\`json
{}
\`\`\`

=== PROJECT RULES ===
\`\`\`json
[
    "design decision: to exit in case of faillure (early exit)",
    "C23",
    "you're seeing the already preprocessed code"
]
\`\`\`

=== RAW CODE ===
\`\`\`c
${funcDetails.sourceCode}
\`\`\` `
    return promptPayload;
}

module.exports = { getPrompt };