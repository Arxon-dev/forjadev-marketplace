"use client";

import { useRouter } from "next/navigation";
import { ProductForm } from "@/components/seller/product-form";

interface SellerEditProductShellProps {
  productId: string;
}

export function SellerEditProductShell({ productId }: SellerEditProductShellProps) {
  const router = useRouter();

  return (
    <ProductForm
      productId={productId}
      onSuccess={() => {
        router.push(`/seller/products/${productId}`);
      }}
    />
  );
}
