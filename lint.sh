#!/bin/bash
# executes markdownlint on all RFCs
# --fix to fix errors
set -euo pipefail
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
linters=$SCRIPT_DIR/tools/linters

(cd $linters && npm ci)
cliargs="--ignore node_modules --ignore tools ${@:1}"
$linters/node_modules/.bin/markdownlint . $cliargs
