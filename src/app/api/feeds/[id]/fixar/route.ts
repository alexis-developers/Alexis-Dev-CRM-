import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.fixado !== 'boolean') {
      return NextResponse.json({ error: 'Flag "fixado" booleana é obrigatória' }, { status: 400 });
    }

    const { fixado } = body;

    // Check user profile role
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 404 });
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'manager';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Apenas administradores podem fixar postagens' }, { status: 403 });
    }

    // If trying to pin a post, make sure they don't exceed the limit of 3 pinned posts
    if (fixado) {
      const { count, error: countErr } = await supabase
        .from('feeds')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('fixado', true)
        .is('excluido_em', null);

      if (countErr) {
        console.error('Count pinned error:', countErr);
      }

      if (count && count >= 3) {
        return NextResponse.json(
          { error: 'Você já atingiu o limite de 3 postagens fixadas no topo' },
          { status: 400 }
        );
      }
    }

    const { data: updatedPost, error: updateErr } = await supabase
      .from('feeds')
      .update({ fixado })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, autor:profiles!autor_id(*)')
      .single();

    if (updateErr || !updatedPost) {
      console.error('Pin feed error:', updateErr);
      return NextResponse.json({ error: 'Falha ao fixar postagem' }, { status: 500 });
    }

    return NextResponse.json({ feed: updatedPost });
  } catch (err) {
    console.error('API feed pin POST error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
