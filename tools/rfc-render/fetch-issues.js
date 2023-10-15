const { Octokit } = require('@octokit/rest');
const { STATUS_LIST, UNKNOWN_STATUS } = require('./status');
const fs = require('fs').promises;
const path = require('path');

exports.issuesGroupedByStatus = issuesGroupedByStatus;

const STATUS_LABELS = Object.keys(STATUS_LIST);

async function issuesGroupedByStatus(filterStatus = undefined) {
  const files = await fs.readdir(path.join(__dirname, '..', '..', 'text'));

  const octo = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  const issueByStatus = {};

  // repo:aws/aws-cdk-rfcs is:issue label:status/stale,status/done
  const labelQuery = filterStatus ? `label:${filterStatus.join(',')}` : '';
  const fullQuery = `repo:aws/aws-cdk-rfcs is:issue ${labelQuery}`;
  console.log(fullQuery);
  const request = octo.search.issuesAndPullRequests.endpoint.merge({
    q: fullQuery,
  });

  const result = await octo.paginate(request);

  for (const issue of result) {
    // skip pull requests
    if (issue.pull_request) {
      continue;
    }

    const status = determineStatus(issue.labels);
    // kip not requested status
    if (filterStatus && !filterStatus.includes(status)) {
      continue;
    }
    // skip closed issues of unknown status
    if (issue.state === 'closed' && status === UNKNOWN_STATUS) {
      continue;
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

    (issueByStatus[status] ??= []).push({
      number: issue.number,
      title: issue.title,
      link,
      assignee: issue.assignee && issue.assignee.login,
      champion,
      status,
      doc,
    });
  }

  return issueByStatus;
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
    if (STATUS_LABELS.includes(label.name)) {
      result.push(label.name);
    }
  }

  if (result.length !== 1) {
    return UNKNOWN_STATUS;
  } else {
    return result[0];
  }
}
