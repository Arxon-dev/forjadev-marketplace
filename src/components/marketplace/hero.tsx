import { CommerceStage } from "@/components/marketplace/commerce-surface-system";

export function Hero() {
  return (
    <section className="container-shell py-20">
      <CommerceStage
        dataId="home-hero"
        eyebrow="Marketplace premium para creadores"
        title="Publica, compara y compra recursos con una experiencia comercial mas solida."
        description="ForjaDev une discovery, confianza y decision de compra en una misma columna vertebral para plugins, mapas y herramientas listas para servidores."
        align="split"
        actions={[
          { label: "Explorar productos", href: "/products", variant: "primary" },
          { label: "Ver deals", href: "/deals", variant: "secondary" },
          { label: "Quiero vender", href: "/seller", variant: "secondary" },
        ]}
        stats={[
          { label: "Discovery", value: "Catalogo navegable" },
          { label: "Trust", value: "Senales precompra visibles" },
          { label: "Commerce", value: "Compra con contexto" },
          { label: "Post-sale", value: "Resolucion ya operativa" },
        ]}
      />
    </section>
  );
}
