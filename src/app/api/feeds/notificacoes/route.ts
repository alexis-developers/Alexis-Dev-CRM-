import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 404 });
    }

    // Unread posts: feeds that the user has NOT viewed yet (not in feed_visualizacoes)
    // AND where the user is mentioned, OR the post is pinned/anuncio, OR it's system marco.
    // To make it simple and extremely functional: we fetch all posts where the user is mentioned
    // OR comments where the user is mentioned, and we verify if a row in feed_visualizacoes exists.
    
    // Step 1: Fetch viewed feed ids
    const { data: views } = await supabase
      .from('feed_visualizacoes')
      .select('feed_id')
      .eq('usuario_id', profile.id)
      .eq('user_id', user.id);

    const viewedIds = views ? views.map((v) => v.feed_id) : [];

    // Step 2: Fetch feeds where user is mentioned or created the post (to see comment activity)
    const { data: feeds, error } = await supabase
      .from('feeds')
      .select('*, autor:profiles!autor_id(*)')
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Fetch notifications feeds error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter unread notifications on the serverless side:
    // A post is a notification if:
    // 1. It is unviewed (not in viewedIds)
    // 2. AND (user is mentioned in the post, OR user is author (to see new comments), OR post is an important announcement/pin)
    const unreadNotifications = (feeds || []).filter((feed) => {
      const isViewed = viewedIds.includes(feed.id);
      if (isViewed) return false;

      const isMentioned = Array.isArray(feed.mencoes) && feed.mencoes.includes(profile.id);
      const isAuthor = feed.autor_id === profile.id;
      const isImportant = feed.tipo === 'anuncio' || feed.fixado;

      return isMentioned || isAuthor || isImportant;
    });

    return NextResponse.json({ notifications: unreadNotifications });
  } catch (err) {
    console.error('API notifications GET error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 404 });
    }

    // Mark all feeds of this tenant as viewed by this user
    const { data: feeds } = await supabase
      .from('feeds')
      .select('id')
      .eq('user_id', user.id)
      .is('excluido_em', null);

    if (feeds && feeds.length > 0) {
      const upsertRows = feeds.map((f) => ({
        user_id: user.id,
        feed_id: f.id,
        usuario_id: profile.id,
        visualizado_em: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('feed_visualizacoes')
        .upsert(upsertRows, { onConflict: 'feed_id, usuario_id' });

      if (error) {
        console.error('Mark read error:', error);
        return NextResponse.json({ error: 'Falha ao marcar notificações como lidas' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Todas as notificações marcadas como lidas' });
  } catch (err) {
    console.error('API notifications PUT error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
