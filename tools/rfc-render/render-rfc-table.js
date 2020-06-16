const Octokit = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

const labels = {
  'status/implementing': { },
  'status/planning': { },
  'status/approved': { },
  'status/final-comment-period': { }, 
  'status/review': { },
  'status/proposed': { },
  'status/done': { },
  'status/rejected': { },
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
      const { champion, pr_number } = findMetadata(issue);
      const doc = findDocFile(files, issue.number);

      let link;

      // we we already have a doc, then the link should go to it
      if (doc) {
        link = `https://github.com/aws/aws-cdk-rfcs/blob/master/text/${doc}`;
      } else if (pr_number) {
        link = `https://github.com/aws/aws-cdk-rfcs/pull/${pr_number}`;
      } else {
        link = `https://github.com/aws/aws-cdk-rfcs/issues/${issue.number}`;
      }
  
      issues.push({
        number: issue.number,
        title: issue.title,
        link,
        assignee: issue.assignee && issue.assignee.login,
        champion,
        status: status.split('/')[1],
        doc
      });
    }
  }

  lines.push('\\#|Title|Owner|Status');
  lines.push('---|-----|-----|------');

  for (const row of issues) {
    const cols = [
      `[${row.number}](https://github.com/aws/aws-cdk-rfcs/issues/${row.number})`,
      `[${row.title}](${row.link})`,
      renderUser(row.assignee),
      row.status
    ];

    lines.push(cols.join('|'));
  }

  return lines;
}

function renderUser(user) {
  if (!user) {
    return '';
  }

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
    return { champion: '' }; 
  }

  let [ , pr, champion ] = lines[titleIndex + 2].split('|');
  champion = champion ? champion.trim() : '';

  const pr_number = (pr.startsWith('#') ? pr.substring(1) : '').trim();
  return { champion, pr_number };
}
