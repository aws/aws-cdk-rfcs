const fs = require('fs').promises;
const path = require('path');
const { render } = require('./render-rfc-table');

async function main() {

  if (!process.argv[2]) {
    throw new Error(`Usage: ${process.argv[1]} README.md`);
  }
  
  const readmeFile = path.resolve(process.argv[2]);
  if (!readmeFile) {
    throw new Error(`usage: ${process.argv[1]} README.md`);
  }

  console.error(`reading ${readmeFile}`);
  const text = (await fs.readFile(readmeFile, 'utf-8'));
  const lines = text.split('\n');

  const begin = lines.indexOf('<!--BEGIN_TABLE-->');
  const end = lines.indexOf('<!--END_TABLE-->');

  if (begin === -1 || end === -1) {
    throw new Error('unable to find begin/end markers in readme');
  }

  const final = [ ...lines.slice(0, begin + 1), ...(await render()), ...lines.slice(end) ];

  console.error(`writing ${readmeFile}`);
  await fs.writeFile(readmeFile, final.join('\n'));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});