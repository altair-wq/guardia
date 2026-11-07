import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-4xl font-bold">Acá no hay nada.</h1>
      <Link href="/" className="mt-4 inline-flex min-h-[44px] items-center font-semibold text-pass-fg underline underline-offset-4">
        Volver al feed
      </Link>
    </main>
  );
}
