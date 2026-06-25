const { getPrompt } = require('./getPrompt.js');
const { callGemini } = require('./llm.js');

function getSet(graph, funcName, evaluation, setSize) {
    const set = new Set();
    const toAdd = new Set([funcName]);
    while(toAdd.size > 0) {
        if(set.size >= setSize) {
            return new Set();
        }

        const funcToAdd = toAdd.values().next().value;
        toAdd.delete(funcToAdd);
        set.add(funcToAdd);

        const calls = graph[funcToAdd].calls.map((x) => x.target);
        for(const call of calls) {
            if(evaluation[call]) {
                continue;
            }

            if(set.has(call)) {
                continue;
            }

            toAdd.add(call);
        }
    }
    return set;
}

function evaluateSet(graph, set, evaluation) {
    console.log('--------------');
    for(const element of set) {
        console.log(`Evaluating ${element}`);
    }

    const prompt = getPrompt(graph, set, evaluation);
    console.log(`promptPayload: ${prompt}}`);
    // TODO: CALL LLM
    return {};
}

function getNextSet(graph, evaluation, setSize) {
    for (const [funcName, funcDetails] of Object.entries(graph)) {
        if(evaluation[funcName]) {
            continue;
        }

        const set = getSet(graph, funcName, evaluation, setSize);
        if(set.size == 0){
            continue;
        }

        return [1, set];
    }
    return [setSize + 1, new Set()];
}

function processCallGraph(graph) {
    const evaluation = {};

    let setSize = 1;
    while(Object.keys(evaluation).length < Object.keys(graph).length)
    {
        let set;
        [setSize, set] = getNextSet(graph, evaluation, setSize);
        if(set.size == 0) {
            continue;
        }

        const _evaluation = evaluateSet(graph, set, evaluation);
        for(const element of set) {
            evaluation[element] = _evaluation;
        }
    }

    console.log()
    console.log(`non evalauted functions`);
    for(const [funcName, funcDetails] of Object.entries(graph)) {
        if(!evaluation[funcName]) {
            console.log(funcName);
        }
    }

    return evaluation;
}

module.exports = { processCallGraph };