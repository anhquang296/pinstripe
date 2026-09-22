# So sánh Odoo, HubSpot, Salesforce

- **Ngày research.** 2026-09-22.
- **Đầu vào.** [`01-odoo.md`](01-odoo.md) (Odoo 19.0), [`02-hubspot.md`](02-hubspot.md) (API `2026-09`),
  [`03-salesforce.md`](03-salesforce.md) (Winter '27, API v68.0). Số liệu và nguồn nằm trong từng báo
  cáo; file này chỉ tổng hợp, không thêm fact mới.
- **Khung.** 15 tiêu chí ở [`00-erp-overview.md`](00-erp-overview.md) §6. Cột "vxrerp" ghi hiện trạng
  của repo để [`05-internal-architecture.md`](05-internal-architecture.md) dùng tiếp.

## 1. Ba hệ không cùng loại

|                             | Odoo                                                               | HubSpot                                                | Salesforce                                                                       |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Loại                        | ERP tích hợp (suite + framework)                                   | CRM-first SaaS                                         | Business platform (PaaS) + CRM                                                   |
| Câu hỏi nó trả lời tốt nhất | "Làm sao để bán hàng, kho, kế toán chạy trên một mô hình dữ liệu?" | "Làm sao để người vận hành tự dựng CRM trong vài giờ?" | "Làm sao để hàng trăm nghìn tổ chức tự tuỳ biến ứng dụng trên một kernel chung?" |
| Vai trò trong bộ research   | Đối chứng ERP lõi                                                  | Đối chứng CRM, UX vận hành; hệ đang bị thay            | Đối chứng platform, phân quyền, event                                            |

**Nhận định:** so HubSpot hay Salesforce với Odoo ở phần kế toán/kho là so không cân — hai hệ đó
không có phần này. Bảng dưới vẫn chấm đủ cả ba cho mọi tiêu chí, nhưng đọc cột theo đúng vai trò ở trên.

## 2. Ma trận so sánh

| #   | Tiêu chí                                | Odoo                                                                                                                   | HubSpot                                                                                                                 | Salesforce                                                                                                                                 | vxrerp hiện tại                                                                                                                    |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Phạm vi ERP lõi                         | Đủ: kế toán, kho, mua, bán, MRP, HR, localization VN                                                                   | Không có GL, kho, mua, HR; Revenue Hub có quote, invoice, subscription nhưng không có ledger, usage rating              | Không có GL, kho, HR gốc; ERP qua đối tác (Certinia, Rootstock); Revenue Cloud Billing làm sub-ledger                                      | Billing đầy đủ (catalog, subscription, metering, invoice, ledger kép bất biến, payment, dunning); CRM mới là khung                 |
| 2   | Kiến trúc triển khai, tenancy           | Monolith Python + PostgreSQL; tenant = database; Online / Odoo.sh / on-prem                                            | SaaS multi-tenant theo vùng ("Hublet"); không có vùng châu Á                                                            | SaaS multi-tenant metadata-driven, dữ liệu mọi org chung schema, partition theo OrgID; Hyperforce                                          | Modular monolith, một API + một worker + một Postgres, single-tenant                                                               |
| 3   | Data model, custom object/field         | Model là class Python; custom field (Studio, `x_`) là cột SQL thật; custom model được                                  | Object + property + association có label + pipeline; custom object chỉ Enterprise; property là metadata                 | sObject standard/custom (`__c`), lookup / master-detail, roll-up; mọi thứ là metadata                                                      | Model là code + migration Drizzle; không có custom field/object cho người dùng                                                     |
| 4   | Module hoá, phụ thuộc                   | Addon + `depends`; module khác sửa bảng và method qua `_inherit`; một schema chung, không có owner của bảng            | Hub bán theo gói, đóng, người dùng không thấy ranh giới                                                                 | Package (unlocked / 2GP) với namespace; kernel là monolith Java                                                                            | Package pnpm; mỗi module một Postgres schema; không FK chéo module; lint cấm import chéo                                           |
| 5   | Extensibility                           | Code (Python/XML/OWL) + Studio                                                                                         | Low-code (property, workflow) + app (UI extension, custom code 20 giây trên Lambda)                                     | Metadata + Flow + Apex + LWC                                                                                                               | Chỉ code                                                                                                                           |
| 6   | Workflow, automation                    | Method `action_*`, automation rule, server action, Studio                                                              | Workflow no-code (Pro+), custom code action, data sync                                                                  | Flow (công cụ duy nhất còn đầu tư) + Apex trigger; order of execution nhiều tầng                                                           | Service + BullMQ; domain event handler; không có automation cho người vận hành                                                     |
| 7   | Phân quyền                              | 3 lớp: ACL model → `ir.rule` record-level → field `groups`; áp chung cho UI và API                                     | Seat + permission set; record-level All / Team / Owned / Unassigned; field-level không chặn API                         | Profile + permission set; OWD → role hierarchy → sharing rule → bảng share có row cause; FLS; Shield                                       | 3 role hằng số, 16 permission, theo route, fail closed, áp chung session và API key; **chưa có record-level, chưa có field-level** |
| 8   | API, event                              | JSON-2 (19.0) gọi thẳng method ORM, mỗi call một transaction; XML/JSON-RPC bỏ ở Odoo 22; webhook ở cấp automation rule | REST version theo ngày (`/2026-09/`), hỗ trợ 18 tháng; webhook ký HMAC, retry 10 lần/24 giờ; journal v4 kéo theo offset | REST/SOAP/Bulk/Composite/GraphQL; version theo release, hỗ trợ ≥ 3 năm; Platform Events (publish after commit), CDC, Pub/Sub replay 72 giờ | REST `/v1`, `operationId` = method SDK, `openapi.json`; API key theo module; outbox + webhook có chữ ký, retry, delivery log       |
| 9   | Ecosystem                               | OCA + Apps Store; nhiều module VN                                                                                      | Marketplace lớn, nhiều connector                                                                                        | AppExchange lớn nhất, có cả ERP native                                                                                                     | Không có (nội bộ)                                                                                                                  |
| 10  | Reporting                               | Pivot/graph trên mọi model, SQL view, QWeb PDF, spreadsheet, báo cáo kế toán cấu hình được                             | Custom report builder, dataset; mạnh ở sales/marketing, yếu ở tài chính                                                 | Reports & Dashboards trên DB giao dịch (trần 2.000 dòng); CRM Analytics, Data 360 cho phân tích nặng                                       | Resource `reporting` trên DB giao dịch                                                                                             |
| 11  | UI shell                                | App launcher, menu → action → view; list/form/kanban/pivot; breadcrumb; chatter                                        | Một thanh điều hướng chung; record page ba vùng; activity timeline là trung tâm                                         | App Launcher, mỗi Lightning app một điều hướng; record page kéo thả                                                                        | App launcher kiểu Odoo, sidebar theo feature, list + `EntityDrawer`; chưa có timeline                                              |
| 12  | Đa công ty, tiền tệ, thuế, e-invoice VN | Multi-company trong một DB (`company_id`, `check_company`); module chính thức tích hợp SInvoice (Viettel)              | Không có e-invoice VN; HubSpot Payments không có ở VN (Stripe + 0,75%)                                                  | Không có e-invoice VN gốc; qua đối tác                                                                                                     | Đa tiền tệ theo customer; chưa có multi-company; **chưa tích hợp e-invoice**                                                       |
| 13  | Chi phí                                 | Theo user; Custom mới có Studio, multi-company, external API; chi phí thật nằm ở nâng cấp custom module hằng năm       | Seat × tier × hub + onboarding bắt buộc + credits; tính năng quan trọng khoá ở Enterprise                               | Đắt nhất: Core $195, Advanced $395, Max $550/user/tháng (từ 2026-09-03), add-on Shield, sandbox                                            | Chi phí đội dev và vận hành; không có phí seat                                                                                     |
| 14  | Vendor lock-in                          | Thấp–vừa: Community mã nguồn mở, tự host được; nhưng custom code dính chặt vào version                                 | Cao: data model của vendor, logic trong workflow; export association có trần                                            | Rất cao: Apex, Flow, SOQL không mang đi được; vendor tự đổi hướng (Workflow Rules, Connected App)                                          | Không có lock-in vendor; "lock-in" vào đội tự xây                                                                                  |
| 15  | Độ phù hợp với Vexere                   | Tốt cho kế toán/kho/e-invoice; kém cho billing theo usage và cho tích hợp sâu với dữ liệu vận hành Vexere              | Tốt cho CRM/marketing; không đáp ứng billing, tiền, e-invoice; dữ liệu ở ngoài VN                                       | CRM + quote tốt nhưng đắt; billing, GL, e-invoice vẫn phải làm ngoài                                                                       | Khớp billing và dữ liệu vận hành; thiếu độ rộng CRM, record-level, e-invoice, kế toán tổng hợp                                     |

## 3. Năm trục khác biệt quan trọng nhất

### 3.1 Ranh giới module nằm ở đâu

| Hệ         | Ranh giới                                                     | Hệ quả                                                                                       |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Odoo       | Chỉ ở UX (app) và cây `depends`; dữ liệu và method trộn chung | Tích hợp nhanh, một transaction xuyên app; nâng cấp đắt vì mọi override dính vào nhau        |
| HubSpot    | Do vendor quyết, người dùng không thấy                        | Không phải việc của khách; khách không mở rộng được lõi                                      |
| Salesforce | Namespace của package trên một kernel chung                   | Package cô lập về tên, nhưng mọi logic cùng chạy trên một lần lưu bản ghi                    |
| vxrerp     | Postgres schema + lint + event                                | Ranh giới cứng nhất trong bốn; đổi lại tích hợp xuyên module phải đi qua event hoặc id thuần |

### 3.2 Tuỳ biến: code hay dữ liệu

Odoo và Salesforce cho phép cả hai; HubSpot gần như chỉ dữ liệu; vxrerp chỉ code. Cả ba hệ đều phải
trả giá cho tuỳ biến bằng dữ liệu: Odoo mang `x_` field qua mỗi lần nâng cấp, Salesforce cần pivot
table và governor limit, HubSpot mất ràng buộc toàn vẹn. **Nhận định:** tuỳ biến bằng dữ liệu có giá
trị khi người dùng cuối là người cấu hình. Với ERP nội bộ có đội dev riêng, nó chỉ đáng làm ở vài điểm
thay đổi thường xuyên (pipeline, stage, có thể vài custom field CRM), không phải làm mặc định.

### 3.3 Phân quyền theo bản ghi

|             | Odoo                                         | HubSpot                                                      | Salesforce                                          |
| ----------- | -------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Cơ chế      | `ir.rule` = domain lọc, global AND, group OR | Scope All / Team / Owned / Unassigned theo từng hành động    | OWD mặc định chặt → mở dần; bảng share có row cause |
| Áp cho API  | Có                                           | Không đồng nhất (field-level, stage restriction bị API vượt) | Có                                                  |
| Độ phức tạp | Vừa                                          | Thấp                                                         | Cao (skew, recalculation)                           |

Cả ba đều có record-level; vxrerp chưa có. Đây là khoảng trống rõ nhất và là mục ưu tiên trong 05.

### 3.4 Hợp đồng tích hợp

- **API:** Odoo lộ ORM ra ngoài, không có contract độc lập với version sản phẩm. HubSpot (version theo
  ngày) và Salesforce (version theo release, có chính sách retire) đều có contract rõ. vxrerp gần
  HubSpot/Stripe nhất nhưng chưa ghi chính sách version.
- **Event:** Salesforce "publish after commit" và outbox của vxrerp là cùng một ý. HubSpot journal v4
  và Salesforce Pub/Sub đều cho consumer **kéo lại** event trong một cửa sổ (3 ngày / 72 giờ); vxrerp
  mới có push.

### 3.5 Trải nghiệm vận hành

App launcher có ở Odoo và Salesforce, vxrerp đã chọn giống. Thứ vxrerp chưa có mà cả ba hệ đều có:
**activity timeline / chatter trên từng bản ghi** và **màn chi tiết đủ rộng cho entity nhiều quan hệ**
(record page của HubSpot/Salesforce, form + smart button của Odoo).

## 4. Nếu dùng thẳng hệ này thay vì tự xây

| Phương án                            | Được                                                                              | Mất / rủi ro                                                                                                                                                            | Kết luận                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Ở lại HubSpot** cho mọi thứ        | CRM, marketing, help desk trưởng thành; không vận hành                            | Không có billing theo usage, ledger, dunning riêng, e-invoice VN, PSP nội địa; dữ liệu ở ngoài VN; giá seat tăng theo tier                                              | Không đáp ứng phần tiền — đúng lý do ADR 0030 tồn tại                                   |
| **HubSpot cho CRM + vxrerp billing** | Giữ UX CRM người dùng đã quen; vxrerp tập trung vào tiền                          | Đồng bộ hai chiều customer/company; chi phí seat tiếp tục; dữ liệu CRM ở ngoài VN; khó nối CRM với dữ liệu vận hành Vexere                                              | Phương án trung gian hợp lệ; cần so chi phí seat dài hạn với chi phí dựng `@vxrerp/crm` |
| **Odoo** thay cả hai                 | Kế toán, kho, e-invoice SInvoice, CRM cơ bản có sẵn                               | Billing theo usage/meter và ledger kiểu Stripe phải viết thành custom module Python, chịu chi phí nâng cấp hằng năm; tích hợp với hệ Vexere qua JSON-2 (chỉ gói Custom) | Hợp nếu nhu cầu lớn nhất là kế toán tổng hợp; không hợp nếu billing là lõi              |
| **Salesforce**                       | CRM + CPQ + billing sub-ledger, phân quyền mạnh                                   | Đắt nhất; GL và e-invoice vẫn phải làm ngoài; lock-in rất cao                                                                                                           | Không hợp quy mô và ngân sách hiện tại                                                  |
| **Tự xây (vxrerp)**                  | Billing khớp nghiệp vụ, dữ liệu trong tay, nối chặt với hệ Vexere, không phí seat | Tự chịu độ rộng CRM, record-level, e-invoice, kế toán; kém HubSpot về CRM trong nhiều năm                                                                               | Đúng cho billing; cần quyết định rõ phạm vi CRM và kế toán sẽ tự làm tới đâu            |

**Nhận định:** kết luận tổng là **tự xây đúng ở phần tiền** (billing, ledger, e-invoice), còn phần CRM
và kế toán tổng hợp là quyết định "tự xây hay tích hợp" riêng, cần con số chi phí seat và phạm vi cụ
thể — [`05-internal-architecture.md`](05-internal-architecture.md) §4 đề xuất cách chốt.

## 5. Bài học lấy về, gom theo lớp kiến trúc

| Lớp                | Học từ                    | Bài học                                                                                                               | Không học                                                                    |
| ------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Data / module      | Odoo (phản diện)          | Giữ ranh giới schema; tích hợp qua event hoặc module cầu nối sở hữu bảng riêng                                        | `_inherit` vá bảng và method của module khác                                 |
| Data / module      | Salesforce                | Không cần kernel metadata cho single-tenant                                                                           | MT_Data, flex column, governor limit                                         |
| Extensibility      | Odoo, Salesforce, HubSpot | Nếu có custom field: bảng định nghĩa + `jsonb` có validate, chỉ trên entity được chọn, thuộc module sở hữu entity     | DDL runtime (Odoo), EAV kiểu lỏng (HubSpot), custom object do người dùng tạo |
| Cấu hình nghiệp vụ | HubSpot                   | Pipeline và stage là dữ liệu cấu hình, ràng buộc stage thực thi ở service                                             | Workflow builder no-code tổng quát                                           |
| Phân quyền         | HubSpot, Salesforce, Odoo | Scope All / Team / Owned lọc ở repository; mặc định chặt; nếu có share tay thì bảng grant có lý do; áp cho cả API key | Sharing rule theo tiêu chí, recalculation; quyền chỉ ở UI                    |
| Phân quyền         | Salesforce                | Đơn vị cấp quyền là tập quyền có tên, cộng dồn được; role chỉ là tổ hợp mặc định                                      | Nhân bản role cho từng persona                                               |
| Event              | Salesforce, HubSpot       | Giữ outbox (= publish after commit); thêm endpoint đọc event theo cursor để consumer tự bắt kịp                       | CDC generic lộ schema                                                        |
| API                | HubSpot, Salesforce       | Ghi chính sách version và retire trước khi có consumer ngoài                                                          | Một version mới mỗi release                                                  |
| UI                 | HubSpot, Odoo             | Activity timeline trên bản ghi; record page đủ rộng cho entity CRM                                                    | Một thanh điều hướng gộp mọi hub                                             |
| Audit              | Odoo, Salesforce          | Tách audit nghiệp vụ (timeline) khỏi audit bảo mật; có chính sách lưu giữ                                             | Chỉ dựa vào tracking của chatter                                             |
| Reporting          | Salesforce, HubSpot       | Báo cáo trên DB giao dịch có trần; phân tích nặng sang kho riêng                                                      | —                                                                            |
| Localization       | Odoo                      | E-invoice là adapter theo nhà cung cấp, credential ở cấu hình, gửi qua queue có idempotency                           | Để quyền field chặn luồng gửi hoá đơn                                        |
| Multi-company      | Odoo                      | `company_id` + kiểm tra liên kết cùng công ty, quyết định sớm nếu có nhiều pháp nhân                                  | Làm sẵn khi chưa có nhu cầu                                                  |
