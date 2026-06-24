const { execSync } = require('child_process');


function getArgs() {
    const filePath = process.argv[2];
    const flags = process.argv[3] || '';

    if (!filePath) {
        console.error('Usage: node index.js <file.c> "[flags]"');
        process.exit(1);
    }

    return { filePath, flags };
}

function processArgs(flags, filePath)
{
    console.log(`Preprocessing with flags: ${flags || 'none'}...`);
    try {
        const cmd = `gcc -E ${flags} ${filePath} | grep -v '^#'`;
        return execSync(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
    } catch (err) {
        console.error('\n--- PREPROCESSING FAILED ---');
        
        // If gcc threw an error (like a bad path or missing header)
        if (err.stderr) {
            console.error(err.stderr.toString());
        } else {
            // If it's a Node error (like execSync being undefined)
            console.error(err.message);
        }
        process.exit(1);
    }
}

module.exports = { getArgs, processArgs };