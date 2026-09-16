export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Pinstripe Portal</h1>
      <p className="text-sm text-slate-500">
        Trang tự phục vụ của khách hàng: gói đang dùng và hóa đơn. Mở theo đường dẫn{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
          /customers/&lt;customerId&gt;
        </code>
        .
      </p>
      <p className="text-sm text-slate-500">
        Portal gọi billing API ở phía server bằng secret key, nên key không bao giờ xuống trình
        duyệt. Nhưng <strong>chưa có đăng nhập khách hàng</strong> — ai biết customerId là xem được.
      </p>
    </main>
  );
}
