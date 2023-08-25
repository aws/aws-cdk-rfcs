#!/bin/bash
set -euo pipefail
(cd tools/rfc-render && npm ci)
node tools/rfc-render/inject-table.js README.md
