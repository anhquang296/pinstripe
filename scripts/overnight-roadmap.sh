#!/usr/bin/env bash
#
# Chạy các phase của docs/ROADMAP-V2.md qua đêm, mỗi phase một branch + một PR (stacked).
#
#   ./scripts/overnight-roadmap.sh --smoke     kiểm tra flag/quyền/gh trong ~2 phút, không đụng roadmap
#   ./scripts/overnight-roadmap.sh             chạy thật
#   PHASES="14 15" ./scripts/overnight-roadmap.sh
#
# Nguyên tắc: script cầm danh sách phase, script chạy gate, script push và mở PR.
# Agent chỉ viết code và commit. Mọi lời tự khai của agent đều được kiểm chứng lại bằng git + gate.

set -Eeuo pipefail

# Script này sống trong chính repo mà nó checkout branch, nên nó phải tự dọn ra ngoài trước.
# bash đọc script lazily theo byte offset: một `git checkout` thay file này giữa chừng thì bash
# đọc tiếp ở offset cũ trong nội dung mới và thực thi một đoạn lệch hàng, báo lỗi ở chỗ vô can.
# Vì vậy: copy ra thư mục tạm, `exec` bản copy, và từ đó git muốn làm gì với repo cũng được.
if [[ "${OVERNIGHT_RELOCATED:-}" != "1" ]]; then
  OVERNIGHT_REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
  OVERNIGHT_RUNNER="$(mktemp "${TMPDIR:-/tmp}/overnight-roadmap.XXXXXX")"

  cp "${BASH_SOURCE[0]}" "$OVERNIGHT_RUNNER"
  export OVERNIGHT_RELOCATED=1 OVERNIGHT_REPO_ROOT OVERNIGHT_RUNNER

  exec bash "$OVERNIGHT_RUNNER" "$@"
fi

trap 'rm -f "$OVERNIGHT_RUNNER"' EXIT

REPO_ROOT="$OVERNIGHT_REPO_ROOT"
cd "$REPO_ROOT"

PHASES="${PHASES:-14 15 16 17 18 19 20}"
BASE_BRANCH="${BASE_BRANCH:-master}"
BRANCH_PREFIX="${BRANCH_PREFIX:-overnight/phase-}"
ROADMAP="docs/ROADMAP-V2.md"

DEADLINE_HOURS="${DEADLINE_HOURS:-8}"
# 0 = không đặt trần. Với token subscription thì `total_cost_usd` chỉ là ước lượng quy đổi,
# không phải tiền bị trừ — một cái trần ở đây chỉ cắt ngang agent giữa chừng chứ không tiết
# kiệm được gì. Thứ thật sự chặn là usage limit của gói và DEADLINE_HOURS bên dưới.
BUDGET_PER_ROUND="${BUDGET_PER_ROUND:-0}"
MAX_REPAIR="${MAX_REPAIR:-3}"
GATE_TIMEOUT="${GATE_TIMEOUT:-1800}"
MODEL="${MODEL:-opus}"
FALLBACK_MODEL="${FALLBACK_MODEL:-sonnet}"

RUN_DIR="$REPO_ROOT/.overnight/$(date +%Y%m%d-%H%M%S)"
DEADLINE=$(( $(date +%s) + DEADLINE_HOURS * 3600 ))

SMOKE=false
if [[ "${1:-}" == "--smoke" ]]; then
  SMOKE=true
fi

mkdir -p "$RUN_DIR"

# Token của `claude setup-token` sống ngoài repo, chmod 600, không bao giờ đi vào git.
# Xem phần "Chạy đêm" trong README của script này.
CREDENTIALS_FILE="${CREDENTIALS_FILE:-$HOME/.claude/overnight.env}"
if [[ -f "$CREDENTIALS_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CREDENTIALS_FILE"
fi

log() {
  printf '%s  %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$RUN_DIR/run.log"
}

die() {
  log "FATAL: $*"
  printf '%s\n' "$*" > "$RUN_DIR/STOP"
  exit 1
}

# ---------------------------------------------------------------- tiền kiểm tra

preflight() {
  log "preflight: bắt đầu"

  command -v pnpm >/dev/null || die "pnpm không có trong PATH"
  command -v gh   >/dev/null || die "gh không có trong PATH"
  command -v jq   >/dev/null || die "jq không có trong PATH"
  command -v claude >/dev/null || die "claude không có trong PATH"

  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short | tee -a "$RUN_DIR/run.log"
    die "working tree bẩn. Commit hoặc stash trước khi chạy — nếu không, việc dở của bạn sẽ bị nuốt vào commit của agent."
  fi

  local current
  current="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$current" == "$BASE_BRANCH" ]] || die "đang ở branch '$current', phải ở '$BASE_BRANCH'"

  gh auth status >/dev/null 2>&1 || die "gh chưa đăng nhập"

  # Cái này phải kiểm tra bằng một lần gọi thật. `claude -p` chạy trong subprocess có thể
  # không refresh được OAuth session, và khi đó nó trả is_error mà exit code vẫn 0 —
  # cả đêm sẽ chạy không, không commit nào, không PR nào.
  if [[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
    log "preflight: dùng CLAUDE_CODE_OAUTH_TOKEN (${#CLAUDE_CODE_OAUTH_TOKEN} ký tự, từ $CREDENTIALS_FILE)"
  else
    log "preflight: không có CLAUDE_CODE_OAUTH_TOKEN — dựa vào OAuth session của máy, thứ vốn hay hết hạn giữa đêm"
  fi

  log "preflight: thử xác thực claude -p"
  claude -p "Trả lời đúng hai chữ: auth ok" --output-format json >"$RUN_DIR/auth-probe.json" 2>&1 || true
  if ! jq -e '.is_error == false' "$RUN_DIR/auth-probe.json" >/dev/null 2>&1; then
    jq -r '.result // "(không đọc được output)"' "$RUN_DIR/auth-probe.json" 2>/dev/null | tee -a "$RUN_DIR/run.log" || true
    die "claude -p không xác thực được. Chạy 'claude setup-token' rồi cất token vào $CREDENTIALS_FILE dưới dạng: export CLAUDE_CODE_OAUTH_TOKEN=<token>"
  fi

  local permission
  permission="$(gh repo view --json viewerPermission --jq .viewerPermission 2>/dev/null || echo UNKNOWN)"
  log "preflight: quyền gh trên repo = $permission (đang đăng nhập: $(gh api user --jq .login 2>/dev/null || echo '?'))"
  case "$permission" in
    ADMIN|MAINTAIN|WRITE) ;;
    *) die "tài khoản gh không có quyền ghi (viewerPermission=$permission). Sáng mai sẽ không có PR nào." ;;
  esac

  log "preflight: bật docker (postgres + redis)"
  pnpm docker:up >>"$RUN_DIR/run.log" 2>&1 || die "pnpm docker:up thất bại"

  log "preflight: chạy gate trên $BASE_BRANCH sạch — nếu đỏ từ đây thì agent không bao giờ vượt qua"
  if ! gate "$RUN_DIR/preflight-gate.log"; then
    tail -40 "$RUN_DIR/preflight-gate.log" | tee -a "$RUN_DIR/run.log"
    die "gate đã đỏ trên $BASE_BRANCH trước khi agent chạm vào gì. Sửa trước đã."
  fi

  log "preflight: xanh"
}

# ------------------------------------------------------------------------ gate

# Gate có timeout. Một suite treo giữa đêm mà không ai cắt sẽ nuốt trọn thời gian còn lại,
# và sáng ra bạn có đúng con số không.
gate() {
  local out="$1"

  set -m
  (
    echo "### pnpm lint"
    pnpm lint                            || exit 1
    echo "### pnpm turbo run typecheck --force"
    pnpm turbo run typecheck --force     || exit 1
    echo "### pnpm turbo run test --force"
    pnpm turbo run test --force          || exit 1
    echo "### pnpm test:integration"
    pnpm test:integration                || exit 1
  ) >"$out" 2>&1 &
  local pid=$!
  set +m

  ( sleep "$GATE_TIMEOUT"
    kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    sleep 10
    kill -KILL -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
  ) >/dev/null 2>&1 &
  local watcher=$!
  disown "$watcher" 2>/dev/null || true

  local rc=0
  wait "$pid" || rc=$?
  kill "$watcher" 2>/dev/null || true

  if [[ $rc -ne 0 ]]; then
    echo "### gate thất bại (rc=$rc; nếu là 143/137 thì nó bị cắt vì quá ${GATE_TIMEOUT}s)" >>"$out"
    return 1
  fi
  return 0
}

# ----------------------------------------------------------------------- claude

# run_claude <prompt> <json_out>
#   0 = chạy xong bình thường
#   1 = hỏng thật, không cứu được
#   2 = rate limit, nên ngủ rồi thử lại
#   3 = hết đà (ngân sách / số lượt), việc dở vẫn còn — cho vòng tiếp đi tiếp
run_claude() {
  local prompt="$1" json_out="$2"
  local budget_args=()

  if [[ "$BUDGET_PER_ROUND" != "0" ]]; then
    budget_args=(--max-budget-usd "$BUDGET_PER_ROUND")
  fi

  set +e
  claude -p "$prompt" \
    --model "$MODEL" \
    --fallback-model "$FALLBACK_MODEL" \
    --permission-mode bypassPermissions \
    --disallowedTools "Bash(git push:*) Bash(gh:*) WebFetch WebSearch" \
    ${budget_args[@]+"${budget_args[@]}"} \
    --output-format json \
    >"$json_out" 2>>"$RUN_DIR/run.log"
  local code=$?
  set -e

  if ! jq -e . "$json_out" >/dev/null 2>&1; then
    log "  claude thoát mã $code và không trả JSON đọc được"
    return 1
  fi

  local subtype cost
  subtype="$(jq -r '.subtype // "?"' "$json_out")"
  cost="$(jq -r '.total_cost_usd // 0' "$json_out")"
  log "  claude xong: is_error=$(jq -r '.is_error // false' "$json_out") subtype=$subtype turns=$(jq -r '.num_turns // 0' "$json_out") cost=\$$cost"

  case "$subtype" in
    error_max_budget_usd | error_max_turns)
      log "  hết đà ($subtype) — việc dở còn trong working tree, sẽ cho đi tiếp"
      return 3
      ;;
  esac

  if jq -r '.result // ""' "$json_out" | grep -qiE 'usage limit|rate limit|too many requests'; then
    log "  phát hiện rate limit / usage limit"
    return 2
  fi

  if [[ $code -ne 0 ]]; then
    log "  claude thoát với mã $code"
    return 1
  fi

  return 0
}

phase_title() {
  local n="$1"
  sed -n "s/^## Phase ${n} — //p" "$ROADMAP" | head -1
}

build_prompt() {
  local n="$1" title="$2" branch="$3"
  cat <<PROMPT
Đọc mục "## Phase ${n} — ${title}" trong ${ROADMAP}.

Triển khai TRỌN VẸN phase đó: mọi bullet trong **Deliverables.**, thoả mọi điều kiện trong **Xong khi.**
Tuân thủ convention trong CLAUDE.md và .claude/rules/ (chúng đã nằm sẵn trong context của bạn).
Viết test cho code mới theo .claude/rules/agentkit/core/testing.md — integration test phải có hậu tố
.integration.test.ts, nếu không nó sẽ không bao giờ chạy.

Gate bắt buộc. Tự chạy, tự sửa, lặp cho tới khi cả bốn lệnh sạch:
  pnpm lint
  pnpm turbo run typecheck --force
  pnpm turbo run test --force
  pnpm test:integration

Khi sạch: commit lên branch hiện tại (${branch}). Nhiều commit nhỏ, mỗi commit một việc, tốt hơn
một commit to. Message commit đầu: 'phase ${n}: ${title}'.

TUYỆT ĐỐI KHÔNG:
- git push, gh, hay bất kỳ thao tác nào chạm remote
- git checkout / git switch sang branch khác, hay đụng vào ${BASE_BRANCH}
- git commit --no-verify (husky pre-commit là một phần của gate)
- sửa ${ROADMAP} — script lo việc đánh dấu trạng thái
- sửa .github/, turbo.json, hay scripts/overnight-roadmap.sh

Nếu sau 3 lần thử vẫn không làm gate sạch được: DỪNG, đừng commit code hỏng, in NEED_HUMAN kèm lý do
cụ thể (lệnh nào đỏ, lỗi gì).

Tự quyết định mọi thứ, không hỏi lại.
PROMPT
}

# Việc dở phải được cất vào branch ngay, không bao giờ để nằm trong working tree:
# một `git checkout` sau đó sẽ mang nó sang branch khác, và đó là cách mất việc.
# --no-verify ở đây là cố ý — code nửa chừng thường không qua lint, và gate vẫn
# chạy đầy đủ trước khi phase được coi là xong.
commit_wip() {
  local n="$1" round="$2"

  if [[ -z "$(git status --porcelain)" ]]; then
    return 0
  fi

  git add -A
  git commit -q --no-verify -m "wip: phase $n vòng $round, bị cắt giữa chừng"
  log "  đã cất việc dở vào $(git rev-parse --short HEAD)"
}

build_continue_prompt() {
  local n="$1" title="$2"
  cat <<PROMPT
Bạn đang làm dở "## Phase ${n} — ${title}" (xem ${ROADMAP}) và bị cắt giữa chừng vì hết đà.
Việc đã làm nằm trong các commit 'wip:' trên branch hiện tại — đọc \`git log\` và \`git show\` để
biết mình đang ở đâu, đừng làm lại từ đầu.

Làm nốt phần còn thiếu, rồi đưa gate về xanh:
  pnpm lint && pnpm turbo run typecheck --force && pnpm turbo run test --force && pnpm test:integration

Commit lên branch hiện tại. Không git push, không đổi branch, không --no-verify.
PROMPT
}

build_repair_prompt() {
  local n="$1" gate_log="$2"
  cat <<PROMPT
Gate đang ĐỎ trên branch hiện tại cho Phase ${n}. Đây là 200 dòng cuối của output:

$(tail -200 "$gate_log")

Sửa cho sạch, rồi commit. Bốn lệnh phải xanh hết:
  pnpm lint && pnpm turbo run typecheck --force && pnpm turbo run test --force && pnpm test:integration

Đừng nới lỏng test hay tắt rule để làm nó xanh. Đừng git push, đừng đổi branch, đừng --no-verify.
Không sửa được thì in NEED_HUMAN kèm lý do.
PROMPT
}

# ------------------------------------------------------------------ một phase

# run_phase <n> <base_branch> → 0 nếu xong và đã mở PR
run_phase() {
  local n="$1" base="$2"
  local branch="${BRANCH_PREFIX}${n}"
  local title
  title="$(phase_title "$n")"
  [[ -n "$title" ]] || die "không tìm thấy '## Phase $n —' trong $ROADMAP"

  log "=== Phase $n — $title  (base: $base) ==="

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    log "  branch $branch đã có — chạy tiếp trên đó thay vì bỏ qua"
    git checkout -q "$branch"
  else
    git checkout -q -b "$branch" "$base"
  fi

  local before
  before="$(git rev-parse "$base")"

  local round=0
  local gate_log="$RUN_DIR/phase-$n.gate.log"

  local ran_out=false

  # Branch đã có commit sẵn nghĩa là một lần chạy trước bỏ dở giữa chừng.
  # Đừng bảo agent làm lại từ đầu — chỉ ra chỗ nó đang đứng.
  if [[ "$(git rev-parse HEAD)" != "$before" ]]; then
    ran_out=true
    log "  đang chạy tiếp: branch có sẵn $(git rev-list --count "$base..$branch") commit"
  fi

  while :; do
    local prompt
    if [[ $round -eq 0 ]] && ! $ran_out; then
      prompt="$(build_prompt "$n" "$title" "$branch")"
    elif $ran_out; then
      prompt="$(build_continue_prompt "$n" "$title")"
    else
      prompt="$(build_repair_prompt "$n" "$gate_log")"
    fi

    log "  vòng $round: gọi claude"
    local rc=0
    run_claude "$prompt" "$RUN_DIR/phase-$n.round-$round.json" || rc=$?

    if [[ $rc -eq 2 ]]; then
      log "  rate limit — ngủ 30 phút rồi thử lại vòng này"
      sleep 1800
      continue
    fi

    # Kiểm chứng khách quan #1: agent còn đứng đúng chỗ không?
    local now_branch
    now_branch="$(git rev-parse --abbrev-ref HEAD)"
    if [[ "$now_branch" != "$branch" ]]; then
      git checkout -q "$branch"
      log "  CẢNH BÁO: agent đã rời sang '$now_branch', đã kéo về $branch"
    fi

    ran_out=false
    if [[ $rc -eq 3 ]]; then
      ran_out=true
      commit_wip "$n" "$round"
    fi

    # Kiểm chứng khách quan #2: có commit nào không?
    local after
    after="$(git rev-parse HEAD)"
    if [[ "$after" == "$before" ]]; then
      log "  không có commit nào sau vòng $round"
      if [[ $rc -eq 1 || $round -ge $MAX_REPAIR ]]; then
        return 1
      fi
      round=$(( round + 1 ))
      continue
    fi

    # Hết đà giữa chừng thì chưa cần chạy gate — cho nó làm tiếp đã.
    if $ran_out && [[ $round -lt $MAX_REPAIR ]]; then
      round=$(( round + 1 ))
      continue
    fi

    # Kiểm chứng khách quan #3: gate do script chạy, không phải agent
    log "  chạy gate"
    if gate "$gate_log"; then
      log "  gate XANH sau $(git rev-list --count "$base..$branch") commit"
      break
    fi

    log "  gate ĐỎ: $(grep -c . "$gate_log") dòng output, xem $gate_log"
    if [[ $round -ge $MAX_REPAIR ]]; then
      return 1
    fi
    round=$(( round + 1 ))
  done

  mark_roadmap "$n"
  if [[ -n "$(git status --porcelain)" ]]; then
    git add "$ROADMAP"
    git commit -q -m "docs: đánh dấu phase $n xong trong ROADMAP-V2"
  fi

  git push -q -u origin "$branch"

  local body
  body="$(cat <<BODY
Phase $n của \`$ROADMAP\`: **$title**

Sinh tự động bởi \`scripts/overnight-roadmap.sh\`, chạy lúc $(basename "$RUN_DIR").

Gate đã xanh trước khi PR được mở (script tự chạy, không phải agent tự khai):
\`pnpm lint\` · \`pnpm turbo run typecheck --force\` · \`pnpm turbo run test --force\` · \`pnpm test:integration\`

Base là \`$base\`, không phải \`$BASE_BRANCH\` — PR này stacked lên phase trước. Merge theo thứ tự phase.

Commit trong PR:

$(git log --format='- %s' "$base..$branch")
BODY
)"

  gh pr create \
    --base "$base" \
    --head "$branch" \
    --title "phase $n: $title" \
    --body "$body" >>"$RUN_DIR/run.log" 2>&1

  log "  PR: $(gh pr view "$branch" --json url --jq .url)"
  return 0
}

mark_roadmap() {
  local n="$1"
  python3 - "$n" "$ROADMAP" <<'PY'
import re, sys

phase, path = sys.argv[1], sys.argv[2]
lines = open(path, encoding='utf-8').read().split('\n')
pattern = re.compile(r'^\|\s*' + re.escape(phase) + r'\s*\|')

for index, line in enumerate(lines):
    if not pattern.match(line):
        continue
    cells = line.split('|')
    if len(cells) < 3:
        continue
    width = len(cells[-2])
    cells[-2] = ' Xong'.ljust(width)
    lines[index] = '|'.join(cells)
    break

open(path, 'w', encoding='utf-8').write('\n'.join(lines))
PY
}

# ------------------------------------------------------------------ smoke test

smoke() {
  log "SMOKE: chứng minh flag + quyền + gh chạy được, không đụng roadmap"

  local branch="overnight/smoke-$(date +%s)"
  git checkout -q -b "$branch" "$BASE_BRANCH"

  local prompt="Tạo file .overnight-smoke.md ở gốc repo với đúng một dòng: 'smoke ok'. Rồi commit nó với message 'chore: overnight smoke test'. Không làm gì khác. Không git push."

  local rc=0
  run_claude "$prompt" "$RUN_DIR/smoke.json" || rc=$?
  [[ $rc -eq 0 ]] || { git checkout -q "$BASE_BRANCH"; git branch -qD "$branch"; die "SMOKE: claude lỗi (rc=$rc) — xem $RUN_DIR/run.log"; }

  if [[ "$(git rev-parse HEAD)" == "$(git rev-parse "$BASE_BRANCH")" ]]; then
    git checkout -q "$BASE_BRANCH"; git branch -qD "$branch"
    die "SMOKE: agent không commit gì — quyền hoặc permission-mode sai"
  fi

  git push -q -u origin "$branch"
  gh pr create --base "$BASE_BRANCH" --head "$branch" --title "smoke test (xoá ngay)" --body "Kiểm tra đường ống overnight. Đóng và xoá tự động." >>"$RUN_DIR/run.log" 2>&1
  local url
  url="$(gh pr view "$branch" --json url --jq .url)"
  log "SMOKE: đã mở $url — đang dọn"

  gh pr close "$branch" --delete-branch >>"$RUN_DIR/run.log" 2>&1
  git checkout -q "$BASE_BRANCH"
  git branch -qD "$branch" 2>/dev/null || true

  log "SMOKE: XANH. Đường ống chạy được — giờ chạy thật được rồi."
}

# ---------------------------------------------------------------------- main

main() {
  log "run dir: $RUN_DIR"
  preflight

  if $SMOKE; then
    smoke
    exit 0
  fi

  local base="$BASE_BRANCH"
  local done_count=0

  for n in $PHASES; do
    if [[ $(date +%s) -ge $DEADLINE ]]; then
      log "hết hạn ${DEADLINE_HOURS}h — dừng trước phase $n"
      break
    fi

    if run_phase "$n" "$base"; then
      base="${BRANCH_PREFIX}${n}"
      done_count=$(( done_count + 1 ))
    else
      commit_wip "$n" "cuối"
      log "NEED_HUMAN ở phase $n — không mở PR, việc dở đã cất vào branch ${BRANCH_PREFIX}${n}"
      printf 'NEED_HUMAN phase %s\nbranch %s%s\nxem %s\n' \
        "$n" "$BRANCH_PREFIX" "$n" "$RUN_DIR/phase-$n.gate.log" > "$RUN_DIR/STOP"
      break
    fi
  done

  # Chỉ quay về base khi tree đã sạch. `git checkout` với tree bẩn sẽ mang nguyên
  # đống thay đổi sang branch kia, và khi đó việc của agent đứng trên master.
  if [[ -n "$(git status --porcelain)" ]]; then
    log "CẢNH BÁO: tree vẫn bẩn, ở lại $(git rev-parse --abbrev-ref HEAD) thay vì quay về $BASE_BRANCH"
  else
    git checkout -q "$BASE_BRANCH"
  fi

  log "xong: $done_count phase thành PR. gh pr list --state open"
}

main "$@"
