# SDK Convention

`@pinstripe/sdk` là public API của sản phẩm này: một client dựng bằng class, có instance, có provider. Bốn rule của kit được viết cho một app tự gọi API bằng tay; app ở đây không còn làm thế nữa, và không ghi lại chỗ lệch thì agent tiếp theo sẽ "sửa" SDK về đúng chữ của kit và làm hỏng bề mặt công khai.

## Scope

Applies to `packages/sdk/**`, và tới cách hai frontend tiêu thụ nó.

Does **not** apply to:

- `apps/api`, `apps/worker`, `packages/core` — verb, layering và naming của kit đứng nguyên ở đó.
- Bất kỳ `api/` folder nào còn sót lại trong một app. Chừng nào nó còn tồn tại, `api-client-convention.md` vẫn quản nó.

## Frontend không còn `api/` folder

Một app tiêu thụ `@pinstripe/sdk` không tự dựng request function. Không `src/api/<domain>/request.ts`, không HTTP client thứ hai, không setter composition.

`react/api-client-convention.md` §"A folder per domain" và §"Request functions are stateless" (_"No classes, no BaseRepository, no singleton"_) mô tả chính cái folder đó. Trong SDK, resource **là** class và client **là** một instance mang `baseUrl` / `apiKey` / `fetch` / retry policy — vì một module singleton là đúng thứ một SDK không được có.

Những yêu cầu còn lại của rule đó vẫn ràng buộc, và ràng buộc bên trong SDK:

- Đúng một transport, trong đúng một file.
- Mỗi resource một hằng `{DOMAIN}_PATH`; mọi path dựng từ nó.
- Mọi path parameter qua `encodeURIComponent` (`buildPath`).
- Response envelope hiện trong return type — `Promise<ListResponse<CustomerResponse>>`, không unwrap.
- Component không bao giờ gọi thẳng resource; data đi qua hook.

## Method name: verb đọc theo kit, tên để bare

Trong `packages/sdk/src/resources/**`, method name lấy từ đúng một danh sách:

`find`, `get`, `create`, `update`, `delete`, `cancel`, `void`, `finalize`, `pay`, `confirm`, `advance`, `reverse`.

Hai verb đọc là verb của kit, không phải của Stripe, vì hành vi khớp đúng định nghĩa ở `core/verb-convention.md` §Verbs: transport ném `PinstripeError` khi 404, nên read một bản ghi là `get`; một list read trả `ListResponse` rỗng chứ không miss, nên là `find`. Bảy verb còn lại là domain verb của API, kit vốn đã cho phép.

Chỗ lệch với kit chỉ còn một, và nó ở **hình dạng tên**, không ở verb: method của resource là **bare**, entity nằm ở receiver. `customers.get(id)` chứ không `customers.getCustomer(id)` — lặp entity ở đây là lặp thật, và `create` / `update` / `cancel` xung quanh cũng bare. Mọi layer khác của repo giữ entity trong tên: repository vẫn `findCustomer<s>`, service vẫn `getCustomer` / `findCustomers`.

```ts
// CORRECT — trong packages/sdk/src/resources/
pinstripe.customers.find(query);
pinstripe.customers.get(customerId);
pinstripe.invoices.finalize(invoiceId);

// WRONG — entity lặp; receiver đã mang nó
pinstripe.customers.findCustomers(query);
pinstripe.customers.getCustomer(customerId);

// WRONG — verb Stripe; không còn dùng ở bất kỳ đâu trong repo
pinstripe.customers.list(query);
pinstripe.customers.retrieve(customerId);
```

`lodash/prefer-lodash-method` đọc mọi `.find(` là `Array.prototype.find` và đòi `_.find`. `pinstripe.customers.find(query)` không phải collection method, nên `eslint-config/react.js` liệt `^pinstripe\.` vào `ignoreObjects`. Đó là chỗ duy nhất xử lý va chạm này — đừng rải `eslint-disable` ở call site, và đừng đổi tên method để tránh lint.

Không tự chế method cho route không tồn tại. `entitlements` chỉ có `find`, `products` không có `delete`, `webhookDeliveries` không có `get`, `users` không có `delete`, `apiKeys` không có `get` — bề mặt khuyết là hình dạng thật của API, không phải SDK làm dở.

## Một transport, không có namespace `admin`

Client có **đúng một** `_transport`. Mọi resource dùng nó; không có `_adminTransport`, không có
`adminApiKey`, không có `AdminNamespace` — xem ADR 0028.

Resource từng nằm dưới `/api/v1/admin` nay là resource `/v1` bình thường: `users`, `apiKeys`,
`account`, `reporting` ở top level, còn sổ cái đi qua `LedgerNamespace` — `ledger.accounts`,
`ledger.transactions` — cùng hình dạng với `billing.meters`.

```ts
// CORRECT
pinstripe.users.find(query);
pinstripe.apiKeys.create(payload);
pinstripe.ledger.transactions.reverse(transactionId, payload);

// WRONG — namespace đã bị xoá cùng transport thứ hai
pinstripe.admin.users.find(query);
pinstripe.admin.ledgerTransactions.reverse(transactionId, payload);
```

`account.get()` không nhận id — nó đọc chính session đang gọi, nên route trả `ForbiddenError` cho
caller đi bằng API key. Quản trị user chỉ có `find` / `get` / `create` / `update`: xoá user không
phải một route, hạ quyền hay vô hiệu hoá đi qua `update` để `UserService` còn giữ được luật admin
active cuối cùng — xem `auth-convention.md`.

## `operationId` của route v1 là tên method SDK

`apps/api/openapi.json` sinh từ `schema` của route qua `@fastify/swagger` (`pnpm --filter @pinstripe/api openapi`). Mỗi route v1 khai `operationId: '<resource>.<method>'` đúng bằng lời gọi SDK. Không khai `summary` hay `description` trên route:

```ts
// CORRECT — apps/api/src/routes/v1/customers/customers.routes.ts
schema: { operationId: 'customers.get', params: customerParamsSchema, ... }

// WRONG — tên tự đặt, không khớp SDK
schema: { operationId: 'getCustomer', ... }
```

Route chưa có method trong SDK (`events`, `payouts`, `disputes`, …) vẫn khai `operationId` cùng hình dạng — tên method nó **sẽ** có, verb lấy theo method của service (`capturePaymentIntent` → `paymentIntents.capture`). Khai `operationId` không phải lý do để thêm method vào SDK.

Tag không khai tay: `v1.routes.ts` gán tag từ prefix, và route không tag bị ẩn khỏi spec — `portal` / `hosted` / `auth` / `webhooks` đăng ký cạnh `v1Routes` chứ không lồng trong nó, nên không gọi `tagRouteByPrefix` và không bao giờ lọt vào. Thêm hay đổi route v1 thì chạy lại script và commit `openapi.json` cùng thay đổi.

## Hook, key và toast sống trong SDK

`react/react-query-convention.md` đặt query key factory, hook và plumbing trong app. Ở đây chúng sống trong `@pinstripe/sdk/react`:

- Subject enum là `PinstripeQuerySubjectEnum`, không phải `ReactQuerySubjectEnum`. Subject của bề mặt
  admin là `user`, `account`, `api_key` — truy cập qua `queries.user`, `queries.account`,
  `queries.api_key`, đúng bằng giá trị của member.
- `queries` đến từ `usePinstripeQueries()` chứ không phải một module import — vì `queryFn` cần client, và client là instance của provider.
- Tên hook, hình dạng key và mọi site invalidate `_def` giữ nguyên như rule mô tả.

**Mỗi method của resource phải có ít nhất một hook gọi tới.** `src/react/hook-coverage.test.ts` duyệt
mọi resource của `PinstripeClient` rồi khẳng định điều đó, nên thêm một method mà không thêm hook là
một test đỏ. Danh sách ngoại lệ trong test đó hiện rỗng — mọi method, kể cả `portal.*`, đều có
hook; đừng thêm lại một ngoại lệ thay vì viết hook. App không bao giờ gọi thẳng resource: đường duy
nhất tới dữ liệu là hook. Link tải file (PDF, CSV của portal) là `<a href>` qua BFF, không phải method
SDK.

Hook của bề mặt khách hàng (`portal.*`) sống ở entry riêng `@pinstripe/sdk/react/portal`
(`src/react/portal/`), không nằm trong barrel `src/react/index.ts`. Lý do là hai test đối xứng dưới
đây: admin-ui không bao giờ dùng hook của khách hàng, và `portal-ui` không dùng hook của dashboard.
Key của chúng vẫn đăng ký trong `createPinstripeQueries` dưới subject `PinstripeQuerySubjectEnum.PORTAL`,
nên cả hai entry dùng chung một `PinstripeProvider`.

`useCreatePortalLinkMutation` cũng ở entry portal, không ở barrel chính: `POST /v1/portal/links` chỉ
nhận API key mang `portal.write` (`verifyPortalKeyRequest`), mà cookie session của dashboard **không**
đi qua hook đó — xem [`auth-convention.md`](./auth-convention.md). Admin-ui gọi nó là 404/401,
không bao giờ chạy. Kế toán Vexere mở link cho một nhà xe bằng `billingPortal.sessions.create`
(`POST /v1/billing_portal/sessions`, surface `v1`, quyền `customer.write`), trả đúng URL
`/login/verify?linkKey=…` dùng một lần. Đường gửi email chỉ có ở `portal-ui`, nơi BFF gắn
`PINSTRIPE_PORTAL_API_KEY`. Không thêm lại một nút "tạo link portal" vào admin-ui khi chưa có route v1
gửi email.

Đầu kia của cùng một sợi dây nằm ở `apps/admin-ui/src/hook-usage.test.ts`: nó đọc barrel
`@pinstripe/sdk/react`, lấy mọi export kết thúc bằng `Query` hay `Mutation`, rồi khẳng định mỗi cái
xuất hiện trong ít nhất một file của `apps/admin-ui/src`. **Không có danh sách ngoại lệ** — thêm một
hook mà không có màn dùng tới là một test đỏ, và đó là thứ giữ cho SDK không phình ra một bề mặt không
ai gọi. `usePinstripeClient` / `usePinstripeContext` / `usePinstripeQueries` /
`usePinstripeMutationCallbacks` không nằm trong tập đó vì chúng là plumbing của provider, không phải
hook dữ liệu — hình dạng tên quyết định điều đó, không phải một danh sách.

`apps/portal-ui/src/hook-usage.test.ts` làm đúng việc đó cho barrel `src/react/portal/index.ts`:
mọi hook portal phải có màn dùng tới trong `apps/portal-ui/src`, cũng không có danh sách ngoại lệ.

Toast: một package không import được `sonner`. Mutation hook trong SDK tự invalidate rồi gọi `onMutationError` / `onMutationSuccess` từ provider; app nối `toast` vào đó **một lần** (`apps/admin-ui/src/providers/AdminPinstripeProvider.tsx`). Yêu cầu "đúng một toast entry point" của rule được thoả về mặt cấu trúc, và chuỗi text ở lại trong app — SDK không sở hữu chữ tiếng Việt nào.

`MutationProps<TData>.successMessage` thay `shouldBeSuccessToast`: call site truyền chữ, SDK không biết chữ. Nó nhận `string`, hoặc `(data: TData) => string` khi chữ cần nội dung của kết quả (`Đã phát hành ${invoice.number}.`). Không truyền gì thì không toast — mặc định im lặng, không phải mặc định bật.

Một outcome **không phải lỗi** mà cần báo như lỗi — `paymentIntent.failureMessage` khi PSP từ chối — không thuộc về SDK: hook chỉ invalidate, page tự rẽ nhánh qua `mutate(vars, { onSuccess })`. SDK không được tự dựng một `PinstripeError` cho một response 200.

## `request-composition-convention.md` không còn subject

`apps/admin-ui/src/api/client.ts` đã bị xoá cùng `Request` / `Endpoint` / `Method` / `Params` / `Payload` / `Headers`. Rule đó không còn quản file nào trong repo này.

SDK dùng options-object client — đúng nhánh mà §Scope của chính rule đó chừa ra (_"Does not apply to a project whose client takes an options object"_). Không retrofit setter composition vào SDK.

## Env

SDK chỉ biết một họ tên, và chỉ đọc nó ở `src/node/create-pinstripe-client.ts`:

```
PINSTRIPE_API_URL
PINSTRIPE_SECRET_API_KEY
PINSTRIPE_MAX_RETRIES, PINSTRIPE_TIMEOUT_MS
```

`PINSTRIPE_PORTAL_API_KEY` không thuộc SDK: nó là key scope `portal` mà lớp BFF của `portal-ui`
(`apps/portal-ui/src/libs/portal-bff.ts`) gắn vào hai route đăng nhập `/v1/portal/links` và
`/v1/portal/sessions`. File đó là proxy phía server có allowlist, không phải HTTP client thứ hai —
trình duyệt vẫn chỉ đi qua `PinstripeClient({ baseUrl: '/bff' })` và hook của SDK. Xem ADR 0026.

`SECRET_API_KEY` / `PORTAL_API_KEY` (không prefix) là env **của server API** — `packages/core/src/config/env.schema.ts` validate chúng để so khớp key đến. Hai họ tên khác vai, đừng gộp và đừng cho SDK một fallback chain.

## NEVER Do

- Dựng lại một `api/` folder, một HTTP client thứ hai, hay một request function viết tay trong app tiêu thụ SDK.
- Lặp entity trong method name của một resource SDK (`findCustomers`, `getCustomer`) — receiver đã mang nó; hoặc bỏ entity khỏi tên ở repository / service, nơi kit vẫn bắt buộc có.
- Dùng `list` hay `retrieve` ở bất kỳ đâu trong repo — hai verb đó không còn là verb của codebase này.
- Thêm method cho một route không tồn tại chỉ để bề mặt trông đầy đủ.
- Dựng lại `AdminNamespace`, `_adminTransport`, `adminApiKey` hay `PINSTRIPE_ADMIN_API_KEY` — SDK có
  đúng một transport; hay cho `account.get` nhận một id, nó đọc chính session đang gọi.
- Khai báo domain type trong SDK — chúng đi qua `src/types/contracts.types.ts`, bằng `export type`, từ `@pinstripe/core/contracts`.
- Import `@pinstripe/core` như value ở bất kỳ đâu trong `packages/sdk/src` — nó sẽ vào bundle và `src/bundle.test.ts` sẽ fail.
- Import một `node:` builtin ngoài `src/node/**`.
- Import `sonner` hay bất kỳ toast library nào vào SDK — dùng `onMutationError` / `onMutationSuccess` của provider.
- Đọc `process.env` ngoài `src/node/create-pinstripe-client.ts`.
- Đặt `splitting: false` trong `tsup.config.ts` — `instanceof PinstripeError` sẽ sai giữa các entry.
