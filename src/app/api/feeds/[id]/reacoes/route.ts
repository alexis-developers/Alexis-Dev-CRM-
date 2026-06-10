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
    if (!body) {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    const { tipo_reacao, comentario_id } = body;

    if (!tipo_reacao) {
      return NextResponse.json({ error: 'O tipo da reação é obrigatório' }, { status: 400 });
    }

    // Validate emoji type
    const VALID_REACTIONS = ['curtir', 'amei', 'parabens', 'importante', 'risada'];
    if (!VALID_REACTIONS.includes(tipo_reacao)) {
      return NextResponse.json({ error: 'Tipo de reação inválido' }, { status: 400 });
    }

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
      feed_id: comentario_id ? null : id,
      comentario_id: comentario_id || null,
      usuario_id: profile.id,
      tipo_reacao,
    };

    const { data: reaction, error } = await supabase
      .from('feed_reacoes')
      .upsert(payload, { onConflict: 'usuario_id, feed_id, comentario_id' })
      .select()
      .single();

    if (error || !reaction) {
      console.error('Insert reaction error:', error);
      return NextResponse.json({ error: 'Falha ao processar reação' }, { status: 500 });
    }

    return NextResponse.json({ reaction });
  } catch (err) {
    console.error('API reaction POST error:', err);
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

    const { searchParams } = new URL(request.url);
    const comentario_id = searchParams.get('comentario_id');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 404 });
    }

    let deleteQuery = supabase
      .from('feed_reacoes')
      .delete()
      .eq('usuario_id', profile.id)
      .eq('user_id', user.id);

    if (comentario_id) {
      deleteQuery = deleteQuery.eq('comentario_id', comentario_id).is('feed_id', null);
    } else {
      deleteQuery = deleteQuery.eq('feed_id', id).is('comentario_id', null);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Delete reaction error:', error);
      return NextResponse.json({ error: 'Falha ao remover reação' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Reação removida com sucesso' });
  } catch (err) {
    console.error('API reaction DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
