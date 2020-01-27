const fs = require('fs').promises;
const path = require('path');
const { render } = require('./render-rfc-table');

async function main() {
  console.error(await fs.readdir('.'));

  const readmeFile = path.resolve(process.argv[2]);
  if (!readmeFile) {
    throw new Error(`usage: ${process.argv[1]} README.md > README.md`);
  }

  console.error(readmeFile);
  const text = (await fs.readFile(readmeFile, 'utf-8'));

  console.error(text);

  const lines = text.split('\n');

  console.error(lines);

  const begin = lines.indexOf('<!--BEGIN_TABLE-->');
  const end = lines.indexOf('<!--END_TABLE-->');

  if (begin === -1 || end === -1) {
    throw new Error('unable to find begin/end markers in readme');
  }

  const final = [ ...lines.slice(0, begin + 1), ...(await render()), ...lines.slice(end) ];
  console.log(final.join('\n'));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});