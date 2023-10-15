#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { render } = require('./render-rfc-table');
const { parseArgs } = require('util');

async function main() {
  const { values: { status = undefined }, positionals: [readme = 'README.md'] } = parseArgs({
    options: {
      status: {
        type: 'string',
        short: 's',
        multiple: true,
      }
    },
    strict: true,
    allowPositionals: true,
  })

  const readmeFile = path.resolve(readme);
  const statusList = status?.map(s => s.startsWith('status/') ? s : `status/${s}`);

  console.info(`Injecting '${readmeFile}' with status: ${statusList ? statusList.join(', ') : '<all>'}`);
  const text = (await fs.readFile(readmeFile, 'utf-8'));
  const lines = text.split('\n');


  const begin = lines.indexOf('<!--BEGIN_TABLE-->');
  const end = lines.indexOf('<!--END_TABLE-->');

  if (begin === -1 || end === -1) {
    throw new Error(`unable to find begin/end markers in file ${readmeFile}`);
  }

  const final = [...lines.slice(0, begin + 1), ...(await render(statusList, Boolean(statusList))), ...lines.slice(end)];

  console.error(`Writing ${readmeFile}`);
  await fs.writeFile(readmeFile, final.join('\n'));
  console.error(`Done`);
}

main().catch(e => {
  console.error();
  console.error(e);
  console.error();
  console.error(`Usage:\n\t${path.relative(process.cwd(), process.argv[1])} README.md [--status <STATUS_1>] [--status <STATUS_2>] [...]`)
  process.exitCode = 1;
});