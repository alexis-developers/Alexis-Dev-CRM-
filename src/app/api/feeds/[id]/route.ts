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

    const { data: feed, error } = await supabase
      .from('feeds')
      .select('*, autor:profiles!autor_id(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .single();

    if (error || !feed) {
      return NextResponse.json({ error: 'Postagem não encontrada' }, { status: 404 });
    }

    // Register view count dynamically for analytical scopes
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      await supabase
        .from('feed_visualizacoes')
        .upsert(
          { user_id: user.id, feed_id: id, usuario_id: profile.id },
          { onConflict: 'feed_id, usuario_id' }
        );
    }

    return NextResponse.json({ feed });
  } catch (err) {
    console.error('API feed detail GET error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

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

    const { titulo, conteudo, visibilidade, anexos, mencoes, tags, metadados } = body;

    // Fetch existing feed post
    const { data: feed, error: fetchErr } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .single();

    if (fetchErr || !feed) {
      return NextResponse.json({ error: 'Postagem não encontrada' }, { status: 404 });
    }

    // RULE 1: System posts cannot be edited
    if (feed.tipo === 'sistema') {
      return NextResponse.json({ error: 'Postagens de sistema não podem ser editadas' }, { status: 400 });
    }

    // Fetch current user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 404 });
    }

    // Only the author can edit their manual post
    if (feed.autor_id !== profile.id) {
      return NextResponse.json({ error: 'Você só pode editar suas próprias postagens' }, { status: 403 });
    }

    // RULE 2: Edit allowed only up to 15 minutes after creation
    const createdTime = new Date(feed.criado_em).getTime();
    const currentTime = Date.now();
    const diffMinutes = (currentTime - createdTime) / 60000;
    if (diffMinutes > 15) {
      return NextResponse.json(
        { error: 'O limite de 15 minutos para edição deste post expirou' },
        { status: 400 }
      );
    }

    if (!titulo || !titulo.trim()) {
      return NextResponse.json({ error: 'O título é obrigatório' }, { status: 400 });
    }

    if (!conteudo || !conteudo.trim()) {
      return NextResponse.json({ error: 'O conteúdo é obrigatório' }, { status: 400 });
    }

    if (conteudo.length > 10000) {
      return NextResponse.json({ error: 'O conteúdo excede o limite de 10.000 caracteres' }, { status: 400 });
    }

    const mentionList = Array.isArray(mencoes) ? mencoes : [];
    if (mentionList.length > 10) {
      return NextResponse.json({ error: 'O post excede o limite de 10 menções' }, { status: 400 });
    }

    // Hashtags extraction
    const hashtagRegex = /#([\wÀ-ÿ]+)/g;
    const extractedTags: string[] = [];
    let match;
    while ((match = hashtagRegex.exec(conteudo)) !== null) {
      const tagClean = match[1].toLowerCase();
      if (!extractedTags.includes(tagClean)) {
        extractedTags.push(tagClean);
      }
    }

    const providedTags = Array.isArray(tags) ? tags.map((t: string) => t.toLowerCase().replace('#', '')) : [];
    const finalTags = Array.from(new Set([...providedTags, ...extractedTags]));

    const payload = {
      titulo: titulo.trim(),
      conteudo: conteudo.trim(),
      visibilidade: visibilidade || feed.visibilidade,
      anexos: Array.isArray(anexos) ? anexos : feed.anexos,
      mencoes: mentionList,
      tags: finalTags,
      metadados: metadados || feed.metadados,
      editado: true,
      editado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const { data: updatedPost, error: updateErr } = await supabase
      .from('feeds')
      .update(payload)
      .eq('id', id)
      .select('*, autor:profiles!autor_id(*)')
      .single();

    if (updateErr || !updatedPost) {
      console.error('Update feed error:', updateErr);
      return NextResponse.json({ error: 'Falha ao atualizar postagem' }, { status: 500 });
    }

    return NextResponse.json({ feed: updatedPost });
  } catch (err) {
    console.error('API feed PUT error:', err);
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

    const { data: feed, error: fetchErr } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .single();

    if (fetchErr || !feed) {
      return NextResponse.json({ error: 'Postagem não encontrada' }, { status: 404 });
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

    // RULE 1: System posts cannot be deleted by standard users.
    // RULE 3: Admins can delete any post (with reason if needed, but soft delete handles it).
    if (feed.tipo === 'sistema' && !isAdmin) {
      return NextResponse.json({ error: 'Postagens de sistema só podem ser excluídas por administradores' }, { status: 403 });
    }

    // Standard user can only delete their own manual post. Admins can delete anything.
    if (feed.autor_id !== profile.id && !isAdmin) {
      return NextResponse.json({ error: 'Sem permissão para excluir esta postagem' }, { status: 403 });
    }

    // Perform soft-delete
    const { error: deleteErr } = await supabase
      .from('feeds')
      .update({ excluido_em: new Date().toISOString() })
      .eq('id', id);

    if (deleteErr) {
      console.error('Soft delete feed error:', deleteErr);
      return NextResponse.json({ error: 'Falha ao excluir postagem' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Postagem excluída com sucesso' });
  } catch (err) {
    console.error('API feed DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
