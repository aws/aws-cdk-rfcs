export const UNKNOWN_STATUS = 'status/unknown';

// Order does not matters here
// The cli input is an ordered list of status
export const STATUS_LIST = {
  [UNKNOWN_STATUS]: '❓unknown',
  'status/implementing': '👷 implementing',
  'status/planning': '📆 planning',
  'status/approved': '👍 approved',
  'status/final-comment-period': '⏰ final comments',
  'status/api-approved': '📐 API approved',
  'status/review': '✍️ review',
  'status/proposed': '💡 proposed',
  'status/done': '✅ done',
  'status/stale': '🤷 stale',
  'status/rejected': '👎 rejected',
}
