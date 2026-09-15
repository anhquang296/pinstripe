# ADR 0005 — Subscription & Entitlement (Phase 3)

Ngày: 2026-09-15
Trạng thái: Accepted

## Bối cảnh

Kill Bill diễn đạt "Subscription = Entitlement + Billing Information" (RESEARCH §1.3): quyền dùng và
chu kỳ tính tiền là hai trục khác nhau. Phase 3 dựng vòng đời subscription, và tách entitlement ra
đúng theo công thức đó — trước khi có invoicing để không bị cám dỗ trộn hai thứ.

## Quyết định

1. **State machine khai báo thành bảng, không rải if/else.** `SUBSCRIPTION_TRANSITIONS` là
   `Record<SubscriptionStatus, SubscriptionStatus[]>`; mọi chuyển trạng thái đi qua
   `assertTransition` và ném `ConflictError` khi sai. Thêm trạng thái mới là thêm một dòng, và
   TypeScript bắt lỗi nếu quên khai báo.
2. **Entitlement đồng bộ qua event, không join.** Bảng `entitlements` riêng (unique theo
   `subscription_id + product_id`); worker `domain-event` nhận `subscription.*` rồi gọi
   `entitlementService.handleSubscriptionChanged()`. Không service nào join từ subscription sang
   entitlement — đúng ranh giới RESEARCH §4 đặt ra (eventual consistency cho projection).
   Hệ quả kiểm chứng được: hủy cuối kỳ thì subscription vẫn `active` và entitlement vẫn `active`;
   khi clock vượt qua `current_period_end` thì subscription thành `canceled` rồi entitlement mới
   `revoked`. Hai sự kiện tách nhau, đúng như nghiệp vụ mô tả.
3. **Ánh xạ trạng thái là một bảng, không phải điều kiện rải rác.**
   `ENTITLEMENT_BY_SUBSCRIPTION_STATUS`: `past_due` vẫn `active` (grace period thuộc về dunning ở
   phase 8), `unpaid` là `blocked`, `canceled` là `revoked`.
4. **Test clock là object trong DB, không phải mock trong test.** `test_clocks.frozen_time` là "now"
   của mọi customer gắn vào nó; `POST /v1/test_helpers/test_clocks/:id/advance` tua thời gian rồi
   chạy `advanceSubscriptions`. Nhờ vậy kịch bản trial → renew → hủy cuối kỳ chạy được qua **HTTP
   thật**, demo cho kế toán xem, chứ không chỉ trong unit test.
   Đồng hồ chỉ đi tới; lùi bị từ chối 400.
5. **Tua thời gian cuốn qua *mọi* kỳ đã trôi, không phải một kỳ.** Nhảy từ 1/1 tới 15/4 làm kỳ cuốn
   ba lần. Giới hạn `MAX_PERIOD_ROLLS = 120` để một `frozen_time` sai không treo tiến trình.
6. **Số học kỳ là hàm thuần có test riêng.** `advancePeriod` xử lý clamp cuối tháng
   (31/1 + 1 tháng = 28/2) và 29/2 sang năm không nhuận. Đây là loại lỗi chỉ lộ ra vào đúng ngày cuối
   tháng trên production, nên nó có test bảng riêng từ bây giờ.
7. **`charged_through_date` tạo ra nhưng chưa dùng.** Phase 3 không thu tiền; cột tồn tại để phase 6
   phân biệt IN_ADVANCE với IN_ARREAR (khái niệm Charged-Through-Date của Kill Bill) mà không phải
   migrate lại.

## Lệch khỏi Stripe có chủ đích

Stripe tạo subscription ở trạng thái `incomplete` cho tới khi hóa đơn đầu được thanh toán. Ở đây
chưa có payment (phase 7), nên subscription không trial vào thẳng `active`. Trạng thái `incomplete`
đã có trong enum và trong bảng transition; phase 7 chỉ việc đổi điểm khởi đầu.

## Hệ quả

- Phase 5 (rating) đọc `current_period_start/end` và items; phase 6 (invoicing) sẽ ghi
  `charged_through_date` sau khi finalize.
- Mọi thay đổi subscription phát event, nên phase 8 bật webhook ra ngoài là có sẵn dữ liệu.
- Entitlement có cache Redis với TTL 5 phút, invalidate đúng các key `(customer, product)` vừa đụng
  tới — không quét `KEYS *`.
