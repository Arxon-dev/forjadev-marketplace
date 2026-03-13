interface Props {
  params: { slug: string };
}

export default function ProductDetailPage({ params }: Props) {
  return (
    <main className="container-shell py-16">
      <h1 className="text-3xl font-bold text-white">Producto: {params.slug}</h1>
      <p className="mt-3 text-[var(--text-soft)]">
        Aquí irá la ficha completa del producto.
      </p>
    </main>
  );
}
