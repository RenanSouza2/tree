const { getArgs, processArgs } = require('./src/getArgs.js');
const { processCode } = require('./src/getGraph.js');
const { processCallGraph } = require('./src/processCallGraph.js');

async function main() {
    const { filePath, flags } = getArgs();
    const sourceCode = processArgs(flags, filePath);
    const graph = processCode(sourceCode);
    const evaluation = await processCallGraph(graph);

    console.log()
    console.log()
    console.log()
    console.log('evaluation');
    console.log(`${JSON.stringify(evaluation, null, 4)}`);
}

main()
    .then(() => console.log(`Success`))
    .catch(error => {
        console.error("Fatal Error:", error);
        process.exit(1);
    });