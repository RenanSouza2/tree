const { getArgs, processArgs } = require('./src/getArgs.js');
const { processCode } = require('./src/getGraph.js');
const { processCallGraph } = require('./src/processCallGraph.js');

const { filePath, flags } = getArgs();
const sourceCode = processArgs(flags, filePath);
const graph = processCode(sourceCode);
processCallGraph(graph);
