# ADR 0003 — Ledger double-entry (Phase 2)

Ngày: 2026-09-15
Trạng thái: Accepted

## Bối cảnh

RESEARCH.md §5 rút ra từ Uber/Airbnb/Modern Treasury: "build the ledger first". Phase 2 dựng sổ kép
**trước khi** có bất kỳ đồng tiền nào chạy qua hệ thống, để invoicing (phase 6) và payment (phase 7)
chỉ việc ghi bút toán chứ không phải chế ra mô hình tiền riêng.

## Quyết định

1. **Bất biến cưỡng chế ở tầng DB, không chỉ ở service.** Trigger `ledger_reject_mutation()` chặn
   UPDATE/DELETE trên `ledger_postings` và DELETE trên `ledger_transactions`. Một bug ở service, một
   migration ẩu hay một câu psql thủ công đều bị chặn — muốn xoá phải cố ý `DISABLE TRIGGER`, và đó
   là hành động không ai làm nhầm.
   Ngoại lệ duy nhất: `reversed_by_transaction_id` được set **đúng một lần**; trigger so sánh toàn bộ
   các cột còn lại và raise nếu có gì khác thay đổi.
2. **Số dư là view, không phải cột.** `ledger_account_balances` tính debits/credits/balance từ
   postings, có tính tới `normal_balance` của tài khoản. Không có cột balance nào để lệch với postings
   — thứ mà Modern Treasury gọi là "balance amnesia" đơn giản là không tồn tại được.
   Khi bảng postings lớn, chuyển view này thành materialized view + snapshot theo kỳ; consumer không
   phải đổi vì đã đọc qua view.
3. **Zero-sum kiểm tra hai lớp.** Service từ chối payload lệch (`debits ≠ credits`) trước khi ghi;
   job `LedgerIntegrityCheck` chạy mỗi 60s quét `having sum(±amount) <> 0` và log ở mức error.
   Lớp hai bắt được thứ lớp một không thấy: ghi thẳng vào DB, hoặc một transaction chết giữa chừng.
   Đã kiểm chứng bằng cách chèn tay một posting lẻ — alert nổ đúng transaction id.
4. **Sửa sai = bút toán đảo, hai chiều.** `reverseTransaction` tạo transaction mới với direction lật
   ngược, link `reverses_transaction_id` và `reversed_by_transaction_id`. Đảo lần hai bị từ chối
   (409) — ở cả service lẫn trigger.
5. **`externalId` là khoá chống ghi trùng.** Caller nội bộ (invoicing, payment) truyền
   `invoice:in_x:finalize`; unique index đảm bảo một nghiệp vụ chỉ sinh một bút toán dù job retry bao
   nhiêu lần. Trùng → `ConflictError`, không phải ghi đè.
6. **Tài khoản provision theo nhu cầu bằng `ensureAccount(code, currency, customerId?)`.**
   Chart of accounts là enum `LedgerAccountCodeEnum` + bảng định nghĩa (type, normalBalance,
   isPerCustomer); AR và Customer Credit Balance là per-customer, còn lại dùng chung. Tài khoản tách
   theo currency, không bao giờ trộn hai đồng tiền trong một tài khoản.
   Unique index phải chia làm hai (partial) vì Postgres coi hai NULL là khác nhau: một cho
   `customer_id is not null`, một cho `customer_id is null`.
7. **Ledger nằm trên surface admin (`/api/v1/admin/ledger/*`), không phải `/v1`.** Sổ kế toán không
   phải resource của Stripe API; nó là công cụ nội bộ. Submodule admin giờ cũng gắn idempotency hook.

## Hệ quả

- Từ phase 6 trở đi, mọi thay đổi tiền phải đi qua `ledgerService.postTransaction(...)` với
  `externalId` của nghiệp vụ sinh ra nó, trong cùng transaction DB với thay đổi nghiệp vụ.
- 1000 transaction ngẫu nhiên ghi trong ~1.4s và tổng postings vẫn bằng 0 — throughput không phải là
  vấn đề ở quy mô hiện tại; khi nào gặp hot-account contention thì mới tính tới TigerBeetle.
- Không có API nào sửa được một bút toán đã ghi. Kế toán muốn "sửa" thì đảo rồi ghi lại.
