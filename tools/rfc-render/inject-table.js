const fs = require('fs').promises;
const path = require('path');
const { render } = require('./render-rfc-table');

async function main() {
  const readmeFile = path.join('..', '..', 'README.md');
  const lines = (await fs.readFile(readmeFile, 'utf-8')).split('\n');

  const begin = lines.indexOf('<!--BEGIN_TABLE-->');
  const end = lines.indexOf('<!--END_TABLE-->');

  if (begin === -1 || end === -1) {
    throw new Error('unable to find begin/end markers in readme');
  }

  const final = [ ...lines.slice(0, begin + 1), ...(await render()), ...lines.slice(end) ];
  console.log(final.join('\n'));
}

main().catch(e => {
  console.log(e);
  process.exit(1);
});