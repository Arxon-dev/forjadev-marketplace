import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ProductCardProps {
  title: string;
  author: string;
  category: string;
  price: string;
  compatibility: string;
  href?: string;
  imageUrl?: string | null;
}

export function ProductCard({
  title,
  author,
  category,
  price,
  compatibility,
  href,
  imageUrl,
}: ProductCardProps) {
  const content = (
    <Card className="overflow-hidden p-4 hover:bg-white/[0.07]">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          width={800}
          height={450}
          className="mb-4 aspect-[16/9] w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-4 aspect-[16/9] rounded-xl bg-white/5" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-[var(--text-soft)]">por {author}</p>
        </div>
        <Badge>{price}</Badge>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge>{category}</Badge>
        <Badge>{compatibility}</Badge>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-transform hover:-translate-y-1">
        {content}
      </Link>
    );
  }

  return content;
}
