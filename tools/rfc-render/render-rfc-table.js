const Octokit = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

const UNKNOWN_STATUS = 'status/unknown';

// order matters here and intentional: sorted chronological in reverse order -
// when it will be delivered. First the ones actually being worked on (coming
// soon), then the ones in planning (less soon), approved (sometimes), etc. The
// "done" items are last because they are less interesting in this list.

const display = {
  [UNKNOWN_STATUS]: '❓unknown',
  'status/implementing': '👷 implementing',
  'status/planning': '📆 planning',
  'status/approved': '👍 approved',
  'status/final-comment-period': '⏰ final comments',
  'status/api-approved': '📐 API approved',
  'status/review': '✍️ review',
  'status/proposed': '💡 proposed',
  'status/done': '✅ done',
  'status/stale': '🤷‍♂️ stale',
  'status/rejected': '👎 rejected',
}


const labels = Object.keys(display);

exports.render = render;

async function render() {
  const lines = [];
  const files = await fs.readdir(path.join(__dirname, '..', '..', 'text'));

  const octo = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  const issueByStatus = {};

  for (const status of labels) {
    issueByStatus[status] = [];
  }

  const request = octo.issues.listForRepo.endpoint.merge({
    repo: 'aws-cdk-rfcs',
    owner: 'aws',
    state: 'all',
  });

  const result = await octo.paginate(request);

  for (const issue of result) {
    // skip pull requests
    if (issue.pull_request) {
      continue;
    }

    const status = determineStatus(issue.labels);
    let warning = '';

    if (issue.state === 'closed') {

      // skip closed issues of unknown status
      if (status === UNKNOWN_STATUS) {
        continue;
      }

    }

    const { champion, pr_number } = findMetadata(issue);
    const doc = findDocFile(files, issue.number);

    let link;

    // we we already have a doc, then the link should go to it
    if (doc) {
      link = `https://github.com/aws/aws-cdk-rfcs/blob/main/text/${doc}`;
    } else if (pr_number) {
      link = `https://github.com/aws/aws-cdk-rfcs/pull/${pr_number}`;
    } else {
      link = `https://github.com/aws/aws-cdk-rfcs/issues/${issue.number}`;
    }

    issueByStatus[status].push({
      number: issue.number,
      title: issue.title,
      link,
      assignee: issue.assignee && issue.assignee.login,
      champion,
      status,
      doc,
      warning
    });
  }

  lines.push('\\#|Title|Owner|Status');
  lines.push('---|-----|-----|------');

  for (const issues of Object.values(issueByStatus)) {
    for (const row of issues.sort(byNumber)) {
      const cols = [
        `[${row.number}](https://github.com/aws/aws-cdk-rfcs/issues/${row.number})`,
        `[${row.title.trim()}](${row.link})`,
        renderUser(row.assignee),
        display[row.status],
      ];

      lines.push(cols.join('|'));
    }
  }

  return lines;
}

function byNumber(a, b) {
  return a.number - b.number;
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

  let [, pr, champion] = lines[titleIndex + 2].split('|');
  champion = champion ? champion.trim() : '';

  const pr_number = (pr.startsWith('#') ? pr.substring(1) : '').trim();
  return { champion, pr_number };
}

function determineStatus(item) {
  const result = [];
  for (const label of item) {
    if (labels.includes(label.name)) {
      result.push(label.name);
    }
  }

  if (result.length !== 1) {
    return UNKNOWN_STATUS;
  } else {
    return result[0];
  }
}
