// const { callGemini } = require('./llm/gemini.js');
const { callLocalLLM } = require('./llm/local.js');

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

    return callLocalLLM(graph, set, evaluation);
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

        return {nextSetSize: 1, set: set};
    }
    return {nextSetSize: setSize + 1, set: new Set()};
}

async function processCallGraph(graph) {
    const evaluation = {};

    let setSize = 1;
    while(Object.keys(evaluation).length < Object.keys(graph).length)
    {
        let set;
        ({nextSetSize: setSize, set} = getNextSet(graph, evaluation, setSize));
        if(set.size == 0) {
            continue;
        }

        const _evaluation = await evaluateSet(graph, set, evaluation);
        console.log(`evaluation: ${JSON.stringify(_evaluation, null, 4)}`);

        for(const element of set) {
            evaluation[element] = _evaluation;
        }
    }

    return evaluation;
}

module.exports = { processCallGraph };