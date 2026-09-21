# Product và price — vì sao bảng giá phải tách làm hai

Bảng giá của một app SaaS trông như một thứ duy nhất: "Go 99k, Plus 299k, Pro 799k". Nhưng cái tên
"Pro" sống nhiều năm và xuất hiện trong mọi báo cáo, còn con số 799k thì đổi mỗi vài quý, nhân lên
theo chu kỳ tháng/năm và theo từng loại tiền tệ. Gộp hai thứ đó vào một hàng nghĩa là mỗi lần đổi giá
là một sản phẩm mới — và mọi hoá đơn đã phát hành đổi số theo.

Code: [`products.schema.ts`](../../packages/modules/billing/src/database/schemas/products.schema.ts),
[`prices.schema.ts`](../../packages/modules/billing/src/database/schemas/prices.schema.ts),
[`price.service.ts`](../../packages/modules/billing/src/services/price.service.ts).
Cơ chế CRUD từng bước ở [flow 03](../flows/03-catalog-and-customer.md); tài liệu này nói **vì sao**
tách, tách ra thì giải quyết được việc gì, và một catalog thật trông như thế nào khi đã đổ vào hai
bảng.

## Vấn đề

Giả sử chỉ có một bảng `plans`, mỗi hàng là một dòng trong bảng giá: `name`, `amount`, `currency`,
`interval`. Bốn việc bình thường của một app đang sống đều gãy:

| Việc                    | Hỏng ở đâu                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Bán thêm gói năm        | "Pro tháng" và "Pro năm" thành hai sản phẩm không liên quan. Báo cáo "bao nhiêu khách dùng Pro" phải hard-code danh sách tên |
| Bán thêm bằng USD       | nhân đôi số hàng, cùng vấn đề                                                                                                |
| Tăng giá Pro            | sửa `amount` tại chỗ → **hoá đơn đã phát hành đổi số**; tạo hàng mới → khách cũ trỏ vào đâu?                                 |
| Gate tính năng theo gói | không có định danh ổn định để hỏi "khách này có quyền Pro không" — chỉ có một mớ dòng giá                                    |

Tách ra, mỗi bảng chỉ trả lời một câu hỏi:

| Bảng       | Trả lời                          | Đổi bao nhiêu lần            | Ai trỏ vào nó                                                                          |
| ---------- | -------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| `products` | **bán cái gì**                   | hiếm — gần như không bao giờ | `prices`, `entitlements`, mọi báo cáo theo sản phẩm                                    |
| `prices`   | **thu tiền theo điều khoản nào** | liên tục                     | `subscription_items`, `invoice_line_items` — và trỏ vào **một hàng cụ thể, vĩnh viễn** |

Đó là lý do `products` có `deleted_at` còn `prices` thì không: một price không bao giờ được biến mất,
vì hoá đơn năm ngoái vẫn đang trỏ vào nó.

## Ví dụ: app "Chatly" với ba gói Go / Plus / Pro

Bảng giá mà người dùng nhìn thấy:

| Gói    | Tháng   | Năm       | Kèm theo                        |
| ------ | ------- | --------- | ------------------------------- |
| Go     | 99.000  | 990.000   | —                               |
| Plus   | 299.000 | 2.990.000 | —                               |
| Pro    | 799.000 | 7.990.000 | —                               |
| Add-on | —       | —         | AI credits, tính theo lượt dùng |

Đổ vào catalog thành **4 product và 7 price**:

```
prod_go          "Chatly Go"          ├── go_monthly_vnd      99.000 / tháng
                                      └── go_yearly_vnd      990.000 / năm
prod_plus        "Chatly Plus"        ├── plus_monthly_vnd   299.000 / tháng
                                      └── plus_yearly_vnd  2.990.000 / năm
prod_pro         "Chatly Pro"         ├── pro_monthly_vnd    799.000 / tháng
                                      └── pro_yearly_vnd   7.990.000 / năm
prod_ai_credits  "Chatly AI credits"  └── ai_credits_vnd         500 / lượt, metered
```

Quy tắc rút ra từ hình này — và là quy tắc quan trọng nhất của cả tài liệu:

> **Một product cho mỗi thứ mà quyền dùng phân biệt được. Một price cho mỗi cách thu tiền.**

Go / Plus / Pro loại trừ nhau và mở ra các tính năng khác nhau, nên chúng là **ba product** — vì
`entitlements` khoá theo `product_id` ([technique 04](./04-entitlement.md)). Tháng và năm chỉ khác
nhau ở cách trả tiền, không khác ở quyền, nên chúng là **hai price của cùng một product**.

Làm ngược lại — một product "Chatly" với bảy price — thì mọi khách có cùng một entitlement và app
không còn cách nào biết ai là Pro. Làm quá tay — sáu product cho sáu dòng giá — thì "Pro tháng" và
"Pro năm" thành hai sản phẩm khác nhau, và câu hỏi "doanh thu gói Pro" không có câu trả lời.

### Mapping sang cột

Một hàng `prices` của ví dụ trên, đọc theo từng cột
([`prices.schema.ts`](../../packages/modules/billing/src/database/schemas/prices.schema.ts)):

| Cột                    | `pro_monthly_vnd` | `ai_credits_vnd`  | Ý nghĩa                                                        |
| ---------------------- | ----------------- | ----------------- | -------------------------------------------------------------- |
| `product_id`           | `prod_pro`        | `prod_ai_credits` | thứ được bán                                                   |
| `lookup_key`           | `pro_monthly_vnd` | `ai_credits_vnd`  | khoá ổn định app hard-code, thay cho `price_...` luôn đổi      |
| `version`              | `1`               | `1`               | tăng dần trong cùng `lookup_key`                               |
| `effective_at`         | ngày tạo          | ngày tạo          | mốc bắt đầu có hiệu lực                                        |
| `currency`             | `vnd`             | `vnd`             | **phải khớp `customers.currency`** khi đăng ký                 |
| `type`                 | `recurring`       | `recurring`       | suy ra từ việc payload có `recurring` hay không                |
| `billing_scheme`       | `per_unit`        | `per_unit`        | `tiered` khi giá theo bậc                                      |
| `unit_amount`          | `799000`          | `500`             | bigint, đơn vị nhỏ nhất — đồng, không phải nghìn đồng          |
| `recurring_interval`   | `month`           | `month`           | add-on phải cùng chu kỳ với gói nếu nằm chung một subscription |
| `usage_type`           | `licensed`        | `metered`         | `licensed` = trả theo chỗ; `metered` = trả theo lượng dùng     |
| `meter_id`             | `null`            | `mtr_...`         | bắt buộc khi `metered`, **cấm** khi không                      |
| `tiers` / `tiers_mode` | `null`            | `null`            | chỉ dùng khi `billing_scheme = tiered`                         |
| `active`               | `true`            | `true`            | `false` = ngừng bán, hợp đồng đang chạy không ảnh hưởng        |

Còn `products` chỉ giữ thứ không liên quan tới tiền: `name`, `description`, `unit_label`, `active`,
`metadata` — chỗ để nhét `{"tier":"pro"}` cho app tự map.

## Sáu câu hỏi thực tế mà việc tách trả lời được

### 1. Tăng giá Pro mà không đụng khách cũ

Không sửa hàng cũ. Tạo price mới cùng `lookup_key`, service tự đặt `version + 1`
([`price.service.ts:208-216`](../../packages/modules/billing/src/services/price.service.ts)):

```
pro_monthly_vnd  version 1  799.000  effective_at 2026-01-01   ← hợp đồng ký năm ngoái vẫn trỏ vào đây
pro_monthly_vnd  version 2  899.000  effective_at 2026-10-01   ← khách mới từ tháng 10
```

Grandfathering không cần code đặc biệt: `subscription_items.price_id` và
`invoice_line_items.price_id` trỏ vào **một hàng cụ thể**, và hàng đó bất biến. Mọi hoá đơn đã phát
hành vẫn tính đúng số cũ dù bảng giá đã đổi hai lần.

Đây cũng là lý do `POST /v1/prices/:priceId` chỉ nhận `active`, `nickname`, `metadata` và từ chối
mọi field khác bằng 400 ([ADR 0002](../adr/0002-phase-1-customer-catalog.md)). "Sửa giá" không phải
một thao tác tồn tại trong hệ này.

### 2. Thêm gói năm

Thêm hai hàng `prices`, không thêm product nào. Entitlement không đổi (vẫn là `prod_pro`), báo cáo
theo sản phẩm không đổi, code gate tính năng không đổi. Khách đổi từ tháng sang năm là đổi
`subscription_items.price_id` — cùng product, nên quyền không gián đoạn.

### 3. Bán thêm bằng USD

Thêm `pro_monthly_usd`, `pro_yearly_usd`… cùng trỏ `prod_pro`. Ràng buộc duy nhất phải nhớ: khách
bill bằng đồng nào thì chỉ đăng ký được price đồng đó — kiểm tra ở
[`subscription.service.ts:467-510`](../../packages/modules/billing/src/services/subscription.service.ts), sai
thì 400 `Price ... is in X but the customer bills in Y`.

### 4. Add-on tính theo lượng dùng

`prod_ai_credits` + một price `metered` gắn `meter_id`. Meter là thứ đếm sự kiện; price là thứ quy
sự kiện ra tiền. Add-on nằm chung subscription với gói chính, miễn là **cùng chu kỳ** — một
subscription không được trộn price tháng với price năm.

Sáu quy tắc hình dạng chặn mọi cấu hình vô nghĩa ngay tại `POST /v1/prices`
([`assertPriceShape:232-272`](../../packages/modules/billing/src/services/price.service.ts)), và năm `CHECK`
constraint lặp lại đúng các quy tắc đó ở tầng DB
([`prices.schema.ts:65-84`](../../packages/modules/billing/src/database/schemas/prices.schema.ts)):

| Điều kiện                  | Bắt buộc                                           |
| -------------------------- | -------------------------------------------------- |
| `usageType = metered`      | phải có `meterId`                                  |
| `usageType ≠ metered`      | cấm `meterId`                                      |
| `billingScheme = per_unit` | phải có `unitAmount`                               |
| `billingScheme = tiered`   | phải có `tiers` **và** `tiersMode`                 |
| có `tiers`                 | bậc cuối phải `upTo: null` để bắt hết phần còn lại |

### 5. Ngừng bán gói Go

`POST /v1/products/:productId` với `active: false`, và `POST /v1/prices/:priceId` với `active: false`
cho từng price của nó. Không có `DELETE` cho product, và không có gì xoá được price — hợp đồng đang
chạy tiếp tục chạy, chỉ là không ai đăng ký mới được nữa. Đây là hành vi đúng: xoá một price là làm
hỏng mọi hoá đơn trỏ vào nó.

### 6. Gate tính năng theo gói

Ba gói là ba product, nên entitlement phân biệt được. Chi tiết ở
[technique 04 — Entitlement](./04-entitlement.md).

## Step by step — dựng catalog Go / Plus / Pro rồi tăng giá

Chạy được trên môi trường dev đã `pnpm docker:up`, `pnpm db:migrate` và `pnpm dev`. Cùng các bước
này làm được trên `/prices` của erp-ui — trang đó tạo price (per_unit, tiered, metered) và tắt
`active` được ([UC-01](../usecases/01-onboard-customer-and-catalog.md)); curl ở đây là để thấy
nguyên payload và nguyên phản hồi, nhất là bước 3.

```bash
set -a && . ./.env && set +a
API=http://localhost:3000
AUTH="Authorization: Bearer $SECRET_API_KEY"
JSON='content-type: application/json'
```

**Bước 1 — Ba product, in ra id.** `metadata.tier` là chỗ app tự map `product_id` sang gói của mình:

```bash
for tier in go plus pro; do
  echo "$tier $(curl -s -X POST $API/v1/products -H "$AUTH" -H "$JSON" \
    -H "Idempotency-Key: $(uuidgen)" \
    -d "{\"name\":\"Chatly ${tier}\",\"metadata\":{\"tier\":\"${tier}\",\"app\":\"chatly\"}}" \
    | jq -r '.id')"
done
```

**Bước 2 — Sáu price.** Thay ba `prod_...` bằng id vừa in:

```bash
for row in "prod_go:go:99000:990000" "prod_plus:plus:299000:2990000" "prod_pro:pro:799000:7990000"; do
  IFS=: read -r pid tier monthly yearly <<< "$row"

  curl -s -X POST $API/v1/prices -H "$AUTH" -H "$JSON" -H "Idempotency-Key: $(uuidgen)" \
    -d "{\"productId\":\"$pid\",\"lookupKey\":\"${tier}_monthly_vnd\",\"currency\":\"vnd\",
         \"unitAmount\":$monthly,\"billingScheme\":\"per_unit\",
         \"recurring\":{\"interval\":\"month\",\"intervalCount\":1,\"usageType\":\"licensed\"}}" \
    | jq -c '{lookupKey, version, unitAmount}'

  curl -s -X POST $API/v1/prices -H "$AUTH" -H "$JSON" -H "Idempotency-Key: $(uuidgen)" \
    -d "{\"productId\":\"$pid\",\"lookupKey\":\"${tier}_yearly_vnd\",\"currency\":\"vnd\",
         \"unitAmount\":$yearly,\"billingScheme\":\"per_unit\",
         \"recurring\":{\"interval\":\"year\",\"intervalCount\":1,\"usageType\":\"licensed\"}}" \
    | jq -c '{lookupKey, version, unitAmount}'
done
```

**Bước 3 — Thử sửa giá.** Đây là bước đáng chạy nhất:

```bash
curl -s -X POST $API/v1/prices/price_... -H "$AUTH" -H "$JSON" \
  -H "Idempotency-Key: $(uuidgen)" -d '{"unitAmount":899000}' | jq
```

Mong đợi: **400** `body must NOT have additional properties`. Fastify mặc định _im lặng xoá_ field
lạ; ở đây `removeAdditional: false` được bật để một lệnh sửa giá không bao giờ trả về 200 như thể
nó đã có tác dụng.

**Bước 4 — Tăng giá đúng cách: tạo version mới.** Vẫn `lookup_key` cũ:

```bash
curl -s -X POST $API/v1/prices -H "$AUTH" -H "$JSON" -H "Idempotency-Key: $(uuidgen)" \
  -d "{\"productId\":\"prod_pro\",\"lookupKey\":\"pro_monthly_vnd\",\"currency\":\"vnd\",
       \"unitAmount\":899000,\"billingScheme\":\"per_unit\",
       \"effectiveAt\":\"2026-10-01T00:00:00.000Z\",
       \"recurring\":{\"interval\":\"month\",\"intervalCount\":1,\"usageType\":\"licensed\"}}" \
  | jq '{id, lookupKey, version, unitAmount, effectiveAt}'
```

Mong đợi: `version: 2`. Không phải lỗi trùng — và đây là chỗ người quen Stripe hay bất ngờ, xem
[§ Giới hạn phải biết](#giới-hạn-phải-biết).

**Bước 5 — Hai version cùng tồn tại.**

```bash
curl -s "$API/v1/prices?lookupKey=pro_monthly_vnd" -H "$AUTH" \
  | jq '.data[] | {version, unitAmount, effectiveAt, active}'
```

### Mốc thời gian

| Sau bước | `prices` có gì                                  | Khách đang dùng version 1                      |
| -------- | ----------------------------------------------- | ---------------------------------------------- |
| 2        | 6 hàng, mỗi `lookup_key` một version            | —                                              |
| 3        | không đổi — lệnh sửa bị từ chối                 | —                                              |
| 4        | 7 hàng, `pro_monthly_vnd` có version 1 **và** 2 | vẫn 799.000, vì `subscription_items` trỏ id cũ |

### Kiểm chứng bằng SQL

Cả catalog trong một câu — product bên trái, các version giá bên phải:

```bash
docker compose -f docker/compose.yml exec -T postgres psql -U vxrerp -d vxrerp -c \
"select pr.name, p.lookup_key, p.version, p.unit_amount, p.recurring_interval, p.active
 from billing.prices p join billing.products pr on pr.id = p.product_id
 order by pr.name, p.lookup_key, p.version"
```

Hoá đơn trỏ vào version nào — bằng chứng của tính bất biến:

```bash
docker compose -f docker/compose.yml exec -T postgres psql -U vxrerp -d vxrerp -c \
"select l.invoice_id, p.lookup_key, p.version, l.amount
 from billing.invoice_line_items l join billing.prices p on p.id = l.price_id
 order by l.created_at desc limit 10"
```

## Giới hạn phải biết

- **Effective dating khai báo rồi nhưng chưa ai dùng.** `resolvePrice(lookupKey, at)` và
  `findEffectivePrice` ([`price.service.ts:172-182`](../../packages/modules/billing/src/services/price.service.ts),
  [`price.repository.ts:63-74`](../../packages/modules/billing/src/repositories/price.repository.ts)) không có
  route và không service nào gọi. Subscription và rating đều resolve theo `price_id`. Nghĩa là
  grandfathering hiện hoạt động **nhờ việc hợp đồng trỏ id cũ**, không phải nhờ `effective_at`; còn
  "chọn giá đang có hiệu lực tại thời điểm T" thì phía gọi phải tự làm.
- **`POST` cùng `lookup_key` luôn thành công và tạo version mới.** Không có xác nhận, không có 409.
  Một script chạy lại hai lần để lại hai version — trừ khi gửi kèm `Idempotency-Key` giống hệt.
- **UI không sửa được price, và đó là cố ý.** `/prices` tạo price và bật/tắt `active` được; sửa số
  tiền thì không có đường nào, vì `updatePriceSchema` chỉ nhận `active` / `nickname` / `metadata`.
  `/products` vẫn tạo được nhưng không sửa được.
- **`tax_behavior` chưa ai đọc.** Cột có từ phase 1, thuế chưa nằm trong phase nào —
  [PITFALLS §6](../PITFALLS.md).
- **`unit_amount` nullable đúng nghĩa.** Nó là `null` cho price `tiered` — đừng đọc nó mà không kiểm
  `billing_scheme`.

## Điều kiện phải giữ

- **Một product cho mỗi thứ mà entitlement cần phân biệt.** Gộp các gói loại trừ nhau vào một
  product là làm hỏng khả năng gate tính năng.
- **Không bao giờ sửa số tiền của một price.** Tạo version mới; hoá đơn cũ phải giữ nguyên số.
- **Không xoá price, không xoá product đang được trỏ tới.** Ngừng bán bằng `active: false`.
- **App hard-code `lookup_key`, không hard-code `price_...`.** Id đổi mỗi lần đổi giá; khoá thì không.
- **Tiền luôn là số nguyên đơn vị nhỏ nhất.** 799.000 đồng ghi là `799000`, không bao giờ là float —
  [utils/money.ts](../../packages/modules/billing/src/utils/money.ts).
- **Thêm chu kỳ hoặc tiền tệ là thêm price, không thêm product.**

## Đọc tiếp

- [flow 03 — Customer và catalog](../flows/03-catalog-and-customer.md) — khuôn CRUD, phân trang con trỏ, sáu quy tắc hình dạng
- [technique 04 — Entitlement](./04-entitlement.md) — vì sao "một gói = một product"
- [UC-01 — Dựng khách hàng và bảng giá](../usecases/01-onboard-customer-and-catalog.md) — kịch bản đầy đủ trên erp-ui
- [UC-02 — Đăng ký một khách vào plan](../usecases/02-subscribe-to-plan.md) — năm kiểm tra khi gắn price vào subscription
- [ADR 0002](../adr/0002-phase-1-customer-catalog.md) — quyết định gốc: price bất biến, có version
