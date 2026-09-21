#!/usr/bin/env bash
#
# Chạy các phase của docs/ROADMAP-V3.md (25–32) qua đêm bằng overnight-roadmap.sh.
#
#   ./scripts/overnight-roadmap-v3.sh --smoke
#   ./scripts/overnight-roadmap-v3.sh
#   PHASES="29 30" BASE_BRANCH=overnight/v3-phase-28 ./scripts/overnight-roadmap-v3.sh
#
# Đêm thứ hai chạy tiếp từ phase chưa xong: đặt BASE_BRANCH là branch của phase cuối đã mở PR.
# Branch của phase dở dang đã có sẵn thì script chạy tiếp trên nó, không làm lại từ đầu.
#
# exec ngay, trước mọi git checkout: script chính tự copy mình ra thư mục tạm rồi mới đụng tới repo.

set -Eeuo pipefail

export ROADMAP="docs/ROADMAP-V3.md"
export PHASES="${PHASES:-25 26 27 28 29 30 31 32}"
export BRANCH_PREFIX="${BRANCH_PREFIX:-overnight/v3-phase-}"
export DEADLINE_HOURS="${DEADLINE_HOURS:-10}"
export EXTRA_GATE="${EXTRA_GATE:-pnpm --filter @vxrerp/erp-ui build && pnpm --filter @vxrerp/api openapi && git diff --exit-code -- apps/api/openapi.json}"

exec "$(dirname "${BASH_SOURCE[0]}")/overnight-roadmap.sh" "$@"
