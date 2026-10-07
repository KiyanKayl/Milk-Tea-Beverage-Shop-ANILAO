// Produce the requested self-contained handout from the actual project files.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', '.qa', 'node_modules', 'tmp', 'test-results']);
function files(directory, prefix = '') {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (ignored.has(entry.name) || entry.name === 'SOURCE_GUIDE.md' || entry.name.includes('.sqlite')) return [];
        const relative = prefix + entry.name;
        return entry.isDirectory() ? files(resolve(directory, entry.name), relative + '/') : [relative];
    });
}
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const tree = readme.match(/```text\n([\s\S]*?)```/)[1].trimEnd();
let guide = '# Complete Milk Tea & Beverage POS Project\n\n';
guide += '## 1. Recommended folder structure\n\n```text\n' + tree + '\n```\n\n';
guide += '## 2. SQLite database schema\n\nThe database is created automatically. Currency values are integer centavos; timestamps use Asia/Manila.\n\n```sql\n' + readFileSync(resolve(root, 'database/schema.sql'), 'utf8') + '```\n\n';
guide += '## 3. Code for every file\n\nCopy each file to the path shown. Run instructions are included in README.md below. The generated binary database and this assembled guide are the only non-source artifacts excluded.\n\n';
const languages = { '.php': 'php', '.sql': 'sql', '.css': 'css', '.js': 'javascript', '.mjs': 'javascript', '.svg': 'xml', '.ps1': 'powershell', '.md': 'markdown' };
const allFiles = files(root).sort();
for (const relative of allFiles) {
    const contents = readFileSync(resolve(root, relative), 'utf8');
    const longestFence = Math.max(2, ...(contents.match(/`+/g) || []).map(run => run.length));
    const fence = '`'.repeat(longestFence + 1);
    guide += `### ${relative}\n\n${fence}${languages[extname(relative)] || 'text'}\n${contents}${contents.endsWith('\n') ? '' : '\n'}${fence}\n\n`;
}
writeFileSync(resolve(root, 'SOURCE_GUIDE.md'), guide, 'utf8');
console.log(`SOURCE_GUIDE.md contains the schema and complete code for ${allFiles.length} source files.`);
