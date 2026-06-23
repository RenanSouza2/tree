const Parser = require('tree-sitter');
const C = require('tree-sitter-c');

const parser = new Parser();
parser.setLanguage(C);
const sourceCode = `
void function_renan()
{
    printf("\noieeee);
}

int main() {
    printf("Hello, Tree-sitter!");
    return 0;
}
`;

// 2. Parse the code into a syntax tree
const tree = parser.parse(sourceCode);
