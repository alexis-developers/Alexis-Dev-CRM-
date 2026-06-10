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

    // 1. Fetch all active posts of this tenant
    const { data: feeds, error: feedsErr } = await supabase
      .from('feeds')
      .select('*, autor:profiles!autor_id(*)')
      .eq('user_id', user.id)
      .is('excluido_em', null);

    if (feedsErr) {
      return NextResponse.json({ error: feedsErr.message }, { status: 500 });
    }

    // 2. Fetch all comments
    const { data: comments } = await supabase
      .from('feed_comentarios')
      .select('*, autor:profiles!autor_id(*)')
      .eq('user_id', user.id)
      .is('excluido_em', null);

    // 3. Fetch all reactions
    const { data: reactions } = await supabase
      .from('feed_reacoes')
      .select('*')
      .eq('user_id', user.id);

    const postCount = feeds?.length || 0;
    const commentCount = comments?.length || 0;
    const reactionCount = reactions?.length || 0;

    // 4. Group activities by day for chart (last 7 days)
    const dailyActivity: Record<string, { posts: number; comments: number; reactions: number }> = {};
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 7);

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dailyActivity[key] = { posts: 0, comments: 0, reactions: 0 };
    }

    feeds?.forEach((feed) => {
      const date = new Date(feed.criado_em);
      if (date >= dateLimit) {
        const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (dailyActivity[key]) {
          dailyActivity[key].posts += 1;
        }
      }
    });

    comments?.forEach((comment) => {
      const date = new Date(comment.criado_em);
      if (date >= dateLimit) {
        const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (dailyActivity[key]) {
          dailyActivity[key].comments += 1;
        }
      }
    });

    reactions?.forEach((reaction) => {
      const date = new Date(reaction.criado_em);
      if (date >= dateLimit) {
        const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (dailyActivity[key]) {
          dailyActivity[key].reactions += 1;
        }
      }
    });

    const activityChartData = Object.entries(dailyActivity).map(([date, val]) => ({
      date,
      ...val,
    }));

    // 5. Leaderboard of active profiles (Posts + Comments count)
    const userEngagement: Record<string, { profile: any; posts: number; comments: number; score: number }> = {};

    feeds?.forEach((feed) => {
      if (feed.autor && feed.autor.id) {
        const uid = feed.autor.id;
        if (!userEngagement[uid]) {
          userEngagement[uid] = { profile: feed.autor, posts: 0, comments: 0, score: 0 };
        }
        userEngagement[uid].posts += 1;
        userEngagement[uid].score += 3; // 3 points per post
      }
    });

    comments?.forEach((comment) => {
      if (comment.autor && comment.autor.id) {
        const uid = comment.autor.id;
        if (!userEngagement[uid]) {
          userEngagement[uid] = { profile: comment.autor, posts: 0, comments: 0, score: 0 };
        }
        userEngagement[uid].comments += 1;
        userEngagement[uid].score += 1; // 1 point per comment
      }
    });

    const leaderboard = Object.values(userEngagement)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // 6. Categories Breakdown count
    const categoryStats: Record<string, number> = {
      venda: 0,
      contato: 0,
      chamada: 0,
      tarefa: 0,
      visita_site: 0,
      comentario_geral: 0,
      outros: 0,
    };

    feeds?.forEach((feed) => {
      if (categoryStats[feed.categoria] !== undefined) {
        categoryStats[feed.categoria] += 1;
      } else {
        categoryStats.outros += 1;
      }
    });

    const categoryBreakdown = Object.entries(categoryStats).map(([name, value]) => ({
      name: name === 'comentario_geral' ? 'Discussão' : name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

    // 7. Trending hashtags
    const hashtagsFreq: Record<string, number> = {};
    feeds?.forEach((feed) => {
      if (Array.isArray(feed.tags)) {
        feed.tags.forEach((tag: string) => {
          hashtagsFreq[tag] = (hashtagsFreq[tag] || 0) + 1;
        });
      }
    });

    const trendingTags = Object.entries(hashtagsFreq)
      .map(([name, count]) => ({ name: `#${name}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        posts: postCount,
        comments: commentCount,
        reactions: reactionCount,
        totalActivity: postCount + commentCount + reactionCount,
      },
      activityChartData,
      leaderboard,
      categoryBreakdown,
      trendingTags,
    });
  } catch (err) {
    console.error('API analytics dashboard error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
