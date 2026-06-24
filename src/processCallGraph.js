const { json } = require("node:stream/consumers");

function processCallGraph(graph) {
    for (const [funcName, funcDetails] of Object.entries(graph)) {
        
        console.log(`\n=== ${funcName} ===`);
        console.log(`Return Type : ${funcDetails.returnType}`);
        console.log(`Parameters  : ${funcDetails.parameters.join(', ') || 'None'}`);
        console.log(`Calls Made  : ${funcDetails.calls.length}`);
        
        // If you want to see exactly what it called:
        if (funcDetails.calls.length > 0) {
            console.log(`  -> ${funcDetails.calls.map(c => c.target).join(', ')}`);
        }
    }
}

module.exports = { processCallGraph };