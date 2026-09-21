# Flow 10 — Sổ cái kép

Nguồn sự thật về tiền. Mọi con số tài chính trong báo cáo đều dựng từ đây, không phải từ bảng `invoices` hay `payment_intents`. Nguyên tắc duy nhất: **một giao dịch, tổng Nợ = tổng Có, và không bao giờ sửa.**

## Khi nào chạy

Không có route `/v1` nào ghi sổ trực tiếp. Bút toán luôn được sinh **bên trong transaction của một nghiệp vụ khác**:

| Nghiệp vụ           | Nợ                                                   | Có                            | Ở đâu                                                                                                      |
| ------------------- | ---------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Phát hành hoá đơn   | `accounts_receivable` (khách)                        | `revenue`                     | [invoice.service.ts:336-362](../../packages/modules/billing/src/services/invoice.service.ts)               |
| Thu tiền            | `cash`                                               | `accounts_receivable` (khách) | [invoice.service.ts:364-391](../../packages/modules/billing/src/services/invoice.service.ts)               |
| Huỷ hoá đơn `open`  | `revenue`                                            | `accounts_receivable` (khách) | [invoice.service.ts:393-419](../../packages/modules/billing/src/services/invoice.service.ts)               |
| Credit note         | `revenue`                                            | `accounts_receivable` (khách) | [credit-note.service.ts:147-169](../../packages/modules/billing/src/services/credit-note.service.ts)       |
| Refund              | `revenue`                                            | `cash`                        | [refund.service.ts:122-143](../../packages/modules/billing/src/services/refund.service.ts)                 |
| Cấn trừ vé / trừ ví | `ticket_offset_clearing` / `partner_wallet_clearing` | `accounts_receivable` (khách) | [partner-collection.service.ts](../../packages/modules/billing/src/services/partner-collection.service.ts) |

Ngoài ra admin ghi tay được qua `POST /api/v1/admin/ledger/transactions` và đảo qua `.../transactions/:id/reverse`.

## Hệ thống tài khoản

[ledger.types.ts:38-74](../../packages/modules/billing/src/contracts/ledger.types.ts):

| Mã                        | Loại      | Số dư thường | Theo từng khách |
| ------------------------- | --------- | ------------ | --------------- |
| `accounts_receivable`     | asset     | debit        | ✅              |
| `cash`                    | asset     | debit        |                 |
| `revenue`                 | revenue   | credit       |                 |
| `deferred_revenue`        | liability | credit       |                 |
| `tax_payable`             | liability | credit       |                 |
| `customer_credit_balance` | liability | credit       | ✅              |
| `rounding_difference`     | expense   | debit        |                 |
| `psp_receivable`          | asset     | debit        |                 |
| `psp_fees`                | expense   | debit        |                 |
| `disputes_held`           | asset     | debit        |                 |
| `payouts_clearing`        | asset     | debit        |                 |
| `ticket_offset_clearing`  | asset     | debit        |                 |
| `partner_wallet_clearing` | asset     | debit        |                 |

`tax_payable` có bút toán từ phase 15: finalize ghi **Có** phần `totalTaxAmount`, void đảo lại — [ADR 0016](../adr/0016-tax-model.md). `customer_credit_balance` dùng từ phase 13. Bốn mã cuối là của phase 19 và mô tả phía quỹ: tiền PSP đang giữ, phí PSP đã trừ, tiền bị giữ vì dispute, tiền đang trên đường về ngân hàng — [ADR 0020](../adr/0020-money-flow.md). Còn `deferred_revenue` và `rounding_difference` đã khai báo nhưng **chưa có bút toán nào dùng** — chỗ dành sẵn cho ghi nhận doanh thu theo kỳ.

Từ phase 19, `cash` chỉ đổi khi một payout về tới ngân hàng hoặc khi có khoản thu / trả ngoài luồng; một lần khách trả tiền đi vào `psp_receivable`.

Tài khoản được tạo lười bằng `ensureAccount` — [ledger.service.ts:34-78](../../packages/modules/billing/src/services/ledger.service.ts): kiểm tra `isPerCustomer` khớp với việc có `customerId` hay không, tìm trước, chưa có thì INSERT, đụng unique violation thì đọc lại (an toàn khi chạy song song).

Unique index tách hai trường hợp — [ledger-accounts.schema.ts:22-28](../../packages/modules/billing/src/database/schemas/ledger-accounts.schema.ts): `(code, currency, customer_id)` khi có khách, `(code, currency)` khi không. Nếu chỉ dùng một index thì `NULL` sẽ không chống trùng được, vì `NULL` không bằng `NULL`.

## Ghi một giao dịch

`postTransaction` — [ledger.service.ts:80-109](../../packages/modules/billing/src/services/ledger.service.ts):

| #   | Nơi xảy ra                                                                                 | Làm gì                                                                                                      |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1   | [assertBalanced:484-504](../../packages/modules/billing/src/services/ledger.service.ts)    | tổng debit phải bằng tổng credit, và phải khác 0                                                            |
| 2   | [buildPostings:311-339](../../packages/modules/billing/src/services/ledger.service.ts)     | mỗi entry → một posting; `ensureAccount` nếu chỉ có `accountCode`                                           |
| 3   | [ledger.service.ts:321-325](../../packages/modules/billing/src/services/ledger.service.ts) | currency của tài khoản phải khớp currency của giao dịch                                                     |
| 4   | [writeTransaction:251-309](../../packages/modules/billing/src/services/ledger.service.ts)  | INSERT transaction + postings + event `ledger.transaction.posted`, **trong `executor` nếu được truyền vào** |
| 5   | [ledger.service.ts:300-305](../../packages/modules/billing/src/services/ledger.service.ts) | unique violation trên `externalId` → `ConflictError`                                                        |

Bước 4 là điểm cốt lõi: các service nghiệp vụ truyền `tx` của mình vào, nên bút toán và dữ liệu nghiệp vụ cùng commit hoặc cùng rollback. Không có cửa sổ nào mà hoá đơn đã phát hành nhưng sổ chưa ghi.

Bước 5 là chống ghi trùng: `external_id` unique — [ledger-transactions.schema.ts:31](../../packages/modules/billing/src/database/schemas/ledger-transactions.schema.ts). Ghi sổ hai lần cho `invoice:<id>` là không thể.

## Bất biến

Migration `0003_ledger_immutability` gắn trigger chặn UPDATE/DELETE trên `ledger_transactions` và `ledger_postings` ở tầng DB. Kể cả `psql` gõ tay cũng không sửa được.

Thêm hai chốt ở schema:

- `check ledger_postings_amount_positive` — số tiền luôn dương; hướng nằm ở cột `direction`, không ở dấu.
- Dữ liệu ghi sai chỉ sửa được bằng **bút toán đảo**, để lại đủ hai hàng.

## Đảo bút toán

`reverseTransaction` — [ledger.service.ts:185-242](../../packages/modules/billing/src/services/ledger.service.ts):

1. Đã đảo rồi (`reversedByTransactionId` khác `null`) → `ConflictError`.
2. Sinh posting đảo hướng từng dòng gốc (`debit` ↔ `credit`), cùng số tiền.
3. `reversesTransactionId = id` trên bản đảo, `linkLedgerReversal` ghi `reversedByTransactionId` lên bản gốc.
4. `externalId = null` — [ledger.service.ts:226](../../packages/modules/billing/src/services/ledger.service.ts) — nếu không sẽ đụng unique index với bản gốc.
5. Event `ledger.transaction.reversed`.

Bước 3 là ngoại lệ duy nhất với quy tắc bất biến: `reversed_by_transaction_id` trên bản gốc được cập nhật. Trigger immutability cho phép riêng cột này.

## Số dư

`ledger_account_balances` là **view** — [ledger-accounts.schema.ts:34-39](../../packages/modules/billing/src/database/schemas/ledger-accounts.schema.ts) — cộng `debits`, `credits`, `balance` từ `ledger_postings`. Không có cột số dư lưu sẵn, nên không bao giờ lệch với các posting. Đổi lại, số dư phải tính mỗi lần đọc.

## Kiểm tra định kỳ

Worker `WORKFLOW_NAME=ledger`, chu kỳ `LEDGER_INTEGRITY_INTERVAL_MS`:

- [ledger-integrity-check.processor.ts:9-23](../../apps/worker/src/workflows/processors/ledger-integrity-check.processor.ts) gọi `findImbalancedTransactions(batchSize)`.
- Cân thì `log.debug`; lệch thì `log.error` kèm danh sách `transactionIds`.

Nó **chỉ báo động, không tự sửa** — và đúng ra là vậy: sổ lệch là chuyện phải có người nhìn. Về lý thuyết `assertBalanced` đã chặn từ đầu, nên job này là lưới an toàn cho lỗi lập trình hoặc can thiệp tay.

## Route admin

Tất cả dưới `/api/v1/admin/ledger`, cần `ADMIN_API_KEY` — [ledger.routes.ts](../../apps/api/src/routes/admin/ledger/ledger.routes.ts):

| Route                                                   | Việc                                                                                                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /accounts`, `GET /accounts/:accountId`             | danh sách/chi tiết kèm số dư                                                                                                                                                              |
| `GET /transactions`, `GET /transactions/:transactionId` | lọc theo `accountId` hoặc `customerId` (tự quy về tài khoản `accounts_receivable` của khách — [ledger.service.ts:362-379](../../packages/modules/billing/src/services/ledger.service.ts)) |
| `POST /transactions`                                    | ghi tay                                                                                                                                                                                   |
| `POST /transactions/:transactionId/reverse`             | đảo, bắt buộc có `reason`                                                                                                                                                                 |

## Đọc tiếp

- [11 — Reporting và reconciliation](./11-reporting-reconciliation.md)
- ADR: [0003 ledger](../adr/0003-phase-2-ledger.md)
