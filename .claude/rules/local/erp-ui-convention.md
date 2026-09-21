# ERP UI Convention

`apps/erp-ui` là dashboard vận hành: HeroUI v3, đăng nhập thật bằng better-auth, layout và tính năng lấy từ mockup `vxr-erp-platform`, còn giao diện là theme mặc định của HeroUI. Không ghi lại chỗ đó thì agent tiếp theo sẽ dựng lại một UI kit tự viết, tự tạo một HTTP client thứ hai để lấy session, hoặc chép lại màu ERP vào theme — và cả ba đều phá đúng thứ phase 29 vừa dựng.

## Scope

Applies to `apps/erp-ui/**`.

Does **not** apply to:

- `apps/billing-portal-ui` — bề mặt của khách hàng, `portal.*`, luật riêng.
- `packages/sdk/**` — hook, key và toast của SDK do [`sdk-convention.md`](./sdk-convention.md) quản.
- Đường đăng nhập phía server (`/v1/auth/*`, authorization) — [`auth-convention.md`](./auth-convention.md).

## Cấu trúc thư mục

`src` chia theo tầm dùng lại, không theo loại file. Đặt một file theo câu hỏi "ai khác cần nó?":

```
src/
├── main.tsx              import globals.css, render <ProviderRegistry />
├── styles/globals.css
├── providers/            ProviderRegistry, QueryProvider, AdminVxrErpProvider, RoutesProvider, AdminAuthProvider
├── libs/                 hạ tầng không phải UI: auth-client, permissions, toast, cn
├── common/               không biết entity nào, không biết feature nào
│   ├── components/       DataTable, RowActionButton, PageCard, StatGrid, EntityDrawer, DrawerSection…; FormField/Render*Field
│   ├── constants/        navigation (NavigationGroupEnum, NavigationItem)
│   ├── types/            feature-definition (FeatureDefinition)
│   ├── forms/  hooks/  utils/
└── features/
    ├── auth/             đăng nhập + khung app + ghép các feature khác
    │   ├── features.ts   ERP_FEATURES, NAVIGATION_GROUPS, FEATURE_ROUTES, hasReportRange
    │   ├── components/   AppSidebar, AppTopbar, NotificationButton, RequireSession
    │   ├── routes/       paths.ts (authPaths), def.tsx (authRouteDefs)
    │   └── views/{layouts,pages}/   AppLayout, AuthPage
    └── <feature>/        một feature cho mỗi module: billing, admin (bề mặt platform), sau này crm
        ├── index.ts      <feature>Feature: FeatureDefinition — điểm export duy nhất
        ├── components/   form của từng entity (CustomerForm, UserForm…)
        ├── constants/    navigation (<FEATURE>_NAVIGATION_ITEMS), tabs
        ├── routes/       paths.ts (<feature>Paths), def.tsx (<feature>RouteDefs: RouteObject[])
        └── views/pages/
```

- Mỗi feature export đúng một `FeatureDefinition` — `routes`, `navigationItems`, `reportRangePaths` — từ `index.ts`. `features/auth/features.ts` liệt kê `ERP_FEATURES` rồi ghép: route thành con của `RequireSession` → `AppLayout`, mục menu thành nhóm theo thứ tự của `NavigationGroupEnum`, path báo cáo thành `hasReportRange`. Thêm một feature là thêm một dòng vào `ERP_FEATURES`.
- Thứ tự trong `ERP_FEATURES` là thứ tự mục **bên trong** một nhóm menu; thứ tự nhóm do `NavigationGroupEnum` quyết.
- Route khai trong `features/<feature>/routes/def.tsx`, path lấy từ `<feature>Paths`; `RoutesProvider` dựng `createBrowserRouter` từ `authRouteDefs`. Không có `App.tsx`, không `<Routes>` JSX.
- Hướng import: `features/auth` là feature **duy nhất** được import feature khác (qua `index.ts`), vì nó ghép chúng. Mọi feature khác không import `features/auth` và không import nhau; `common/` không import feature nào. `eslint.config.js` chặn cả ba chiều — thêm feature mới thì thêm tên nó vào danh sách feature trong config đó.
- Một component chỉ có nghĩa với một entity (`CustomerForm`, `UserRoleChips`) nằm trong feature sở hữu entity đó, không nằm trong `common/`. Màn của platform (user, role, API key, webhook, settings) thuộc `features/admin`.
- Alias là `@common/*`, `@features/*`, `@providers/*`, `@libs/*` — không có `@components`, `@pages`, `@lib`.

## UI kit là HeroUI, không có kit thứ hai

Mọi control **và mọi surface** lấy từ `@heroui/react`. Không dựng lại `src/common/components/ui/*`, không bọc một `<button className="...">` tự viết khi `Button` đã có, và không vẽ khung bằng `div` + `border rounded bg-surface` khi `Card` đã có. Khối cần khung là `Card` (ô trong khối là `Card variant="secondary"`), tab là `Tabs variant="secondary"`, thông báo là `Alert`, nhóm lựa chọn là `ToggleButtonGroup`. Component dùng chung trong `src/common/components` chỉ ghép các mảnh đó theo layout của màn — không tự vẽ lại chúng.

```tsx
// CORRECT
<Card>
  <Card.Header><Card.Description>{label}</Card.Description></Card.Header>
  <Card.Content>{value}</Card.Content>
</Card>

// WRONG — tự vẽ lại Card
<div className="flex flex-col gap-1 rounded-md border bg-surface p-4">…</div>
```

Mọi form trong drawer — tạo lẫn sửa — nằm trong một `DrawerSection`, và form không có khung riêng. Field xếp dọc, mỗi field một dòng, rộng hết form: thẻ `<form>` là `flex flex-col gap-4`, và không truyền class độ rộng cố định (`w-28`, `w-56`…) cho `Render*Field`. `Button` của HeroUI đã `w-fit` nên giữ kích thước tự nhiên.

```tsx
// CORRECT
<EntityDrawer title="Tạo customer" …>
  <DrawerSection title="Thông tin khách hàng">
    <CustomerForm … />
  </DrawerSection>
</EntityDrawer>

// WRONG — form nằm thẳng trong drawer, field xếp ngang
<EntityDrawer title="Tạo customer" …>
  <form className="flex flex-wrap items-end gap-4">…</form>
</EntityDrawer>
```

HeroUI v3 dựng trên react-aria: `Button` nhận `onPress` / `isDisabled` (không phải `onClick` / `disabled`), `TextField` / `Select` nhận `value` / `selectedKey` đã parse sẵn chứ không phải `ChangeEvent`.

```tsx
// CORRECT
<Button variant="ghost" isDisabled={isBusy} onPress={handleOnVoid}>Hủy</Button>

// WRONG — prop của DOM, react-aria bỏ qua onClick
<Button onClick={handleOnVoid} disabled={isBusy}>Hủy</Button>
```

`react-aria`, `react-aria-components`, `@react-aria/*` là peer của `@heroui/react`, và **không** nằm trong `package.json` của erp-ui: `auto-install-peers=true` trong `.npmrc` cài chúng cho HeroUI. `src` không import chúng — `eslint.config.js` chặn bằng `no-restricted-imports`. Một type như `Key` lấy từ `react`. Đừng thêm lại chúng vào `dependencies`, và đừng tắt `auto-install-peers`.

### Bảng đi qua `DataTable`, dựng trên TanStack Table

`src/common/components/DataTable.tsx` là chỗ duy nhất dùng `Table` của HeroUI. TanStack Table v9 (`useTable`, `tableFeatures`, `createColumnHelper().display`) giữ column def, row model và row id; `Table.*` của HeroUI chỉ render — đúng mẫu TanStack trong tài liệu HeroUI. Không bật sort / pagination của TanStack: phân trang là cursor, qua `useCursorPagination`.

`Table.Cell` **không bao giờ** nhận `id`, chỉ `key={cell.id}`. react-aria dùng `id` làm key trong một `keyMap` chung cho cả bảng, nên cell mang id trùng column ghi đè column và bảng throw `Cell count must match column count. Found N cells and 0 columns.` — chính lỗi làm trắng `/admin/roles` và mọi drawer mở trên list.

```tsx
// CORRECT
<Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>

// WRONG — id trùng column.key, cell đè column trong keyMap
<Table.Cell key={column.key} id={column.key}>{column.renderCell(row)}</Table.Cell>
```

## Mockup quyết định layout, HeroUI quyết định giao diện

Từ mockup chỉ lấy layout, tính năng và vị trí component: shell sidebar + top bar, công thức một màn, drawer bên phải. Màu, bo góc, viền, font và shadow là theme mặc định của HeroUI. `src/styles/globals.css` **không** override biến theme của HeroUI (`--accent`, `--background`, `--surface`, `--border`, `--radius`, `--field-*`, `--font-sans`…) — override một biến là kéo một field, một popover ra khỏi phần còn lại của kit, và dark mode của HeroUI mất theo.

```css
/* CORRECT — kích thước shell; màu phụ, nếu HeroUI chưa có, dẫn xuất từ token của nó */
--app-sidebar-width: 248px;
--app-label: color-mix(in oklab, var(--foreground) 70%, transparent);

/* WRONG — chép token của mockup đè lên theme */
--accent: #006ad9;
--field-radius: 0.375rem;
```

Token riêng của shell khai trong `:root` với prefix `--app-*` rồi xuất qua `@theme inline` để thành utility (`w-sidebar`, `h-topbar`, `text-app-label`). Kích thước là giá trị thật; màu thì chỉ dẫn xuất từ biến của HeroUI, không viết hex. Không đặt alias cho một màu HeroUI đã có tên — dùng thẳng `border-separator`, `text-muted`, `bg-surface`, `text-accent`. Không viết hex vào class và không import file nào từ repo mockup.

Scrollbar style **một lần, toàn cục** trong `src/styles/globals.css` qua `--app-scrollbar-*` (thumb pill dẫn xuất từ `--foreground` — nhạt khi nghỉ, đậm khi hover — không track, không nút mũi tên). Không style scrollbar riêng trong component. `scrollbar-width` / `scrollbar-color` nằm trong `@supports not selector(::-webkit-scrollbar)` và phải ở yên đó: Chrome ≥121 thấy hai thuộc tính đó là bỏ toàn bộ `::-webkit-scrollbar`, và thumb pill mất.

## Công thức một màn

Một màn đi theo đúng thứ tự này, và mỗi khối là một component dùng chung:

1. `PageCard` — tab (nếu có) ở đầu trang, **phía trên** `Card` tiêu đề; `Card` chứa tiêu đề, phụ đề, slot action; nội dung màn nằm dưới nó. Tab không nằm trong `Card`.
2. `StatGrid` + `StatItem` — bốn `Card` tổng quan, nhãn uppercase, số lớn.
3. `FilterBar` — ô tìm, select, đếm "N mục"; truyền vào `DataTable` qua prop `toolbar`. `DataTable` đặt nó **phía trên** khung bảng, trên nền trang — không bao giờ bên trong `Table`. Ô tìm và mọi `FilterSelect` mang `Label` hiển thị phía trên control; ô tìm giãn hết chỗ còn lại.
4. `DataTable` — `Table` variant mặc định (`primary`) **chính là** khung: nền xám bọc header, thân bảng trắng và `Table.Footer`. Root mang `shadow-surface` — cùng shadow với `Card` — để bảng nổi khối giống `DrawerSection`. Không bọc nó trong `Card` hay `div` có viền, và không override CSS của `.table-*`. Phân trang cursor từ `ListResponse.hasMore` qua `Pagination` của HeroUI đặt trong `Table.Footer` (chỉ Summary + Previous/Next — cursor không có tổng số trang); click cả dòng để mở drawer. Page không bọc thêm khung quanh nó.
5. `EntityDrawer` — tạo và sửa **luôn** trong drawer phải; không có trang form riêng. Drawer rộng một phần ba màn hình cộng 200px (`calc(max(33vw, 28rem) + 200px)`). Độ rộng đặt trên `Drawer.Dialog`, không bao giờ trên `Drawer.Content` — `Content` là lớp định vị phủ cả màn, đặt width lên nó là drawer lệch vào giữa.

`StatusChip` là chỗ duy nhất ánh xạ trạng thái sang màu. Xoá và mọi hành động không đảo được hỏi qua `ConfirmDialog` — không bao giờ `window.confirm`.

Cột thao tác của một bảng khai `align: 'end'` và mỗi hành động là một `RowActionButton`: nút icon (`@gravity-ui/icons`) với tooltip và `aria-label` là chữ của hành động; xoá, thu hồi, vô hiệu hoá mang `isDanger`. Không đặt `Button` chữ trong ô.

```tsx
// CORRECT
{ key: 'actions', label: 'Thao tác', align: 'end', renderCell: (row) => {
  return <RowActionButton label="Xoá" icon={<TrashBin />} isDanger onPress={…} />;
} }

// WRONG — nút chữ, cột căn trái
{ key: 'actions', label: 'Thao tác', renderCell: (row) => {
  return <Button size="sm" variant="ghost" onPress={…}>Xoá</Button>;
} }
```

Bên trong drawer: `DrawerSection` cho mỗi khối, `DetailList` cho lưới nhãn/giá trị, `DrawerTabs` khi một drawer có nhiều phần. Select đứng ngoài form đi qua `FilterSelect`.

Một secret chỉ server trả **một lần** — `apiKey.token`, `webhookEndpoint.secret` — không bao giờ đi vào query cache để đọc lại: nó sống trong state của chính page đã tạo ra nó, hiện kèm nút sao chép, và bị xoá khi drawer đóng. Đừng thêm một hook đọc lại nó; route không có.

Hai bề mặt của nhóm Admin không có nút xoá, vì không có route xoá: user hạ quyền hay vô hiệu hoá qua `useUpdateUserMutation`, và `/admin/roles` chỉ đọc vì `ROLE_PERMISSIONS` là hằng số trong `@vxrerp/platform`. Lỗi "admin active cuối cùng" đến từ server và hiện qua toast của provider — đừng đoán trước luật đó ở client.

## Tab là route con, drawer là param

Tab của một màn là **route con**, không phải state: `PageTabs` render `Tabs` của HeroUI (variant mặc định, `w-fit`) với `selectedKey` suy ra từ `pathname` và `navigate(to)` khi đổi tab, và mỗi tab có URL riêng (`/catalog/products`, `/subscriptions/usage`). Mỗi tab là một Page riêng giữ query và mutation của chính nó — đó là thứ giữ [`component-convention.md`](../agentkit/profiles/react/component-convention.md) đúng khi một màn có bốn tab.

Drawer chi tiết của **entity chính** trên màn mở bằng route param (`/customers/:customerId`) để deep-link được; entity phụ trong drawer (tax ID, promotion code, discount) dùng state cục bộ. Một path tĩnh và một path động không bao giờ tranh nhau cùng một đoạn: `/subscriptions` redirect sang `/subscriptions/list`, và id nằm dưới tab của nó.

Một màn **không** có tab thì không dựng `PageTabs` cho nó: `/api-keys`, `/test-clocks`, `/admin/users`, `/admin/roles` là màn phẳng, id nằm ngay dưới path của màn (`/test-clocks/:testClockId`, `/admin/users/:userId`).

## Filter và cursor sống trên URL

Mọi filter của một màn list — select, ô tìm, cursor phân trang — là search param, qua `nuqs` theo
[`search-params-convention.md`](../agentkit/profiles/nuqs/search-params-convention.md). Không `useState`
cho filter: reload phải giữ nguyên màn, và URL phải copy gửi được. `NuqsAdapter` mount **một lần**, ở
root route của `src/providers/RoutesProvider.tsx` (adapter dựng trên `useNavigate` + `useSearchParams`
nên phải nằm trong data router).

Parser của mỗi màn nằm cạnh page trong `{entity}.search-params.ts` (`SubscriptionsPage/subscriptions.search-params.ts`),
không nằm trong `common/` — `common/` không được biết entity. Chỉ khai `createSerializer` khi có nơi
dùng thật; hiện chỉ `InvoicesPage` cần, để dựng href cho tab.

```tsx
// CORRECT — một hành động, một lần ghi; reset cursor là một key trong cùng object
const [search, setSearch] = useQueryStates(subscriptionSearchParams);

const handleOnStatusSelect = (value: string | null) => {
  const status = isNull(value) ? null : subscriptionSearchParams.status.parse(value);

  setSearch({ status, after: null });
};

// WRONG — hai setter cho một hành động, và URL trung gian sai
setStatusFilter(value);
resetPage();
```

Filter có thể vắng mặt thì **không** `.withDefault()`: đọc ra `null`, xoá bằng ghi `null`, key rời khỏi
URL. Không sentinel `'all'` / `''`. `FilterSelect` nhận `string | null` và có `Select.ClearButton` —
đó là đường về trạng thái không lọc.

Cursor phân trang là param `after`, cùng tên với field của `Find*Query`, khai một lần ở
`cursorSearchParams` cạnh `src/common/hooks/useCursorPagination.ts`. Hook **nhận** param chứ không sở
hữu (nếu nó tự `useQueryState` thì mỗi lần đổi filter là hai lần ghi), và chỉ giữ lịch sử cursor trong
state cho nút Trước: `useCursorPagination({ after, onPageChange })` → `{ hasPrevious, advancePage, revertPage }`.
Sau reload nút Trước bị disable — đó là đánh đổi có chủ ý, không phải bug. Đừng tự giữ mảng cursor
trong page, và đừng thêm lại `resetPage`.

`search` đi vào query qua `toQuery()` (`src/common/utils/search-params.ts`), thứ bỏ mọi key `null` vì
`Find*Query` là `Type.Optional` và `additionalProperties: false`. Param không phải field DTO —
`q` của `/admin/users`, thứ lọc client-side — phải destructure ra trước khi spread.

Ô tìm debounce **tại lần ghi** (`limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS)`), không mirror sang
`useState` và không bọc hook debounce bên ngoài: nuqs trả giá trị optimistic ngay nên input không khựng.
Xoá trắng thì bỏ debounce để param rời URL tức thì. Debounce chỉ làm dịu thanh địa chỉ — query vẫn
refetch mỗi phím gõ.

Mở và đóng drawer đi qua `useSearchPreservingNavigate()`, không `useNavigate()` trực tiếp:
`navigate(path)` trần nuốt mất query string và làm rơi filter người dùng vừa đặt. `PageTabs` thì
**vẫn** bỏ query khi đổi màn — mỗi màn một tập parser riêng; ngoại lệ duy nhất là `InvoicesPage`, nơi
tab là cùng một màn khác path segment nên href dựng bằng `serializeInvoiceSearch`.

## Khoảng thời gian báo cáo là ngoại lệ duy nhất, và nó ở trong store

Khoảng thời gian của các màn báo cáo **không** phải search param. Nó sống trong
`useReportRangeStore` (`src/libs/report-range.store.ts`, zustand + `persist` vào localStorage dưới
key `vxrerp-report-range`), vì nó là trạng thái toàn cục chứ không phải filter của một màn: nó
phải sống sót qua mọi kiểu điều hướng, mà `PageTabs` cố tình bỏ query khi đổi màn và picker thì nằm
trong `AppTopbar`, tức ngoài `<Outlet />`. Đây là ngoại lệ **duy nhất** — mọi filter của một màn
list vẫn bắt buộc đi qua nuqs theo mục trên.

Store giữ **preset**, không giữ timestamp: `{ preset, fromDate, toDate }` với `fromDate` / `toDate`
là `yyyy-MM-dd` và chỉ có nghĩa khi preset là `CUSTOM`. Persist một `windowStart` / `windowEnd`
tuyệt đối thì hôm sau mở lại vẫn là cửa sổ của hôm qua, và "30 ngày gần nhất" thành sai.

`buildReportWindow` (`src/common/utils/report-range.ts`) là hàm thuần quy preset ra
`{ windowStart, windowEnd }`, neo vào **đầu ngày theo giờ Việt Nam** qua `@internationalized/date`,
không phải `Date.now()`: giá trị đứng yên suốt cả ngày nên query key của React Query không đổi mỗi
lần mount, và `windowEnd` là đầu ngày kế tiếp — biên mở, khớp `gte(start)` / `lt(end)` của
`reporting.repository.ts`. Page đọc qua `useReportWindow()` / `useReportRangeLabel()`, không tự dựng
cửa sổ.

`ReportRangePicker` dùng thẳng `Select` + `DateRangePicker` của HeroUI chứ không qua `FilterSelect`:
yêu cầu "`FilterSelect` phải có `Label` hiển thị" là luật của `FilterBar` trên màn list, còn đây là
control trong top bar cao cố định (`h-topbar`) — nhãn đi bằng `aria-label`.

Picker chỉ hiện trên route thực sự tiêu thụ khoảng thời gian, theo `hasReportRange()`
(`src/features/auth/features.ts`), ghép từ `reportRangePaths` của từng feature. Hiện nó trên một màn không dùng tới là nói dối
người dùng; danh sách đó dài ra khi thêm màn tiêu thụ.

## Field đi qua `Controller`

Form dùng react-hook-form theo [`form-convention.md`](../agentkit/profiles/react/form-convention.md); field render qua `src/common/components/FormField/Render{Text,Select,Number,Date,Checkbox,CheckboxGroup}Field`, mỗi cái bọc `Controller` quanh một control HeroUI. Không `form.register` trên control của HeroUI — nó không nhận `ref` + `onChange` kiểu DOM.

`RenderCheckboxGroupField` là field của một **mảng giá trị đóng** — `enabledEvents` của webhook endpoint, `permissions` của API key. Một tập nhiều lựa chọn không đi qua `Select`: HeroUI v3 `Select` là single-select, và ghép nhiều `RenderCheckboxField` boolean thì form data không còn là mảng mà payload cần.

`RenderSelectField` quy đổi giá trị rỗng sang một key nội bộ, vì collection của react-aria không nhận `id=""`. Một select ngoài form thì bỏ hẳn option rỗng và dùng `placeholder` của `Select`.

## `better-auth` chỉ ở `src/libs/auth-client.ts`

Đúng một file được import `better-auth*`, và `eslint.config.js` chặn phần còn lại bằng `no-restricted-imports`. File đó dựng `createAuthClient` với `basePath: '/v1/auth'` và một `customFetchImpl` bóc envelope lỗi của repo (`{ error: { code, message } }`) thành `{ code, message }` — không có nó thì better-auth-ui đọc `error.code` ra `undefined` và mọi lỗi đăng nhập rơi về một thông báo chung chung.

`@better-auth-ui/heroui` và `@better-auth-ui/react` **không** bị chặn: chúng là UI, không phải HTTP client thứ hai. Không dùng `adminClient()` hay plugin `admin` — quản trị user đi qua SDK `users`.

`AuthProvider` được bọc trong `src/providers/AdminAuthProvider.tsx` để lấy `navigate` của react-router; thứ tự provider là `QueryProvider` → `AdminVxrErpProvider` → `RoutesProvider` (router) → `AdminAuthProvider`. `AdminAuthProvider` cần `useNavigate`, nên nó là element của root route trong `RoutesProvider`, bọc `<Outlet />` — không đặt nó trong `ProviderRegistry`. Sign-up không tồn tại ở server, nên link "Sign up" của `SignIn` bị giấu bằng CSS trên `.auth-view` — đừng gỡ khối đó ra khỏi `index.css`.

## Dữ liệu đi qua hook của SDK

`VxrErpClient` trong `src/providers/AdminVxrErpProvider.tsx` được dựng **không có key**: trình duyệt đi bằng cookie same-origin. `vite.config.ts` chỉ proxy `/v1` với `changeOrigin` — mọi surface của API nay nằm dưới đó, kể cả `/v1/auth` — và không chèn `VXRERP_*_API_KEY` vào header — một bản build ra khỏi `vite dev` phải xác thực được bằng đúng thứ nó có.

Component không gọi thẳng resource: mọi read/write qua hook của `@vxrerp/sdk/react`.

## Quyền ẩn menu, server chặn thật

`src/libs/permissions.ts` cho `usePermissions()` và `useCan(permission)`, cả hai đọc `useAccountQuery`. Sidebar ẩn mục người dùng không có quyền đọc. Đó là ergonomics, **không** phải bảo mật — server vẫn là nơi chặn, theo [`auth-convention.md`](./auth-convention.md).

## Định dạng

Tiền và ngày đi qua `src/common/utils/format.ts`: `formatCurrency(minorAmount, currency)` chia theo số chữ số thập phân của chính đồng tiền đó, `formatDate(isoDate)` trả `dd/MM/yyyy` theo giờ Việt Nam. Không `toLocaleString` rải rác trong component mới.

## NEVER Do

- Dựng lại một UI kit tự viết trong `src/common/components/ui/*`, hay bọc tay một control HeroUI đã có.
- Vẽ khung bằng `div` + `border rounded bg-surface` thay vì `Card`, hay tự làm tab bằng `<button>` thay vì `Tabs`.
- Đặt độ rộng hay nền lên `Drawer.Content` — chúng thuộc về `Drawer.Dialog`.
- Đặt alias `--app-*` cho một màu HeroUI đã có tên.
- Dùng `onClick` / `disabled` trên `Button` của HeroUI — là `onPress` / `isDisabled`.
- Import `react-aria*`, `@react-aria/*` hay `@react-stately/*` trong `src`, hay thêm chúng lại vào `package.json` — chúng là peer của HeroUI, pnpm tự cài.
- Dựng bảng bằng `Table` của HeroUI ngoài `DataTable`, hay đặt `id` trên `Table.Cell`.
- Render toolbar bên trong `Table`, hay dùng `FilterSelect` / ô tìm không có `Label` hiển thị.
- Đặt nút chữ trong cột thao tác thay vì `RowActionButton`, hay để cột thao tác không có `align: 'end'`.
- Override biến theme của HeroUI trong `src/styles/globals.css`, hay viết hex vào class Tailwind hoặc vào `--app-*`.
- Import file từ repo `vxr-erp-platform`.
- Import `better-auth*` ở bất kỳ file nào ngoài `src/libs/auth-client.ts`, hay dùng `adminClient()` / plugin `admin`.
- Bỏ `customFetchImpl` bóc envelope lỗi ra khỏi auth client.
- Chèn API key vào proxy của `vite.config.ts`, hay đưa key vào `VxrErpClient` của trình duyệt.
- Gọi thẳng resource của SDK từ component — đi qua hook.
- Coi `useCan` là lớp bảo mật.
- Dựng một trang form riêng cho tạo / sửa thay vì drawer, hay xác nhận xoá bằng `window.confirm`.
- Dùng `form.register` trên control của HeroUI thay vì `Render*Field`.
- Giữ tab của một màn bằng state thay vì route con, hay mở drawer của entity chính mà không có route param.
- Tự giữ mảng cursor trong page thay vì `useCursorPagination`, hay thêm lại `resetPage` vào hook đó.
- Giữ filter hay cursor của một màn list trong `useState` thay vì search param.
- Chuyển khoảng thời gian báo cáo sang search param, hay dựng một store thứ hai cho một filter khác
  — `useReportRangeStore` là ngoại lệ duy nhất.
- Persist `windowStart` / `windowEnd` tuyệt đối thay cho preset, hay neo cửa sổ vào `Date.now()`
  thay vì đầu ngày giờ Việt Nam.
- Tự dựng cửa sổ thời gian trong một page thay vì gọi `useReportWindow()`.
- Cho `useCursorPagination` tự sở hữu param `after` — nó nhận từ page, nếu không mỗi lần đổi filter là hai lần ghi.
- Ghi filter rồi reset cursor bằng hai setter — một hành động là một `setSearch`.
- Dùng sentinel `'all'` / `''` cho một filter vắng mặt, hay `.withDefault()` cho nó.
- Khai parser filter trong `common/`, hay khai `createSerializer` mà không có nơi dùng.
- Mirror giá trị ô tìm sang `useState` để debounce thay vì `limitUrlUpdates` tại lần ghi.
- Mở hay đóng drawer bằng `useNavigate()` trần — nó nuốt query string; dùng `useSearchPreservingNavigate()`.
- Ghép nhiều checkbox boolean cho một field mảng thay vì `RenderCheckboxGroupField`.
- Đưa một secret chỉ trả một lần vào query cache, hay thêm hook đọc lại nó.
- Thêm nút xoá user, hay cho `/admin/roles` sửa được `ROLE_PERMISSIONS`.
- Dựng `PageTabs` cho một màn chỉ có một bề mặt.
- Đặt component đặc thù một entity vào `common/`, hay cho `common/` import từ `features/`.
- Import một feature từ feature khác, hay import `features/auth` từ một feature — chỉ `features/auth` ghép feature.
- Đăng ký route hay mục menu của một feature ở ngoài `FeatureDefinition` của chính nó.
- Dựng lại `App.tsx` / `<Routes>` JSX, hay viết path route thành chuỗi trong `def.tsx` thay vì lấy từ `<feature>Paths`.
