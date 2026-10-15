import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
        <p className="text-muted-foreground">
          İstediğiniz adres yok veya bu kurum için kapalı bir analiz olabilir.
        </p>
        <Link className="text-primary underline" href="/panel">
          Panele dön
        </Link>
      </div>
    </main>
  );
}
