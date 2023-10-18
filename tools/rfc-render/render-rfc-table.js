const { issuesGroupedByStatus } = require('./fetch-issues');
const { STATUS_LIST } = require('./status');

const labels = Object.keys(STATUS_LIST);
exports.render = render;

async function render(renderStatus = undefined, groupByStatus = true) {
  const issuesByStatus = await issuesGroupedByStatus(renderStatus);

  const lines = [];

  lines.push('\\#|Title|Owner|Status');
  lines.push('---|-----|-----|------');

  if (groupByStatus) {
    for (const statusGroup of Object.values(issuesByStatus)) {
      for (const row of statusGroup.sort(byNumber)) {
        lines.push(renderRow(row));
      }
    }
  } else {
    for (const row of Object.values(issuesByStatus).flat().sort(byNumber)) {
      lines.push(renderRow(row));
    }
  }

  return lines;
}

function renderRow(row) {
  return [
    `[${row.number}](https://github.com/aws/aws-cdk-rfcs/issues/${row.number})`,
    `[${row.title.trim()}](${row.link})`,
    renderUser(row.assignee),
    STATUS_LIST[row.status],
  ].join('|');
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
