# 0026 — Cổng nhà xe: đăng nhập bằng magic link qua BFF Next.js

- **Trạng thái.** Accepted
- **Thay thế một phần.** [0012 — Portal, reporting & reconciliation](0012-phase-9-portal-reporting.md) §7 và
  §"Hạn chế đã biết" về portal.
- **Xây trên.** [0024 — Đăng nhập dashboard và authorization theo session](0024-dashboard-auth-and-session-authorization.md)

## Bối cảnh

`apps/portal-ui` đọc dữ liệu bằng secret key toàn quyền rồi lọc theo `customerId` trên URL: ai biết
một `customerId` là đọc được công nợ của nhà xe đó. `next.config.ts` còn rewrite toàn bộ `/api/*`
sang API, nên origin của portal proxy luôn cả bề mặt admin.

Trong khi đó API đã có sẵn bề mặt `/portal/*`: magic link gửi tới `customers.email`, `linkKey` dùng
một lần, `sessionKey` lưu dạng sha256, và mọi route đọc `customerId` từ session chứ không từ tham số.
Việc còn thiếu là một cách để trình duyệt dùng bề mặt đó mà không bao giờ cầm key.

## Quyết định

### 1. Trình duyệt không cầm key nào; Next.js là BFF

`portal-ui` giữ Next.js vì cần một server. Route handler `app/bff/portal/[...path]` là proxy duy nhất
tới API, logic nằm ở `src/libs/portal-bff.ts`:

- **Allowlist đóng** `(method, path)`. Path ngoài danh sách trả 404 và không gọi API.
- Hai route đăng nhập (`POST links`, `POST sessions`) mang `PINSTRIPE_PORTAL_API_KEY` — key scope
  `portal`, publishable. Các route còn lại mang `Bearer <sessionKey>` đọc từ cookie.
- `sessionKey` trả từ `POST /portal/sessions` được **gỡ khỏi body** và đặt vào cookie
  `pinstripe_portal_session`: `httpOnly`, `SameSite=Lax`, `Secure` ở production, hết hạn đúng
  `sessionExpiresAt`.
- Mọi request không phải GET phải có `Origin` cùng host với request (`x-forwarded-host` hoặc `host`);
  khác thì 403. Đó là CSRF check, vì cookie `Lax` vẫn đi kèm điều hướng cùng site.
- API trả 401 cho một route dùng session, hoặc `DELETE sessions` thành công → BFF xoá cookie.

Phía trình duyệt dùng `new PinstripeClient({ baseUrl: '/bff', maxRetries: 0 })` và hook của SDK — không
có HTTP client viết tay. `maxRetries: 0` vì redeem một link dùng một lần không được phép tự thử lại.

`middleware.ts` chuyển về `/login` khi thiếu cookie. Đó chỉ là trải nghiệm; API mới là chốt chặn, và
phiên hết hạn giữa chừng được `RequirePortalSession` bắt qua 401 của `/portal/me`.

### 2. Link dùng một lần, và mở link không tiêu thụ nó

Cả magic link qua email lẫn `POST /v1/billing_portal/sessions` (kế toán tạo link cho khách) đều sinh
một `portal_sessions` ở trạng thái `pending` và trả `${PORTAL_BASE_URL}/login/verify?linkKey=…`. Không
còn URL nào chứa `sessionKey`.

Trang `/login/verify` không redeem khi GET: người dùng phải bấm "Tiếp tục đăng nhập". Bộ quét link
của mail server mở mọi URL trong email; nếu GET tiêu thụ link thì khách luôn nhận một link đã chết.

### 3. Giới hạn tần suất đăng nhập

`/portal/links` và `/portal/sessions` đi qua `portalRateLimitPlugin`: `PORTAL_RATE_LIMIT` lần mỗi
`PORTAL_RATE_WINDOW_SECONDS`, bucket theo `(portal key, route, IP người dùng)` và thêm
`(portal key, route, sha256(email))` cho `/portal/links`. IP đọc từ header
`x-pinstripe-client-ip` (`PORTAL_CLIENT_IP_HEADER`), chỉ được tin vì request đã xác thực bằng portal
key. BFF lấy IP từ phần tử đầu của `x-forwarded-for`, nên reverse proxy phía trước portal **phải ghi đè**
header đó; nếu không, kẻ tấn công tự đặt IP để né bucket theo IP (bucket theo email vẫn giữ).

### 4. Hook portal ở entry riêng

`@pinstripe/sdk/react/portal` chứa hook của bề mặt khách hàng. Admin-ui và portal-ui mỗi bên có một
test khẳng định mọi hook trong barrel của mình đều có màn dùng tới; tách entry giữ được cả hai test mà
không cần danh sách ngoại lệ. Xem `sdk-convention.md`.

### 5. UI giống admin-ui, danh tính thì không

HeroUI v3 + Tailwind v4 + react-hook-form/zod + TanStack Query + sonner, theme mặc định của HeroUI.
Không dùng better-auth: bảng `users` là nhân viên Vexere, và ADR 0024 cấm cookie session của dashboard
mở surface `portal`.

### 6. Bề mặt đọc của khách: chỉ thứ khách được thấy, tính ở server

- `GET /portal/invoices` không bao giờ trả `draft`; lọc `status` và `isOverdue`. "Quá hạn" là
  `status = open` và `dueAt` < giờ hiện tại của customer (`clockService.resolveCustomerNow`, nên test
  clock cũng đúng). `dueAt` giờ có trong `invoiceSchema` — cột đã tồn tại, chỉ chưa lên dây.
- `GET /portal/invoices/:invoiceId` và `/pdf` trả **404** cho hóa đơn của khách khác hoặc `draft`,
  không phải 403, để không xác nhận hóa đơn đó tồn tại.
- `GET /portal/invoice_totals` cộng công nợ theo **từng currency** (còn phải trả, quá hạn, đến hạn trong
  7 ngày, hạn gần nhất) bằng hàm thuần `buildInvoiceTotals`, không cộng lẫn tiền tệ (ADR 0012 §3).
- `GET /portal/subscriptions` trả `portalSubscriptionSchema` — shape gọn cho khách, kèm tên sản phẩm và
  đơn giá của từng item — thay vì `subscriptionSchema` đầy đủ của merchant.

### 7. PDF hóa đơn bằng pdfkit + Noto Sans

Bộ sinh PDF tự viết chỉ có Helvetica và thay mọi ký tự ngoài ASCII bằng `?`. `renderPdfDocument`
dùng pdfkit với Noto Sans (OFL, gói `@expo-google-fonts/noto-sans`) nhúng vào file, nội dung hóa đơn
bằng tiếng Việt. PDF vẫn được sinh một lần lúc phát hành và lưu lại; file cũ trong storage không tự
sinh lại.

### 8. Thanh toán: đọc lịch sử, chỉ dẫn chuyển khoản, không cổng thanh toán

- **Lịch sử thanh toán** đọc từ `invoice_payments` — mọi đường thu (cổng, cấn trừ vé/trừ ví của đối
  tác, kế toán ghi nhận tay) đều ghi vào đó. Kênh suy ra từ dòng thanh toán: có `paymentIntentId` là
  thẻ/cổng; `settlementReference` bắt đầu `collection_attempt:` là cấn trừ vé hoặc trừ ví theo
  `collectionMethod` của hóa đơn; còn lại là "kế toán ghi nhận". Không có bảng mới.
- **Chuyển khoản + VietQR**: `GET /portal/invoices/:invoiceId/bank_transfer` trả tài khoản nhận (env
  `BANK_TRANSFER_*`, một tài khoản chung) và payload VietQR theo chuẩn EMVCo/NAPAS (`buildVietQrPayload`,
  CRC-16/CCITT-FALSE), số tiền là `amountRemaining`, nội dung là số hóa đơn bỏ ký tự đặc biệt. Chỉ cho
  hóa đơn `open`, VND, còn nợ; thiếu cấu hình thì 404 và portal ẩn khối này. Tiền vẫn do kế toán đối
  soát và ghi nhận trong admin-ui — portal **không** tự đánh dấu đã trả.
- **Kế toán phụ trách** đọc từ `customers.metadata.accountantName` / `accountantEmail`.
- **Xuất CSV** `GET /portal/invoice_exports` (UTF-8 BOM để Excel đọc đúng dấu, tối đa 5.000 dòng).

### 9. Nhắc nợ chạy trong worker notification

`InvoiceReminderService` chạy theo `INVOICE_REMINDER_INTERVAL_MS` trong `NotificationWorkflow`, chỉ cho
hóa đơn `send_invoice` còn mở (hóa đơn thu tự động do dunning lo): T−3 (`due_soon`) và T+1 (`overdue`)
gửi nhà xe, cc kế toán phụ trách; T+5 (`overdue_internal`) gửi `BILLING_OPS_EMAIL`. Hóa đơn quá hạn hơn
30 ngày không được nhắc lần đầu, để lần bật tính năng không dội thư cho nợ cũ. Bảng `invoice_reminders`
(unique `invoice_id + kind`) được ghi **trước** khi xếp email vào hàng đợi: chạy lại không bao giờ gửi
trùng, đổi lại một lần enqueue thất bại sẽ mất thư đó.

Mọi template email chuyển sang tiếng Việt, và nội dung HTML được escape (tên khách trước đây chèn thẳng
vào `<p>`).

## Hệ quả

- Danh tính portal hiện là **customer**, không phải người: ai giữ hộp thư `customers.email` là vào
  được. Chưa có vai trò Chủ xe / Kế toán nhà xe, chưa có nhiều người dùng cho một nhà xe.
- Session sống `PORTAL_SESSION_TTL_MINUTES` (mặc định 60), không gia hạn trượt.
- Portal phải deploy với `PINSTRIPE_API_URL` + `PINSTRIPE_PORTAL_API_KEY`, và **không bao giờ** với
  secret key.
