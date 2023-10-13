#!/bin/bash
# executes markdownlint on all RFCs
# --fix to fix errors
set -euo pipefail
scriptdir=$(cd $(dirname $0) && pwd)
linters=$PWD/tools/linters

(cd $linters && npm ci)
cliargs="--ignore node_modules --ignore tools ${@:1}"
$linters/node_modules/.bin/markdownlint . $cliargs
