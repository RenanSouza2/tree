const Parser = require('tree-sitter');
const C = require('tree-sitter-c');
const { Query } = require('tree-sitter');
const { execSync } = require('child_process');

function processCode(sourceCode) {
    // 3. PARSE WITH TREE-SITTER
    const parser = new Parser();
    parser.setLanguage(C);
    const parseOptions = { bufferSize: Math.max(1024 * 1024, sourceCode.length * 4) };
    const tree = parser.parse(sourceCode, undefined, parseOptions);

    // 4. THE QUERIES
    // Query A: Find all function definitions
    const funcQuery = new Query(C, `(function_definition declarator: (function_declarator declarator: (identifier) @func_name))`);
    // Query B: Find all function calls
    const callQuery = new Query(C, `(call_expression function: (identifier) @called_func)`);

    const funcCaptures = funcQuery.captures(tree.rootNode);

    // 5. EXTRACT THE DATA
    const myValidFunctions = new Set();

    funcCaptures.forEach(capture => {
        const funcName = capture.node.text;
        if (!funcName.startsWith('_')) {
            myValidFunctions.add(funcName);
        }
    });

    const callGraph = {}; // Initialize the graph object

    funcCaptures.forEach(capture => {
        const nameNode = capture.node;
        const funcName = nameNode.text;

        if (!myValidFunctions.has(funcName)) return;

        let defNode = nameNode;
        while (defNode && defNode.type !== 'function_definition') {
            defNode = defNode.parent;
        }

        if (defNode) {
            // --- 1. EXTRACT RETURN TYPE & PARAMETERS ---
            const typeNode = defNode.childForFieldName('type');
            const returnType = typeNode ? typeNode.text : 'unknown';

            const paramNodes = defNode.descendantsOfType('parameter_declaration');
            const parameters = paramNodes.map(param => param.text);

            // --- 2. EXTRACT SPECIFIC CALL INVOCATIONS & ARGUMENTS ---
            const callCaptures = callQuery.captures(defNode);
            const detailedCalls = [];

            callCaptures.forEach(c => {
                const calledFuncName = c.node.text;

                // Apply FILTER 2: Skip system functions (printf, exit, __bswap, etc.)
                if (!myValidFunctions.has(calledFuncName)) return;

                // c.node is the function name. Its parent is the full call_expression.
                const callExpressionNode = c.node.parent;

                // Grab the 'argument_list' child node
                const argsNode = callExpressionNode.childForFieldName('arguments');

                // .namedChildren conveniently returns just the expressions passed, skipping '(' and ','
                const passedValues = argsNode ? argsNode.namedChildren.map(arg => arg.text) : [];

                detailedCalls.push({
                    target: calledFuncName,
                    passedValues: passedValues
                });
            });

            // --- 3. UPDATE THE JSON OBJECT ---
            callGraph[funcName] = {
                returnType: returnType,
                parameters: parameters,
                calls: detailedCalls, // We no longer use the deduplicated Set here
                sourceCode: defNode.text
            };
        } else {
            callGraph[funcName] = {
                returnType: "unknown",
                parameters: [],
                calls: [],
                sourceCode: nameNode.text
            };
        }
    });

    return callGraph
}

module.exports = { processCode };
