# ADR 0006 — Vì sao rule bị bỏ lỡ, và lớp chặn dựng lên sau đó

Ngày: 2026-09-16
Trạng thái: Accepted

## Bối cảnh

Sau phase 0→3, code lệch khỏi agentkit rules ở nhiều chỗ (lodash không dùng lần nào dù đã khai dep,
`{ err: error }` trái logging rule, local đặt tên theo bước, arrow body rút gọn). Câu hỏi đặt ra là
setup hỏng, rule chưa rõ, hay agent quên.

## Nguyên nhân gốc (kiểm chứng trực tiếp)

Path-scoped loading **hoạt động đúng**: đọc một file `.ts` bằng tool Read làm harness inject ngay 16
rule body vào context. Nhưng phase 0→3 ghi file bằng `cat > file <<'EOF'` qua shell — heredoc không
phải tool thao tác file nên trigger không bao giờ nổ. Đồng thời `00-index.md` (file có auto-load)
lại nói _"you do not need to open them preemptively"_, đúng với Read/Edit/Write và sai với heredoc.

Kết quả khớp hoàn hảo: 12 rule được chủ động đọc thì tuân thủ tốt; rule chưa bao giờ vào context thì
bị vi phạm có hệ thống. `agentkit check` luôn báo OK — setup chưa bao giờ hỏng.

Một nguyên nhân thứ hai: repo không có ESLint, `turbo run lint` không khớp script nào.

## Quyết định

1. **Mọi thay đổi file dùng Read/Edit/Write, không heredoc.** Đây là điều kiện để rule tới được model.
2. **Dựng ESLint đầy đủ** theo mẫu `d10works/io-layerwise`: `packages/eslint-config` với ba entry
   `base` / `node` / `react`, mỗi package một `eslint.config.js` mỏng, husky + lint-staged.
3. **Encode phần rule máy bắt được** vào `no-restricted-syntax` (logging `{ err }`, local đặt tên theo
   bước, optional-chain ladder, `…ById` / `…OrThrow` / `list*`), `arrow-body-style: always`,
   `no-restricted-imports` (alias + ranh giới Drizzle), và `eslint-plugin-lodash`.
   Phần máy **không** bắt được — comment convention, verb semantics, useCallback, form decomposition —
   vẫn dựa vào rule; không hứa quá.
4. **Hai chỗ linter bắt sai so với chữ của rule đã được nới đúng chỗ**: `result` trong test file được
   `testing.md` cho phép; `return x ?? null` trong repository được `drizzle/query-convention.md` ghi
   rõ là CORRECT.

## Kết quả

`pnpm lint` xanh toàn workspace sau khi dọn ~200 vi phạm. Kiểm chứng ngược: đổi một chỗ thành
`{ err: error }` thì lint fail ngay tại dòng đó.

Ba lỗi thật được phát hiện nhờ đợt audit, không phải lỗi style:

- `enableOfflineQueue` chưa tắt ở producer Redis → dispatch lúc Redis chết sẽ nằm trong RAM rồi mất
  theo tiến trình.
- `price` trùng `lookupKey`+`version` trả **500** thay vì 409 vì không map unique violation.
- `Payload({})` ở admin-ui gửi request **không có body** (hàm `isEmpty` tự viết coi object rỗng là
  empty), và `Headers()` ghi đè cả seed làm mất `content-type`.

## Ghi chú

agentkit 0.2.0 (phát hành trong lúc đợt dọn này đang chạy) bỏ `paths:` khỏi core rules, nên core
conventions giờ load mọi session không phụ thuộc việc chạm file. Profile rules vẫn path-scoped.
