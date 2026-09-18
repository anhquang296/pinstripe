# 0021 — Timestamp là ISO string từ tầng cột, response không còn `object`

- **Trạng thái.** Accepted
- **Phase.** 20
- **Xây trên.** [0020 — Dòng tiền](0020-money-flow.md)

## Bối cảnh

Mỗi service có một `build<Entity>()` chép entity sang `<Entity>Response` từng field một. Việc thật
của nó chỉ có hai: gọi `.toISOString()` trên các cột `Date` và gắn `object: '<tên>'`. Ba chục hàm như
vậy là bề mặt phải bảo trì. Thêm một cột vào bảng thì phải nhớ thêm vào builder, quên thì field biến
mất khỏi response mà không có lỗi nào báo.

`object` là thói quen chép từ Stripe. Trong repo này nó không phân biệt được gì mà `id` chưa phân biệt:
id nào cũng mang prefix loại (`cus_`, `in_`, `sub_`… trong `ObjectPrefixEnum`).

## Quyết định

### 1. Cột thời gian đọc ra là ISO string

Mọi cột `timestamptz` khai báo bằng `isoTimestamp` ([database/columns/iso-timestamp.ts](../../packages/core/src/database/columns/iso-timestamp.ts)),
một `customType` có kiểu dữ liệu `string`. `fromDriver` chuẩn hoá chuỗi của driver
(`2026-09-18 10:00:00.123456+00`) thành `Date#toISOString()` (`2026-09-18T10:00:00.123Z`). Kiểu SQL và
default `now()` giữ nguyên, nên quyết định này không sinh migration.

Tầng dữ liệu nói bằng string ở cả hai chiều: row type, payload ghi, filter và tham số thời gian của
repository (`RowCursor.createdAt`, `…BeforeAt`, `deletedAt`…) đều là ISO string.

`Date` chỉ còn ở chỗ **tính toán**: `clock.now()`, `utils/billing-period.ts`, so sánh khoảng thời gian.
Service parse một lần, `new Date(subscription.currentPeriodEnd)`, và đổi ngược bằng `.toISOString()`
ở chỗ ghi.

### 2. Bỏ `object` khỏi mọi response

Không có trên entity, không có trên vỏ list (`{ url, hasMore, data }`), không có trên event. Riêng
`data.object` của event vẫn giữ, vì đó là chỗ chứa payload chứ không phải nhãn loại.

`ExpansionService` từng dựa vào `object` để biết entity nào expand được field nào. Giờ nó đọc prefix
của `id` qua `resolveGidPrefix`, và nhận diện vỏ list qua `hasMore`.

### 3. Service trả thẳng entity

Builder chỉ còn chép 1:1 thì xoá, service trả row. Row có thêm cột nội bộ (`livemode`, `deletedAt`…)
nhưng mọi route đều khai báo `response` schema, và fast-json-stringify chỉ serialize các field có
trong schema. Builder còn giữ khi nó thật sự làm việc: ghép con (invoice với line item, payment
intent với charge), dựng field lồng (`price.recurring`), hoặc nhận thêm tham số (token của API key,
secret của webhook endpoint).

## Hệ quả

- Thêm một cột vào bảng và vào contract là đủ để nó xuất hiện trên response, không còn chỗ thứ ba.
- Đây là thay đổi phá vỡ hợp đồng công khai: client nào đang đọc `object` phải chuyển sang prefix của
  `id`.
- Precision không đổi so với trước: `Date` vốn đã cắt microsecond của Postgres xuống millisecond.
- Muốn tính toán với thời gian thì phải parse. So sánh chuỗi chỉ đúng khi cả hai vế đều là ISO string
  UTC do `toISOString()` sinh ra. Xem [PITFALLS §2](../PITFALLS.md).
- Chỉ có cột mới đi qua `fromDriver`. Raw SQL (`db.execute`) và `sql<…>` tự viết nhận chuỗi thô của
  driver, nên phải tự chuẩn hoá (xem `OutboxEventRepository.claimOutboxEvents`).
