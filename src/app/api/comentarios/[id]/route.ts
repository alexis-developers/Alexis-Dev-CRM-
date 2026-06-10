import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
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

    const { conteudo, anexos, mencoes } = body;

    if (!conteudo || !conteudo.trim()) {
      return NextResponse.json({ error: 'O conteúdo é obrigatório' }, { status: 400 });
    }

    if (conteudo.length > 5000) {
      return NextResponse.json({ error: 'O comentário excede o limite de 5.000 caracteres' }, { status: 400 });
    }

    const { data: comment, error: fetchErr } = await supabase
      .from('feed_comentarios')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .single();

    if (fetchErr || !comment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile || comment.autor_id !== profile.id) {
      return NextResponse.json({ error: 'Você só pode editar seus próprios comentários' }, { status: 403 });
    }

    const payload = {
      conteudo: conteudo.trim(),
      anexos: Array.isArray(anexos) ? anexos : comment.anexos,
      mencoes: Array.isArray(mencoes) ? mencoes : comment.mencoes,
      editado: true,
      atualizado_em: new Date().toISOString(),
    };

    const { data: updatedComment, error: updateErr } = await supabase
      .from('feed_comentarios')
      .update(payload)
      .eq('id', id)
      .select('*, autor:profiles!autor_id(*)')
      .single();

    if (updateErr || !updatedComment) {
      console.error('Update comment error:', updateErr);
      return NextResponse.json({ error: 'Falha ao atualizar comentário' }, { status: 500 });
    }

    return NextResponse.json({ comment: updatedComment });
  } catch (err) {
    console.error('API comment PUT error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { data: comment, error: fetchErr } = await supabase
      .from('feed_comentarios')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .single();

    if (fetchErr || !comment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 404 });
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'manager';

    if (comment.autor_id !== profile.id && !isAdmin) {
      return NextResponse.json({ error: 'Sem permissão para excluir este comentário' }, { status: 403 });
    }

    const { error: deleteErr } = await supabase
      .from('feed_comentarios')
      .update({ excluido_em: new Date().toISOString() })
      .eq('id', id);

    if (deleteErr) {
      console.error('Soft delete comment error:', deleteErr);
      return NextResponse.json({ error: 'Falha ao excluir comentário' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Comentário excluído com sucesso' });
  } catch (err) {
    console.error('API comment DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
