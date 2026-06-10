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

    const { data: feeds, error } = await supabase
      .from('feeds')
      .select('*, autor:profiles!autor_id(*)')
      .eq('user_id', user.id)
      .is('excluido_em', null)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Export feeds fetch error:', error);
      return new Response('Falha ao carregar dados para exportação', { status: 500 });
    }

    // Generate CSV contents
    const headers = [
      'ID',
      'Data de Criacao',
      'Tipo',
      'Categoria',
      'Autor',
      'Titulo',
      'Conteudo',
      'Visibilidade',
      'Tags',
      'Qtd Anexos',
      'Qtd Mencoes',
      'Fixado',
      'Editado',
    ];

    const escapeCSVValue = (val: any) => {
      if (val === null || val === undefined) return '';
      const stringVal = String(val);
      // Double up any quotes and wrap the whole thing in quotes
      return `"${stringVal.replace(/"/g, '""')}"`;
    };

    const csvRows = [headers.join(',')];

    feeds?.forEach((feed) => {
      const row = [
        feed.id,
        new Date(feed.criado_em).toLocaleString('pt-BR'),
        feed.tipo,
        feed.categoria,
        feed.autor ? feed.autor.full_name : 'Sistema',
        feed.titulo,
        feed.conteudo,
        feed.visibilidade,
        feed.tags ? feed.tags.join(';') : '',
        feed.anexos ? feed.anexos.length : 0,
        feed.mencoes ? feed.mencoes.length : 0,
        feed.fixado ? 'Sim' : 'Nao',
        feed.editado ? 'Sim' : 'Nao',
      ];
      csvRows.push(row.map(escapeCSVValue).join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n'); // Add UTF-8 BOM for Excel formatting

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="relatorio_atividades_feeds.csv"',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('API analytics export GET error:', err);
    return new Response('Erro interno do servidor', { status: 500 });
  }
}
