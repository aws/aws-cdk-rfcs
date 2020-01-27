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
  const files = await fs.readdir(path.join('..', '..', 'text'));

  const octo = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  const issues = [];

  for (const status of Object.keys(labels)) {

    const result = await octo.issues.listForRepo({ 
      repo: 'aws-cdk-rfcs',
      owner: 'aws',
      state: 'all',
      labels: status
    });

    for (const issue of result.data) {
      const pr = findPullRequest(issue);
      const doc = findDocFile(files, issue.number);
  
      issues.push({
        number: issue.number,
        title: issue.title,
        login: issue.user && issue.user.login,
        status: status.split('/')[1],
        pr,
        doc
      });
    }
  }

  lines.push('#|Title|PR|Author|Status');
  lines.push('-|-----|--|------|------');

  for (const row of issues) {
    const title = !row.doc ? row.title : `[${row.title}](https://github.com/aws/aws-cdk-rfcs/blob/master/text/${row.doc})`;

    const cols = [
      `[${row.number}](https://github.com/aws/aws-cdk-rfcs/issues/${row.number})`,
      title,
      row.pr,
      `[${row.login}](https://github.com/${row.login})`,
      row.status
    ];

    lines.push(cols.join('|'));
  }

  return lines;
}

function findDocFile(files, number) {
  return files.find(file => parseInt(file.split('-')[0]) === number);
}

function findPullRequest(issue) {
  const body = issue.body || '';
  const lines = body.split('\n');
  const titleIndex = lines.findIndex(line => line.startsWith('|PR|Champion|'));
  if (titleIndex === -1) { return undefined; }

  const pr = lines[titleIndex + 2].split('|')[1].trim();

  if (pr === '#') { return undefined; }
  if (pr.startsWith('[')) { return pr; }
  return `[${pr}](https://github.com/aws/aws-cdk-rfcs/pull/${pr.substring(1)})`;
}
