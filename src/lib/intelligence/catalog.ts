export interface CatalogRankingProduct {
  id: string;
  vendor_id: string;
  featured: boolean;
  rating_average: number;
  rating_count: number;
  download_count: number;
  purchase_count: number;
  created_at: string;
  updated_at: string;
}

export interface SellerRankingSnapshot {
  reputationScore: number;
  riskScore: number;
}

export interface ProductRankingSnapshot {
  riskScore: number;
}

function daysSince(dateIso: string) {
  return Math.max(0, (Date.now() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24));
}

export function computeQualityTrustScore(
  product: CatalogRankingProduct,
  sellerSnapshot: SellerRankingSnapshot,
  productSnapshot: ProductRankingSnapshot
) {
  const ratingScore =
    product.rating_count > 0
      ? Math.min(30, Math.round(product.rating_average * 6) + Math.min(10, product.rating_count))
      : 0;
  const purchaseScore = Math.min(20, Math.floor(product.purchase_count / 2));
  const downloadScore = Math.min(12, Math.floor(product.download_count / 8));
  const freshnessScore = Math.max(0, 10 - Math.floor(daysSince(product.updated_at) / 14));
  const featuredBonus = product.featured ? 6 : 0;
  const sellerTrustScore = Math.min(18, Math.floor(sellerSnapshot.reputationScore / 6));
  const sellerRiskPenalty = Math.min(18, Math.floor(sellerSnapshot.riskScore / 5));
  const productRiskPenalty = Math.min(20, Math.floor(productSnapshot.riskScore / 4));

  return (
    ratingScore +
    purchaseScore +
    downloadScore +
    freshnessScore +
    featuredBonus +
    sellerTrustScore -
    sellerRiskPenalty -
    productRiskPenalty
  );
}
