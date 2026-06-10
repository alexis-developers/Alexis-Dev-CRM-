import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const categoria = searchParams.get('categoria');
    const tag = searchParams.get('tag');
    const busca = searchParams.get('busca');
    const cursor = searchParams.get('cursor');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    let query = supabase
      .from('feeds')
      .select('*, autor:profiles!autor_id(*)')
      .is('excluido_em', null)
      .eq('user_id', user.id);

    if (tipo) {
      query = query.eq('tipo', tipo);
    }
    if (categoria) {
      query = query.eq('categoria', categoria);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }
    if (busca) {
      query = query.ilike('conteudo', `%${busca}%`);
    }
    if (cursor) {
      query = query.lt('criado_em', cursor);
    }

    // Order first by pinned status (always on top), then chronologically by creation
    query = query
      .order('fixado', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Fetch feeds error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feeds: data || [] });
  } catch (err) {
    console.error('API feeds GET error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    const {
      tipo,
      categoria,
      titulo,
      conteudo,
      visibilidade,
      anexos,
      mencoes,
      tags,
      metadados,
      entidade_relacionada_tipo,
      entidade_relacionada_id,
    } = body;

    if (!titulo || !titulo.trim()) {
      return NextResponse.json({ error: 'O título do post é obrigatório' }, { status: 400 });
    }

    if (!conteudo || !conteudo.trim()) {
      return NextResponse.json({ error: 'O conteúdo do post é obrigatório' }, { status: 400 });
    }

    if (conteudo.length > 10000) {
      return NextResponse.json({ error: 'O conteúdo excede o limite de 10.000 caracteres' }, { status: 400 });
    }

    const mentionList = Array.isArray(mencoes) ? mencoes : [];
    if (mentionList.length > 10) {
      return NextResponse.json({ error: 'O post excede o limite de 10 menções' }, { status: 400 });
    }

    // Auto-extract hashtags from post content (e.g. #campanha -> campanha)
    const hashtagRegex = /#([\wÀ-ÿ]+)/g;
    const extractedTags: string[] = [];
    let match;
    while ((match = hashtagRegex.exec(conteudo)) !== null) {
      const tagClean = match[1].toLowerCase();
      if (!extractedTags.includes(tagClean)) {
        extractedTags.push(tagClean);
      }
    }

    // Merge manual tags with auto-extracted tags
    const providedTags = Array.isArray(tags) ? tags.map((t: string) => t.toLowerCase().replace('#', '')) : [];
    const finalTags = Array.from(new Set([...providedTags, ...extractedTags]));

    // Fetch the active profile of the current user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 404 });
    }

    const payload = {
      user_id: user.id,
      tipo: tipo || 'manual',
      categoria: categoria || 'comentario_geral',
      autor_id: profile.id,
      autor_tipo: 'usuario',
      titulo: titulo.trim(),
      conteudo: conteudo.trim(),
      visibilidade: visibilidade || 'publico',
      anexos: Array.isArray(anexos) ? anexos : [],
      mencoes: mentionList,
      tags: finalTags,
      metadados: metadados || {},
      entidade_relacionada_tipo: entidade_relacionada_tipo || null,
      entidade_relacionada_id: entidade_relacionada_id || null,
      fixado: false,
      editado: false,
    };

    const { data: newPost, error: insertError } = await supabase
      .from('feeds')
      .insert(payload)
      .select('*, autor:profiles!autor_id(*)')
      .single();

    if (insertError || !newPost) {
      console.error('Insert feed error:', insertError);
      return NextResponse.json({ error: insertError?.message || 'Falha ao salvar postagem' }, { status: 500 });
    }

    return NextResponse.json({ feed: newPost }, { status: 201 });
  } catch (err) {
    console.error('API feeds POST error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
