#!/usr/bin/env bash
#
# Local (Mac) helper: push current Git branch, then SSH to CVM and run deploy-cvm.sh.
#
# Required:
#   export CVM_HOST=81.70.150.216
#
# Optional:
#   export SSH_USER=ubuntu
#   export SSH_KEY="$HOME/.ssh/id_edi_cvm"
#   export REPO_DIR_ON_SERVER=~/ediCPportal
#   export GIT_REMOTE=upstream          # remote to push to from this machine (default: upstream)
#
# Usage:
#   ./scripts/push-and-deploy-cvm.sh              # push & deploy current branch name
#   ./scripts/push-and-deploy-cvm.sh main         # explicit branch

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
CVM_HOST="${CVM_HOST:?Set CVM_HOST to your CVM public IP or DNS name}"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_edi_cvm}"
REPO_DIR_ON_SERVER="${REPO_DIR_ON_SERVER:-~/ediCPportal}"
GIT_REMOTE="${GIT_REMOTE:-upstream}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "ERROR: SSH key not found: $SSH_KEY" >&2
  exit 1
fi

echo "==> Pushing branch '$BRANCH' to $GIT_REMOTE"
git push "$GIT_REMOTE" "$BRANCH"

echo "==> Deploying on $SSH_USER@$CVM_HOST (repo: $REPO_DIR_ON_SERVER, branch: $BRANCH)"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
  "$SSH_USER@$CVM_HOST" \
  "bash -lc 'set -euo pipefail; cd $REPO_DIR_ON_SERVER && git fetch --all --prune && git checkout $BRANCH && bash scripts/deploy-cvm.sh $BRANCH'"

echo "==> Done."
