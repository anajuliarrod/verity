import Link from "next/link";
import { VerityMark } from "@/components/brand/VerityMark";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-verity-bg px-6 text-center">
      <VerityMark size={48} />
      <h1 className="font-display text-3xl font-bold text-verity-ink">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-verity-ink-muted">
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Link href="/">
        <Button variant="primary">Voltar para o início</Button>
      </Link>
    </main>
  );
}
