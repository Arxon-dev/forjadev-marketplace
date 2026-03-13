import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  title: string;
  author: string;
  category: string;
  price: string;
  compatibility: string;
}

export function ProductCard({ title, author, category, price, compatibility }: ProductCardProps) {
  return (
    <Card className="overflow-hidden p-4 hover:bg-white/[0.07]">
      <div className="mb-4 aspect-[16/9] rounded-xl bg-white/5" />
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
}
