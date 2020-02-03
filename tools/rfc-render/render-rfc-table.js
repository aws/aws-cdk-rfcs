const Octokit = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

const labels = {
  'status/ready': { },
  'status/proposed': { },
  'status/pending': { },
  'status/final-comment-period': { }, 
  'status/resolved': { },
};

exports.render = render;

async function render() {
  const lines = [];
  const files = await fs.readdir(path.join(__dirname, '..', '..', 'text'));

  const octo = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  const issues = [];

  for (const status of Object.keys(labels)) {

    const request = octo.issues.listForRepo.endpoint.merge({ 
      repo: 'aws-cdk-rfcs',
      owner: 'aws',
      state: 'all',
      labels: status
    });

    const result = await octo.paginate(request);

    for (const issue of result) {
      const { pr, champion } = findMetadata(issue);
      const doc = findDocFile(files, issue.number);
  
      issues.push({
        number: issue.number,
        title: issue.title,
        createdBy: issue.user && issue.user.login,
        champion,
        status: status.split('/')[1],
        pr,
        doc
      });
    }
  }

  lines.push('#|Title|PR|Created By|Champion|Status');
  lines.push('-|-----|--|----------|--------|------');

  for (const row of issues) {
    const title = !row.doc ? row.title : `[${row.title}](https://github.com/aws/aws-cdk-rfcs/blob/master/text/${row.doc})`;

    const cols = [
      `[${row.number}](https://github.com/aws/aws-cdk-rfcs/issues/${row.number})`,
      title,
      row.pr,
      renderUser(row.createdBy),
      renderUser(row.champion),
      row.status
    ];

    lines.push(cols.join('|'));
  }

  return lines;
}

function renderUser(user) {
  if (user.startsWith('@')) {
    user = user.substring(1);
  }

  user = user.trim();
  if (!user) {
    return '';
  }

  return `[@${user}](https://github.com/${user})`;
}

function findDocFile(files, number) {
  return files.find(file => parseInt(file.split('-')[0]) === number);
}

function findMetadata(issue) {
  const body = issue.body || '';
  const lines = body.split('\n');
  const titleIndex = lines.findIndex(line => line.startsWith('|PR|Champion|'));
  if (titleIndex === -1) { 
    return { pr: '', champion: '' }; 
  }

  let [ , pr, champion ] = lines[titleIndex + 2].split('|');
  pr = pr ? pr.trim() : '';
  champion = champion ? champion.trim() : '';

  if (pr === '#') { 
    pr = ''; 
  }
  
  if (pr.startsWith('#')) { 
    pr = `[${pr}](https://github.com/aws/aws-cdk-rfcs/pull/${pr.substring(1)})`; 
  }
 

  return { pr, champion };
}
