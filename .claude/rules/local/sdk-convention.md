# SDK Convention

`@pinstripe/sdk` là public API của sản phẩm này, nên method name của nó là thứ khách hàng đọc — không phải thứ codebase tự chọn. Bốn rule của kit được viết cho một app tự gọi API bằng tay; app ở đây không còn làm thế nữa, và không ghi lại chỗ lệch thì agent tiếp theo sẽ "sửa" SDK về đúng kit và làm hỏng bề mặt công khai.

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

## Method name theo bề mặt Stripe

Trong `packages/sdk/src/resources/**` **và chỉ ở đó**, method name lấy theo bề mặt Stripe:

`list`, `retrieve`, `create`, `update`, `delete`, `cancel`, `void`, `finalize`, `pay`, `confirm`, `advance`, `reverse`.

Đây là chỗ lệch với `core/naming-convention.md` §Verbs (`get` throws / `find` returns null) và với §"Avoid → use instead" (`list*`). Lý do: tên này là API công khai, khách hàng đã biết nó từ Stripe, và đổi nó sau là breaking change. Mọi nơi khác trong repo giữ nguyên verb của kit — repository vẫn `find<Entity>`, service vẫn `get<Entity>` / `find<Entities>`.

`eslint-config/sdk.js` tắt đúng một selector (`list|fetch|load|save|insert|purge|destroy` + chữ hoa) cho `src/resources/**`. Mọi selector khác của agentkit vẫn bật ở đó.

```ts
// CORRECT — trong packages/sdk/src/resources/
pinstripe.customers.list(query);
pinstripe.customers.retrieve(customerId);
pinstripe.invoices.finalize(invoiceId);

// WRONG — ở đây; kit verb không dùng cho bề mặt công khai
pinstripe.customers.findCustomers(query);
pinstripe.customers.getCustomer(customerId);

// WRONG — trong packages/core/src/repositories/; kit verb vẫn là luật ở đó
customerRepository.list(filters);
```

Không tự chế method cho route không tồn tại. `entitlements` chỉ có `list`, `products` không có `delete`, `creditNotes` không có `void` — bề mặt khuyết là hình dạng thật của API, không phải SDK làm dở.

## Hook, key và toast sống trong SDK

`react/react-query-convention.md` đặt query key factory, hook và plumbing trong app. Ở đây chúng sống trong `@pinstripe/sdk/react`:

- Subject enum là `PinstripeQuerySubjectEnum`, không phải `ReactQuerySubjectEnum`.
- `queries` đến từ `usePinstripeQueries()` chứ không phải một module import — vì `queryFn` cần client, và client là instance của provider.
- Tên hook, hình dạng key và mọi site invalidate `_def` giữ nguyên như rule mô tả.

Toast: một package không import được `sonner`. Mutation hook trong SDK tự invalidate rồi gọi `onMutationError` / `onMutationSuccess` từ provider; app nối `toast` vào đó **một lần** (`apps/admin-ui/src/lib/pinstripe.tsx`). Yêu cầu "đúng một toast entry point" của rule được thoả về mặt cấu trúc, và chuỗi text ở lại trong app — SDK không sở hữu chữ tiếng Việt nào.

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
PINSTRIPE_ADMIN_API_KEY
PINSTRIPE_MAX_RETRIES, PINSTRIPE_TIMEOUT_MS
```

`SECRET_API_KEY` / `ADMIN_API_KEY` (không prefix) là env **của server API** — `packages/core/src/config/env.schema.ts` validate chúng để so khớp key đến. Hai họ tên khác vai, đừng gộp và đừng cho SDK một fallback chain.

## NEVER Do

- Dựng lại một `api/` folder, một HTTP client thứ hai, hay một request function viết tay trong app tiêu thụ SDK.
- Dùng kit verb (`find`, `get`) cho method của một resource trong SDK, hoặc dùng verb Stripe (`list`, `retrieve`) ở bất kỳ layer nào khác của repo.
- Thêm method cho một route không tồn tại chỉ để bề mặt trông đầy đủ.
- Khai báo domain type trong SDK — chúng đi qua `src/types/contracts.types.ts`, bằng `export type`, từ `@pinstripe/core/contracts`.
- Import `@pinstripe/core` như value ở bất kỳ đâu trong `packages/sdk/src` — nó sẽ vào bundle và `src/bundle.test.ts` sẽ fail.
- Import một `node:` builtin ngoài `src/node/**`.
- Import `sonner` hay bất kỳ toast library nào vào SDK — dùng `onMutationError` / `onMutationSuccess` của provider.
- Đọc `process.env` ngoài `src/node/create-pinstripe-client.ts`.
- Đặt `splitting: false` trong `tsup.config.ts` — `instanceof PinstripeError` sẽ sai giữa các entry.
