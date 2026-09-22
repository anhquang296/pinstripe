# Research: các hệ ERP phổ biến và kiến trúc ERP nội bộ

- **Ngày bắt đầu.** 2026-09-22.
- **Mục tiêu.** Có cái nhìn tổng quan về ERP và kiến trúc tổng thể của một hệ ERP; một báo cáo riêng
  cho Odoo, HubSpot, Salesforce; so sánh ba hệ; từ đó kiểm chứng và đề xuất kiến trúc cho vxrerp —
  mỗi lựa chọn có lý do, ưu và nhược so với ba hệ kia.
- **Baseline.** Kiến trúc hiện tại của repo (ADR 0030 và các ADR liên quan). Báo cáo cuối **kiểm chứng
  - đề xuất** trên baseline đó, không thiết kế lại từ đầu.

## Mục lục

| File                                                         | Nội dung                                                               | Trạng thái |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------- |
| [`00-erp-overview.md`](00-erp-overview.md)                   | ERP là gì, ERP/CRM/platform, domain, kiến trúc tham chiếu, bộ tiêu chí | Nháp       |
| [`01-odoo.md`](01-odoo.md)                                   | Báo cáo Odoo                                                           | Nháp       |
| [`02-hubspot.md`](02-hubspot.md)                             | Báo cáo HubSpot                                                        | Nháp       |
| [`03-salesforce.md`](03-salesforce.md)                       | Báo cáo Salesforce                                                     | Nháp       |
| [`04-comparison.md`](04-comparison.md)                       | Ma trận so sánh và bài học                                             | Nháp       |
| [`05-internal-architecture.md`](05-internal-architecture.md) | Kiến trúc đề xuất cho vxrerp                                           | Nháp       |

## Template của báo cáo từng hệ (01–03)

Ba báo cáo có đúng 13 mục theo đúng thứ tự, để so được từng ô:

1. Tóm tắt — định vị, khách hàng mục tiêu, license, giá, hình thức triển khai
2. Phạm vi chức năng
3. Kiến trúc kỹ thuật (kèm sơ đồ)
4. Data model & extensibility
5. Workflow / automation / business logic
6. Phân quyền & bảo mật
7. Integration
8. Reporting / analytics
9. UI/UX shell
10. Deploy, vận hành, multi-tenancy, hiệu năng/giới hạn
11. Điểm mạnh / điểm yếu / anti-pattern
12. Bài học áp dụng cho vxrerp — nên học gì, không nên học gì
13. Nguồn — link và ngày truy cập

## Phương pháp

- Nguồn ưu tiên: tài liệu chính thức và source code của vendor, rồi engineering blog, rồi cộng đồng.
- Mọi khẳng định kỹ thuật có link. Nhận định của người viết được đánh dấu **Nhận định:**.
- Ghi rõ phiên bản sản phẩm/API đang khảo sát; sản phẩm SaaS thay đổi nhanh, số liệu giá và giới hạn
  có hạn dùng.
- Không chép nguyên văn tài liệu của vendor; tóm tắt bằng lời của mình.

## Lưu ý phạm vi

HubSpot và Salesforce là CRM-first, không có sổ cái kế toán hay kho gốc. Chúng được khảo sát cho phần
data model mở rộng, automation, phân quyền, API và ecosystem; Odoo là đối chứng cho phần ERP lõi.
