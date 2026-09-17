# @pinstripe/sdk

Typed client cho Pinstripe API. Frontend không gọi API bằng tay nữa — mọi request đi qua đây.

## Ba subpath

| Import                 | Dùng ở đâu                              | Nội dung                                                      |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `@pinstripe/sdk`       | mọi nơi (isomorphic)                    | `PinstripeClient`, resource namespaces, error classes, types  |
| `@pinstripe/sdk/react` | app React có TanStack Query             | `PinstripeProvider`, query keys, `use*Query` / `use*Mutation` |
| `@pinstripe/sdk/node`  | server (Next server components, script) | `createPinstripeClient()` đọc env, `webhooks.constructEvent`  |

`react` và `react-query` là **optional peer** — `portal-ui` import `.` và `/node` nên không bao giờ kéo React Query vào module graph.

## Dùng

```ts
import { PinstripeClient } from '@pinstripe/sdk';

const pinstripe = new PinstripeClient({ baseUrl: '', apiKey: 'sk_test_…' });

const customers = await pinstripe.customers.find({ limit: 20 });
const customer = await pinstripe.customers.get('cus_123');
```

`apiKey` và `baseUrl` đều optional: `admin-ui` chạy với `baseUrl: ''` và không có key, vì Vite proxy tự inject `Authorization`.

Server đọc env (`PINSTRIPE_API_URL`, `PINSTRIPE_SECRET_API_KEY`, `PINSTRIPE_ADMIN_API_KEY`, `PINSTRIPE_MAX_RETRIES`, `PINSTRIPE_TIMEOUT_MS`):

```ts
import { createPinstripeClient } from '@pinstripe/sdk/node';

const pinstripe = createPinstripeClient();
```

React:

```tsx
<PinstripeProvider
  client={pinstripe}
  onMutationError={(error) => {
    toast.show(error.message, { isError: true });
  }}
  onMutationSuccess={(message) => {
    toast.show(message);
  }}
>
  <App />
</PinstripeProvider>
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

`customers`, `products`, `prices`, `subscriptions`, `entitlements`, `invoices`, `creditNotes`, `paymentIntents`, `refunds`, `webhookEndpoints`, `webhookDeliveries`, `billing.{meters,meterEvents,meterEventBatches}`, `testHelpers.testClocks`, và `admin.{ledgerAccounts,ledgerTransactions,reporting}`.

`admin.*` đi qua một transport thứ hai mang `adminApiKey` và base path `/api/v1/admin`. Bề mặt khuyết ở vài chỗ (`entitlements` chỉ `find`, `products` không có `delete`, `creditNotes` không có `void`) là hình dạng thật của API — đừng lấp.

## Idempotency và retry

Mọi `POST` / `PUT` / `PATCH` / `DELETE` tự mang header `idempotency-key` (`crypto.randomUUID()`), sinh **một lần trước vòng retry** và tái dùng cho mọi lần thử lại — nên một request bị retry sẽ replay chứ không chạy hai lần.

Retry: transport failure, `408`, `429`, `500`, `502`, `503`, `504`. Không retry `400/401/403/404/409/422`. `Retry-After` được tôn trọng; ngược lại backoff mũ có full jitter, cap 5s.

`GET` an toàn sẵn. Method mutating chỉ retry khi có idempotency key trên wire — SDK tự sinh nên mặc định luôn có; tắt bằng `shouldGenerateIdempotencyKey: false` thì cũng tắt luôn retry cho method đó.

## Errors

- `PinstripeError` — server trả envelope `{ error: { type, code, param, message, requestId } }`.
- `PinstripeConnectionError` — không có envelope: mạng chết, proxy trả HTML, request bị abort.
- `PinstripeSignatureVerificationError` — webhook signature sai hoặc ngoài tolerance.

`.message` an toàn trên cả ba; đọc `.statusCode` / `.type` phải `instanceof PinstripeError` trước.

## Build và typecheck — ba cái bẫy

- `pnpm --filter @pinstripe/admin-ui typecheck` **bypass turbo** và check với `packages/sdk/dist` cũ. Luôn chạy qua root script (`pnpm typecheck`).
- Khi dev, chạy `pnpm --filter @pinstripe/sdk dev` (tsup watch) song song với app, nếu không HMR phục vụ SDK của hôm qua.
- Đổi contract trong `@pinstripe/core` cần rebuild **core rồi rebuild sdk** — hai hop, không phải một.

`splitting: true` trong `tsup.config.ts` là bắt buộc: không có nó mỗi entry giữ một bản copy `PinstripeError` riêng và `error instanceof PinstripeError` sẽ sai cho error ném ra từ client dựng qua `/node`.

## Types

Thứ giữ `dist/*.js` sạch runtime reference tới core là **`import type` + `verbatimModuleSyntax: true`** — TypeScript erase hoàn toàn. `src/bundle.test.ts` pin điều đó lại.

`src/types/contracts.types.ts` gom mọi `export type` từ `@pinstripe/core/contracts` vào một chỗ vì lý do khác: nó là bản kê bề mặt type công khai của SDK, và là một điểm sửa duy nhất nếu lúc publish phải vendor contract types bằng tay (đường `dts: { resolve: ['@pinstripe/core'] }` thì chạy được dù có funnel hay không). Hiện chưa có lint nào bắt buộc đi qua nó — đó vẫn là quy ước.

Khi publish ra ngoài: đổi tsup sang `dts: { resolve: ['@pinstripe/core'] }` để inline declaration của core; `@sinclair/typebox` khi đó thành dependency (types-only) thật.
