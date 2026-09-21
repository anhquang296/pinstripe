# @vxrerp/sdk

Typed client cho VXR ERP API. Frontend không gọi API bằng tay nữa — mọi request đi qua đây.

## Ba subpath

| Import              | Dùng ở đâu                              | Nội dung                                                   |
| ------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `@vxrerp/sdk`       | mọi nơi (isomorphic)                    | `VxrErpClient`, resource namespaces, error classes, types  |
| `@vxrerp/sdk/react` | app React có TanStack Query             | `VxrErpProvider`, query keys, `use*Query` / `use*Mutation` |
| `@vxrerp/sdk/node`  | server (Next server components, script) | `createVxrErpClient()` đọc env, `webhooks.constructEvent`  |

`react` và `react-query` là **optional peer** — `billing-portal-ui` import `.` và `/node` nên không bao giờ kéo React Query vào module graph.

## Dùng

```ts
import { VxrErpClient } from '@vxrerp/sdk';

const vxrErp = new VxrErpClient({ baseUrl: '', apiKey: 'sk_test_…' });

const customers = await vxrErp.customers.find({ limit: 20 });
const customer = await vxrErp.customers.get('cus_123');
```

`apiKey` và `baseUrl` đều optional: `erp-ui` chạy với `baseUrl: ''` và không có key, vì Vite proxy tự inject `Authorization`.

Server đọc env (`VXRERP_API_URL`, `VXRERP_SECRET_API_KEY`, `VXRERP_ADMIN_API_KEY`, `VXRERP_MAX_RETRIES`, `VXRERP_TIMEOUT_MS`):

```ts
import { createVxrErpClient } from '@vxrerp/sdk/node';

const vxrErp = createVxrErpClient();
```

React:

```tsx
<VxrErpProvider
  client={vxrErp}
  onMutationError={(error) => {
    toast.show(error.message, { isError: true });
  }}
  onMutationSuccess={(message) => {
    toast.show(message);
  }}
>
  <App />
</VxrErpProvider>
```

Mutation hook lo invalidate; chữ toast do call site truyền, mặc định không toast:

```ts
const { mutate: createProduct } = useCreateProductMutation({ successMessage: 'Đã tạo product.' });

const { mutate: finalizeInvoice } = useFinalizeInvoiceMutation({
  successMessage: (invoice) => {
    return `Đã phát hành ${invoice.number}.`;
  },
});
```

## Bề mặt

`customers`, `products`, `prices`, `subscriptions`, `entitlements`, `invoices`, `invoiceItems`, `creditNotes`, `coupons`, `promotionCodes`, `discounts`, `taxRates`, `taxIds`, `paymentIntents`, `refunds`, `webhookEndpoints`, `webhookDeliveries`, `billing.{meters,meterEvents,meterEventBatches}`, `testHelpers.testClocks`, và `admin.{ledgerAccounts,ledgerTransactions,reporting}`.

`admin.*` đi qua một transport thứ hai mang `adminApiKey` và base path `/api/v1/admin`. Bề mặt khuyết ở vài chỗ (`entitlements` chỉ `find`, `products` không có `delete`, `creditNotes` không có `void`, `promotionCodes` không có `delete`, `taxRates` không có `delete`, `taxIds` không có `update`) là hình dạng thật của API — đừng lấp.

## Idempotency và retry

Mọi `POST` / `PUT` / `PATCH` / `DELETE` tự mang header `idempotency-key` (`crypto.randomUUID()`), sinh **một lần trước vòng retry** và tái dùng cho mọi lần thử lại — nên một request bị retry sẽ replay chứ không chạy hai lần.

Retry: transport failure, `408`, `429`, `500`, `502`, `503`, `504`. Không retry `400/401/403/404/409/422`. `Retry-After` được tôn trọng; ngược lại backoff mũ có full jitter, cap 5s.

`GET` an toàn sẵn. Method mutating chỉ retry khi có idempotency key trên wire — SDK tự sinh nên mặc định luôn có; tắt bằng `shouldGenerateIdempotencyKey: false` thì cũng tắt luôn retry cho method đó.

## Errors

- `VxrErpError` — server trả envelope `{ error: { type, code, param, message, requestId } }`.
- `VxrErpConnectionError` — không có envelope: mạng chết, proxy trả HTML, request bị abort.
- `VxrErpSignatureVerificationError` — webhook signature sai hoặc ngoài tolerance.

`.message` an toàn trên cả ba; đọc `.statusCode` / `.type` phải `instanceof VxrErpError` trước.

## Build và typecheck — ba cái bẫy

- `pnpm --filter @vxrerp/erp-ui typecheck` **bypass turbo** và check với `packages/sdk/dist` cũ. Luôn chạy qua root script (`pnpm typecheck`).
- Khi dev, chạy `pnpm --filter @vxrerp/sdk dev` (tsup watch) song song với app, nếu không HMR phục vụ SDK của hôm qua.
- Đổi contract trong `@vxrerp/core` cần rebuild **core rồi rebuild sdk** — hai hop, không phải một.

`splitting: true` trong `tsup.config.ts` là bắt buộc: không có nó mỗi entry giữ một bản copy `VxrErpError` riêng và `error instanceof VxrErpError` sẽ sai cho error ném ra từ client dựng qua `/node`.

## Types

Thứ giữ `dist/*.js` sạch runtime reference tới core là **`import type` + `verbatimModuleSyntax: true`** — TypeScript erase hoàn toàn. `src/bundle.test.ts` pin điều đó lại.

`src/types/contracts.types.ts` gom mọi `export type` từ `@vxrerp/core/contracts` vào một chỗ vì lý do khác: nó là bản kê bề mặt type công khai của SDK, và là một điểm sửa duy nhất nếu lúc publish phải vendor contract types bằng tay (đường `dts: { resolve: ['@vxrerp/core'] }` thì chạy được dù có funnel hay không). Hiện chưa có lint nào bắt buộc đi qua nó — đó vẫn là quy ước.

Khi publish ra ngoài: đổi tsup sang `dts: { resolve: ['@vxrerp/core'] }` để inline declaration của core; `@sinclair/typebox` khi đó thành dependency (types-only) thật.
