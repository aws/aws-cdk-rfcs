#!/bin/bash
# executes markdownlint on all RFCs
# --fix to fix errors
set -euo pipefail
linters=$PWD/tools/linters

#npm install --prefix $linters
find . -type f -name '*.md' -not -path '*/node_modules/*' -not -path '*/.github/*' |\
  xargs -I'{}' $linters/node_modules/.bin/markdownlint -c $linters/markdownlint.json $@ '{}'
