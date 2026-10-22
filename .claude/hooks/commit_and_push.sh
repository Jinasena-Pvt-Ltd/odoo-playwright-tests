#!/bin/bash
# .claude/hooks/commit_and_push.sh
# Fires on Stop — writes the changelog entry and pushes one commit per turn.

set -euo pipefail

# jq (installed with winget) is not always on the PATH that hooks inherit
JQ_DIR="$HOME/AppData/Local/Microsoft/WinGet/Packages/jqlang.jq_Microsoft.Winget.Source_8wekyb3d8bbwe"
if [[ -d "$JQ_DIR" ]]; then export PATH="$PATH:$JQ_DIR"; fi

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
CWD=$(echo "$INPUT"        | jq -r '.cwd // "."')

TEMP_DIR="/tmp/claude_hooks"
PROMPT_FILE="$TEMP_DIR/prompt_${SESSION_ID}.txt"
FILES_FILE="$TEMP_DIR/files_${SESSION_ID}.txt"
TIMESTAMP_FILE="$TEMP_DIR/timestamp_${SESSION_ID}.txt"

# Nothing to do if no files were changed this turn
if [[ ! -f "$FILES_FILE" ]] || [[ ! -s "$FILES_FILE" ]]; then
  exit 0
fi

PROMPT=$(cat "$PROMPT_FILE" 2>/dev/null || echo "(prompt not captured)")
TIMESTAMP=$(cat "$TIMESTAMP_FILE" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
FILES=$(cat "$FILES_FILE")

# Write changelog entry
LOG_DIR="$CWD/.claude_changelog"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/session_${SESSION_ID}.md"

cat >> "$LOG_FILE" <<MDEOF

---

## Change -- $TIMESTAMP

**Prompt:**
\`\`\`
$PROMPT
\`\`\`

**Files touched:**
$(echo "$FILES" | sed 's/^/- /')

MDEOF

# Git commit and push
cd "$CWD"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Not a git repo, skipping push." >&2
  exit 0
fi

# Only ever commit/push on the branch named in .claude/hooks/branch.txt (default: repair).
# On any other branch this hook does nothing.
BRANCH_FILE="$CWD/.claude/hooks/branch.txt"
if [[ -f "$BRANCH_FILE" ]]; then
  TARGET_BRANCH=$(tr -d '[:space:]' < "$BRANCH_FILE")
fi
TARGET_BRANCH="${TARGET_BRANCH:-repair}"
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]]; then
  echo "On branch '$CURRENT_BRANCH', auto-commit is limited to '$TARGET_BRANCH' - skipping." >&2
  exit 0
fi

# If any spec file changed, regenerate the master report before committing
if echo "$FILES" | grep -q "\.spec\.ts" && command -v node > /dev/null 2>&1 && [[ -f "$CWD/scripts/generate-report.js" ]]; then
  echo "Spec file changed — regenerating master report..." >&2
  node "$CWD/scripts/generate-report.js" || true
fi

git add -A

if git diff --cached --quiet; then
  exit 0
fi


# Commit message: first 80 chars of prompt + file count
SHORT_PROMPT=$(echo "$PROMPT" | head -c 80 | tr '\n' ' ')
FILE_COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
git commit -m "[claude] $SHORT_PROMPT | $FILE_COUNT file(s) changed"
git push origin "$TARGET_BRANCH"

exit 0
