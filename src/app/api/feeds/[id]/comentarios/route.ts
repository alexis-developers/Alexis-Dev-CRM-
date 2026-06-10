import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
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

    const { data: comments, error } = await supabase
      .from('feed_comentarios')
      .select('*, autor:profiles!autor_id(*)')
      .eq('feed_id', id)
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .order('criado_em', { ascending: true });

    if (error) {
      console.error('Fetch comments error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (err) {
    console.error('API comments GET error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

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
    if (!body) {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    const { conteudo, comentario_pai_id, anexos, mencoes } = body;

    if (!conteudo || !conteudo.trim()) {
      return NextResponse.json({ error: 'O conteúdo do comentário é obrigatório' }, { status: 400 });
    }

    if (conteudo.length > 5000) {
      return NextResponse.json({ error: 'O comentário excede o limite de 5.000 caracteres' }, { status: 400 });
    }

    // Check if feed post exists
    const { data: feed, error: feedErr } = await supabase
      .from('feeds')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .single();

    if (feedErr || !feed) {
      return NextResponse.json({ error: 'Postagem não encontrada' }, { status: 404 });
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 404 });
    }

    const payload = {
      user_id: user.id,
      feed_id: id,
      comentario_pai_id: comentario_pai_id || null,
      autor_id: profile.id,
      conteudo: conteudo.trim(),
      anexos: Array.isArray(anexos) ? anexos : [],
      mencoes: Array.isArray(mencoes) ? mencoes : [],
      editado: false,
    };

    const { data: newComment, error: insertErr } = await supabase
      .from('feed_comentarios')
      .insert(payload)
      .select('*, autor:profiles!autor_id(*)')
      .single();

    if (insertErr || !newComment) {
      console.error('Insert comment error:', insertErr);
      return NextResponse.json({ error: 'Falha ao salvar comentário' }, { status: 500 });
    }

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (err) {
    console.error('API comments POST error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
