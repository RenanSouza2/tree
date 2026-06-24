const { getPrompt } = require('./getPrompt.js');

function getGroup(graph, funcName, evaluation, groupSize) {
    const group = new Set();
    const toAdd = new Set([funcName]);
    while(toAdd.size > 0) {
        if(group.size >= groupSize) {
            return new Set();
        }

        const funcToAdd = toAdd.values().next().value;
        toAdd.delete(funcToAdd);
        group.add(funcToAdd);

        const calls = graph[funcToAdd].calls.map((x) => x.target);
        for(const call of calls) {
            if(evaluation[call]) {
                continue;
            }

            if(group.has(call)) {
                continue;
            }

            toAdd.add(call);
        }
    }
    return group;
}

function evaluateGroup(group, evaluation) {
    // const prompt = getPrompt(funcDetails);
    console.log('--------------');
    for(const element of group) {
        console.log(`Evaluating ${element}`);
    }
    // TODO: CALL LLM
    return {};
}

function processCallGraph(graph) {
    const evaluation = {};

    let groupSize = 1;
    while(Object.keys(evaluation).length < Object.keys(graph).length)
    {
        let stateChanged = false;
        for (const [funcName, funcDetails] of Object.entries(graph)) {
            if(evaluation[funcName]) {
                continue;
            }

            const group = getGroup(graph, funcName, evaluation, groupSize);
            if(group.size == 0){
                continue;
            }

            stateChanged = true;
            const _evaluation = evaluateGroup(group, evaluation);
            for(const element of group) {
                evaluation[element] = _evaluation;
            }
            break;
        }

        if(stateChanged) {
            groupSize = 1;
        } else {   
            groupSize++;
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