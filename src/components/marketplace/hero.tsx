import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="container-shell py-20">
      <div className="max-w-3xl">
        <p className="mb-4 text-sm font-medium text-[var(--primary)]">
          Marketplace premium para creadores
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
          Publica, vende y descarga plugins, mapas y herramientas para servidores.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-[var(--text-soft)] md:text-lg">
          Empieza con Rust y prepara la plataforma para escalar a mas juegos y categorias.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/products">
            <Button>Explorar productos</Button>
          </Link>
          <Link href="/seller">
            <Button variant="secondary">Quiero vender</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
