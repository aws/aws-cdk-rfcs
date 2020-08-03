#!/bin/bash
set -euo pipefail
(cd tools/rfc-render && npm install)
node tools/rfc-render/inject-table.js README.md
