# Global Object ID — định danh object trên nền TypeID

Mọi object trong VXR ERP mang một **GID** (global unique id, mượn cách gọi của Stripe): một chuỗi
`prefix_suffix` sinh ở service, không để database sinh. Tài liệu này nói GID là gì, vì sao nó đứng
trên UUIDv7 chứ không phải UUIDv4 hay ULID, và những gì đã đánh đổi để có nó.

Code: [`packages/platform/src/utils/gid-factory.ts`](../../packages/platform/src/utils/gid-factory.ts). Nơi
GID được sinh trong một vòng request: [flow 03](../flows/03-catalog-and-customer.md).

## Hình dạng

```
cus_01m2mpre6veh68mpz2zht3w18g
│    └── 26 ký tự base32 (Crockford, viết thường) — chính là một UUIDv7 mã hoá lại
└── prefix lấy từ ObjectPrefixEnum
```

```ts
import { typeid } from 'typeid-js';

export function generateGid(prefix: ObjectPrefix): string {
  return typeid(prefix).toString();
}
```

Một dòng, vì [TypeID](https://github.com/jetify-com/typeid) đã là đúng thứ cần: một spec công khai
quy định "UUIDv7 + prefix + base32", và `typeid-js` sinh UUIDv7 bên trong. 26 ký tự base32 giải mã
ngược được về đúng 16 byte ban đầu — `TypeID.fromString(gid).toUUID()` trả lại UUID canonical, nên
định dạng này không phải một ngõ cụt.

`ObjectPrefixEnum` giữ nguyên 26 prefix cũ. Tất cả đều hợp lệ với TypeID (chỉ `[a-z_]`, không mở
hoặc đóng bằng `_`, tối đa 63 ký tự); `sub_sched` — prefix duy nhất có gạch dưới ở giữa — vẫn an
toàn vì `typeid-js` tách prefix bằng `lastIndexOf('_')` chứ không phải `split('_')`.

## Trước đó là gì, và hỏng ở đâu

Bản cũ tự chế: 24 byte ngẫu nhiên từ `node:crypto`, mỗi byte map `byte % 58` vào bảng base58.

1. **Không sort được theo thời gian.** Đây là vấn đề thật, không phải thẩm mỹ. Mọi repository phân
   trang keyset theo `(created_at, id)` — xem
   [`customer.repository.ts`](../../packages/modules/billing/src/repositories/customer.repository.ts) và 12 file
   cùng dạng — nên khi hai row trùng `created_at`, `id` là thứ quyết định thứ tự. Với ID ngẫu nhiên,
   thứ tự đó vô nghĩa: hai row tạo cùng một millisecond có thể trả về theo bất kỳ chiều nào.
2. **Lệch phân phối.** 256 không chia hết cho 58, nên `byte % 58` khiến 24 ký tự đầu bảng xuất hiện
   nhiều hơn 34 ký tự còn lại. Không phải lỗ hổng, nhưng entropy thực thấp hơn con số danh nghĩa.
3. **Không có spec.** Không giải mã ngược được về binary, không hệ nào khác đọc hiểu.

## Vì sao UUIDv7, không phải UUIDv4

UUIDv4 là 122 bit ngẫu nhiên thuần. UUIDv7 ([RFC 9562](https://www.rfc-editor.org/rfc/rfc9562)) đặt
**48 bit timestamp milli-giây ở đầu**, phần còn lại là counter + ngẫu nhiên. Khác biệt nằm ở đầu
chuỗi, và đó chính là chỗ mọi so sánh bắt đầu đọc.

|                                | UUIDv4              | UUIDv7                           |
| ------------------------------ | ------------------- | -------------------------------- |
| Thứ tự chuỗi so với thứ tự tạo | không liên quan     | trùng nhau                       |
| Điểm chèn vào B-tree index     | rải khắp cây        | luôn ở trang ngoài cùng bên phải |
| Page split khi insert          | thường xuyên        | gần như không                    |
| Locality của các row mới       | phân tán khắp index | nằm cạnh nhau                    |

Ba hệ quả cụ thể trong repo này:

- **Tiebreaker phân trang có nghĩa.** `(created_at, id)` giờ sắp xếp ổn định và đúng thứ tự tạo ngay
  cả khi `created_at` trùng đến từng millisecond.
- **Các index `*_created_at_id_idx`** — `customers`, `invoices`, `prices`, `payment_intents`,
  `refunds`, `webhook_endpoints`, `ledger_transactions`, … — nhận insert tuần tự thay vì ngẫu nhiên.
- **Debug đọc được.** Nhìn hai GID là biết cái nào sinh trước, không cần join sang `created_at`.

Cái mất: UUIDv7 **lộ thời điểm tạo**. Chấp nhận được vì GID trong hệ này là định danh công khai —
nó nằm trong URL, trong payload webhook, trong log. Điều kiện kèm theo ở cuối tài liệu.

## Vì sao UUIDv7, không phải ULID

[ULID](https://github.com/ulid/spec) ra đời trước và cùng một ý tưởng: 48 bit timestamp + 80 bit
ngẫu nhiên, mã hoá base32, sort được theo thời gian. Nếu chỉ xét tính sortable thì hai bên ngang
nhau. Chọn UUIDv7 vì ba điểm khác:

1. **UUIDv7 là chuẩn IETF.** RFC 9562 (2024) thay thế RFC 4122. ULID là một spec trên GitHub, không
   có tổ chức chuẩn nào đứng sau và đã nhiều năm không đổi.
2. **UUIDv7 là một UUID hợp lệ, ULID thì không.** ULID cũng 128 bit, nhưng không mang version và
   variant bits đúng chỗ, nên cắm vào cột `uuid` của Postgres là dữ liệu nói dối về chính nó. UUIDv7
   thì `uuid` nhận, `uuid[]` nhận, driver nhận, và Postgres 18 có sẵn hàm `uuidv7()` nếu sau này muốn
   sinh ID phía database.
3. **Hệ sinh thái.** UUIDv7 có mặt trong thư viện chuẩn hoặc thư viện chính thống của hầu hết ngôn
   ngữ và database; ULID phụ thuộc vào một package cộng đồng cho mỗi stack.

Còn điểm mạnh dễ thấy của ULID — chuỗi ngắn hơn UUID canonical — thì TypeID đã lấy lại: base32 26 ký
tự, đúng bằng ULID, so với 36 ký tự của UUID có dấu gạch.

## Vì sao bọc TypeID thay vì lộ UUID trần

Prefix không phải trang trí:

- ID tự mô tả trong log và khi hỗ trợ khách — `in_01m2...` là hóa đơn, `pi_01m2...` là payment
  intent, không phải tra bảng để biết.
- Truyền nhầm `cus_` vào chỗ chờ `sub_` là lỗi thấy được bằng mắt, và `hasPrefix` chặn được ở biên.
- Giữ nguyên hình dạng `prefix_body` mà API đang trả cho khách, nên đổi định dạng bên trong không
  phá hợp đồng bên ngoài.

Và không thêm thư viện sinh UUID thứ hai bên cạnh: `typeid-js` đã sinh UUIDv7 nội bộ qua `uuid@10`,
mà bản v7 của `uuid` giữ một bộ đếm 31 bit tăng dần trong cùng một millisecond — nghĩa là các GID
sinh liên tiếp đã monotonic, đúng tính chất mà tiebreaker `(created_at, id)` cần. Thêm một package
nữa chỉ để làm lại việc đó là surface thừa.

## Vì sao không cần migration

Mọi cột ID trong schema là `text` không giới hạn độ dài — không `varchar(n)`, không `CHECK`, không
cột `uuid` nào. Nên đổi định dạng không cần một dòng DDL: ID cũ base58 nằm lại nguyên trong DB, ID
mới là TypeID, cả hai cùng là chuỗi.

Không backfill ID cũ, có chủ đích: viết lại ID nghĩa là viết lại mọi khoá ngoại, mọi idempotency key
đã cấp, và mọi cursor khách đang giữ.

Tác động duy nhất là ngữ nghĩa tiebreaker của phân trang. So sánh vẫn là một total order trên `text`
nên cursor client đang giữ không hỏng; chỉ là với các row cũ, `id` vẫn tiebreak ngẫu nhiên như trước,
còn từ giờ trở đi thì tiebreak theo thời gian.

## Điều kiện phải giữ

- **GID không bao giờ là secret.** Nó lộ thời điểm tạo và không có tính không-đoán-được đủ mạnh cho
  mục đích đó. Token, capability, link chia sẻ dùng bí mật ngẫu nhiên riêng, không dùng GID.
- **Không parse GID để lấy timestamp** trong business logic. Thời gian của một row là
  `created_at`, lấy từ `fastify.clock` — đó là thứ test clock ([flow 12](../flows/12-test-clock.md))
  điều khiển được, còn timestamp trong GID thì không.
- **Prefix mới phải hợp lệ với TypeID**: chỉ `[a-z_]`, không mở hoặc đóng bằng `_`.
