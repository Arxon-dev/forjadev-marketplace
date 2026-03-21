interface DiscussionMessageLike {
  author_user_id: string;
  body?: string | null;
  created_at: string;
}

interface DiscussionThreadLike {
  author_user_id: string;
  is_locked: boolean;
  updated_at: string;
}

function truncatePreview(value: string | null | undefined, max = 160) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function buildDiscussionTrustSnapshot(params: {
  discussion: DiscussionThreadLike;
  messages: DiscussionMessageLike[];
  sellerUserId: string | null;
}) {
  const { discussion, messages, sellerUserId } = params;
  const sellerMessages =
    sellerUserId
      ? messages.filter((message) => message.author_user_id === sellerUserId)
      : [];
  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const latestSellerMessage =
    sellerMessages.length > 0 ? sellerMessages[sellerMessages.length - 1] : null;
  const discussionOpenedBySeller =
    Boolean(sellerUserId) && discussion.author_user_id === sellerUserId;
  const hasSellerResponse = discussionOpenedBySeller || sellerMessages.length > 0;
  const latestActor =
    latestMessage && sellerUserId
      ? latestMessage.author_user_id === sellerUserId
        ? "seller"
        : "community"
      : "community";

  const statusLabel = discussion.is_locked
    ? "bloqueada"
    : hasSellerResponse
      ? "respondida por el creador"
      : "pendiente del creador";

  const nextAction = discussion.is_locked
    ? "Lee el contexto y usa la ficha o soporte si necesitas una via formal."
    : hasSellerResponse
      ? latestActor === "seller"
        ? "Ya hay respuesta del creador; puedes contrastarla antes de comprar."
        : "Ya hay respuesta del creador y la conversacion sigue activa con la comunidad."
      : "Todavia no hay respuesta visible del creador en este hilo.";

  return {
    totalReplies: messages.length,
    sellerReplyCount: sellerMessages.length,
    hasSellerResponse,
    discussionOpenedBySeller,
    latestActor,
    statusLabel,
    nextAction,
    latestReplyAt: latestMessage?.created_at || discussion.updated_at,
    latestSellerReplyPreview: truncatePreview(latestSellerMessage?.body || null),
  };
}
