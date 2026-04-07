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
#   export GIT_REMOTE=origin            # 显式指定 push 的 remote（未设置时：有 origin 用 origin，否则若有 ediCPportal 则用 ediCPportal）
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
if [[ -z "${GIT_REMOTE:-}" ]]; then
  if git remote | grep -qx origin; then
    GIT_REMOTE=origin
  elif git remote | grep -qx ediCPportal; then
    GIT_REMOTE=ediCPportal
  else
    GIT_REMOTE=origin
  fi
fi

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
