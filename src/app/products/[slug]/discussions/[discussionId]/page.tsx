import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscussionReplyForm } from "@/components/community/discussion-reply-form";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{
    slug: string;
    discussionId: string;
  }>;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

export default async function ProductDiscussionDetailPage({ params }: Props) {
  const { slug, discussionId } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product } = await supabase
    .from("products")
    .select("id, title, slug, moderation_status")
    .eq("slug", slug)
    .maybeSingle();

  if (!product || product.moderation_status !== "approved") {
    notFound();
  }

  const [{ data: discussion }, { data: messages }] = await Promise.all([
    supabase
      .from("product_discussions")
      .select("id, product_id, author_user_id, title, body, is_pinned, is_locked, created_at, updated_at")
      .eq("id", discussionId)
      .eq("product_id", product.id)
      .maybeSingle(),
    supabase
      .from("discussion_messages")
      .select("id, discussion_id, author_user_id, body, created_at")
      .eq("discussion_id", discussionId)
      .order("created_at", { ascending: true }),
  ]);

  if (!discussion) {
    notFound();
  }

  const authorIds = Array.from(
    new Set([discussion.author_user_id, ...(messages || []).map((message) => message.author_user_id)])
  );

  const { data: profiles } = authorIds.length
    ? await adminSupabase
        .from("profiles")
        .select("id, username, display_name, email")
        .in("id", authorIds)
    : { data: [] as ProfileRow[] };

  const profileById = new Map(((profiles || []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const discussionAuthor = profileById.get(discussion.author_user_id);
  const canReply = Boolean(user);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
          <Link href="/products" className="hover:text-white">
            Productos
          </Link>
          <span>/</span>
          <Link href={`/products/${product.slug}`} className="hover:text-white">
            {product.title}
          </Link>
          <span>/</span>
          <span className="text-white">Discusion</span>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2">
                {discussion.is_pinned ? <Badge>Fijada</Badge> : null}
                {discussion.is_locked ? <Badge>Bloqueada</Badge> : null}
              </div>
              <h1 className="mt-4 text-3xl font-bold text-white">{discussion.title}</h1>
              <p className="mt-3 text-sm text-[var(--text-soft)]">
                Por{" "}
                <span className="text-white">
                  {discussionAuthor?.display_name ||
                    discussionAuthor?.username ||
                    discussionAuthor?.email ||
                    "Usuario"}
                </span>{" "}
                | {new Date(discussion.created_at).toLocaleString("es-ES")}
              </p>
            </div>
            <Link href={`/products/${product.slug}`}>
              <span className="text-sm font-semibold text-white hover:underline">
                Volver al producto
              </span>
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-5">
            <p className="whitespace-pre-wrap text-[var(--text-soft)]">{discussion.body}</p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-semibold text-white">Respuestas</h2>
          {messages && messages.length > 0 ? (
            <div className="mt-5 space-y-4">
              {messages.map((message) => {
                const author = profileById.get(message.author_user_id);

                return (
                  <article key={message.id} className="rounded-2xl border border-white/10 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-white">
                        {author?.display_name || author?.username || author?.email || "Usuario"}
                      </p>
                      <p className="text-xs text-[var(--text-soft)]">
                        {new Date(message.created_at).toLocaleString("es-ES")}
                      </p>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                      {message.body}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 text-[var(--text-soft)]">
              Todavia no hay respuestas en esta discusion.
            </p>
          )}
        </div>

        <div className="mt-8">
          {canReply ? (
            <DiscussionReplyForm discussionId={discussion.id} disabled={discussion.is_locked} />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-[var(--text-soft)]">
                Inicia sesion para responder en la discusion.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Iniciar sesion
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
