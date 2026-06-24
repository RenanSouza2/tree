const { getPrompt } = require('./getPrompt.js');

function isFree(funcDetails, evaluation) {
    for(const call of funcDetails.calls) {
        if(evaluation[call.target] == null) {
            return false;
        }
    }
    return true;
}

function evaluateFn(funcName, funcDetails, evaluation) {
    // const prompt = getPrompt(funcDetails);
    console.log(`Evaluating ${funcName}...`);
    // TODO: CALL LLM
    return {};
}

function processCallGraph(graph) {
    const evaluation = {}

    let stateChanged = true
    while(stateChanged)
    {
        stateChanged = false;
        for (const [funcName, funcDetails] of Object.entries(graph)) {
            if(evaluation[funcName]) {
                continue;
            }

            if(!isFree(funcDetails, evaluation)) {
                continue;
            }

            stateChanged = true;
            evaluation[funcName] = evaluateFn(funcName, funcDetails, evaluation);
        }
    }

    console.log()
    console.log(`non evalauted functions`);
    for(const [funcName, funcDetails] of Object.entries(graph)) {
        if(!evaluation[funcName]) {
            console.log(funcName);
        }
    }
}

module.exports = { processCallGraph };