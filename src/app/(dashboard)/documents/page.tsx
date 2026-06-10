'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2, FolderOpen,
  Search, File, FileText, FileImage, Download, FolderPlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CrmFolder {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id?: string;
  created_at: string;
}

interface CrmDocument {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  file_url?: string;
  file_type?: string;
  file_size: number;
  folder_id?: string;
  contact_id?: string;
  deal_id?: string;
  lead_id?: string;
  created_at: string;
  updated_at: string;
}

function getFileIcon(fileType?: string) {
  if (!fileType) return File;
  if (fileType.includes('image')) return FileImage;
  if (fileType.includes('pdf') || fileType.includes('text') || fileType.includes('document')) return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DocumentsPage() {
  const supabase = createClient();

  const [folders, setFolders] = useState<CrmFolder[]>([]);
  const [documents, setDocuments] = useState<CrmDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const [docFormOpen, setDocFormOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<CrmDocument | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [savingFolder, setSavingFolder] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CrmDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formDocName, setFormDocName] = useState('');
  const [formDocDescription, setFormDocDescription] = useState('');
  const [formDocUrl, setFormDocUrl] = useState('');
  const [formDocType, setFormDocType] = useState('');
  const [formDocFolder, setFormDocFolder] = useState('');
  const [formFolderName, setFormFolderName] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: folds }, { data: docs }] = await Promise.all([
      supabase.from('crm_folders').select('*').order('name', { ascending: true }),
      supabase.from('crm_documents').select('*').order('created_at', { ascending: false }),
    ]);
    setFolders((folds ?? []) as unknown as CrmFolder[]);
    setDocuments((docs ?? []) as unknown as CrmDocument[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  function openAddDoc() {
    setEditDoc(null);
    setFormDocName('');
    setFormDocDescription('');
    setFormDocUrl('');
    setFormDocType('');
    setFormDocFolder(selectedFolder ?? '');
    setDocFormOpen(true);
  }

  function openEditDoc(doc: CrmDocument) {
    setEditDoc(doc);
    setFormDocName(doc.name);
    setFormDocDescription(doc.description ?? '');
    setFormDocUrl(doc.file_url ?? '');
    setFormDocType(doc.file_type ?? '');
    setFormDocFolder(doc.folder_id ?? '');
    setDocFormOpen(true);
  }

  async function handleSaveDoc() {
    if (!formDocName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSavingDoc(true);
    const payload = {
      name: formDocName.trim(),
      description: formDocDescription.trim() || null,
      file_url: formDocUrl.trim() || null,
      file_type: formDocType.trim() || null,
      folder_id: formDocFolder || null,
      updated_at: new Date().toISOString(),
    };
    if (editDoc) {
      const { error } = await supabase.from('crm_documents').update(payload).eq('id', editDoc.id);
      if (error) toast.error('Falha ao atualizar documento');
      else { toast.success('Documento atualizado'); setDocFormOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from('crm_documents').insert(payload);
      if (error) toast.error('Falha ao criar documento');
      else { toast.success('Documento criado'); setDocFormOpen(false); fetchData(); }
    }
    setSavingDoc(false);
  }

  async function handleSaveFolder() {
    if (!formFolderName.trim()) { toast.error('Nome da pasta é obrigatório'); return; }
    setSavingFolder(true);
    const { error } = await supabase.from('crm_folders').insert({ name: formFolderName.trim() });
    if (error) toast.error('Falha ao criar pasta');
    else { toast.success('Pasta criada'); setFolderFormOpen(false); setFormFolderName(''); fetchData(); }
    setSavingFolder(false);
  }

  async function handleDeleteDoc() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('crm_documents').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Falha ao excluir documento');
    else { toast.success('Documento excluído'); fetchData(); }
    setDeleting(false);
    setDeleteConfirmOpen(false);
  }

  const filteredDocs = documents.filter((d) => {
    if (selectedFolder && d.folder_id !== selectedFolder) return false;
    if (search.trim() && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Arquivos</h1>
          <p className="text-sm text-slate-400 mt-1">{documents.length} documento(s) · {folders.length} pasta(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFolderFormOpen(true)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <FolderPlus className="size-4" />Nova Pasta
          </Button>
          <Button onClick={openAddDoc} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="size-4" />Novo Documento
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Folder sidebar */}
        <div className="w-48 shrink-0 space-y-1">
          <button
            onClick={() => setSelectedFolder(null)}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
              !selectedFolder ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FolderOpen className="size-4 shrink-0" />
            <span className="truncate">Todos os Arquivos</span>
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolder(folder.id)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                selectedFolder === folder.id ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FolderOpen className="size-4 shrink-0" />
              <span className="truncate">{folder.name}</span>
              <span className="ml-auto text-xs text-slate-600">
                {documents.filter((d) => d.folder_id === folder.id).length}
              </span>
            </button>
          ))}
        </div>

        {/* Document list */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar documentos..." className="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            {currentFolder && (
              <span className="text-sm text-slate-400">/{currentFolder.name}</span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-violet-500" /></div>
          ) : filteredDocs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 py-16 text-center">
              <FolderOpen className="size-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum documento nesta pasta.</p>
              <Button variant="outline" size="sm" onClick={openAddDoc} className="mt-3 border-slate-700 text-slate-300 hover:bg-slate-800">
                <Plus className="size-3.5" />Adicionar Documento
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredDocs.map((doc) => {
                const FileIcon = getFileIcon(doc.file_type ?? undefined);
                return (
                  <div key={doc.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4 hover:border-slate-700 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800">
                          <FileIcon className="size-5 text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-slate-500">
                            {doc.file_size ? formatSize(doc.file_size) : 'URL'} · {format(new Date(doc.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white shrink-0" />}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                          {doc.file_url && (
                            <DropdownMenuItem
                              onClick={() => window.open(doc.file_url!, '_blank')}
                              className="text-slate-300 focus:bg-slate-800"
                            >
                              <Download className="size-4" />Baixar/Abrir
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEditDoc(doc)} className="text-slate-300 focus:bg-slate-800">
                            <Pencil className="size-4" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem variant="destructive" onClick={() => { setDeleteTarget(doc); setDeleteConfirmOpen(true); }}>
                            <Trash2 className="size-4" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {doc.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{doc.description}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Doc Form Dialog */}
      <Dialog open={docFormOpen} onOpenChange={setDocFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editDoc ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Nome *</Label>
              <Input value={formDocName} onChange={(e) => setFormDocName(e.target.value)}
                placeholder="Nome do documento" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">URL do Arquivo</Label>
              <Input value={formDocUrl} onChange={(e) => setFormDocUrl(e.target.value)}
                placeholder="https://..." className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Tipo</Label>
              <Input value={formDocType} onChange={(e) => setFormDocType(e.target.value)}
                placeholder="PDF, DOCX, PNG..." className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Pasta</Label>
              <Select value={formDocFolder} onValueChange={(v) => setFormDocFolder(v ?? '')}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300"><SelectValue placeholder="Nenhuma pasta" /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="" className="text-slate-300">Nenhuma pasta</SelectItem>
                  {folders.map((f) => <SelectItem key={f.id} value={f.id} className="text-slate-300">{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Descrição</Label>
              <Textarea value={formDocDescription} onChange={(e) => setFormDocDescription(e.target.value)}
                placeholder="Descrição do documento..." rows={2}
                className="bg-slate-800 border-slate-700 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocFormOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button onClick={handleSaveDoc} disabled={savingDoc} className="bg-violet-600 hover:bg-violet-700">
              {savingDoc && <Loader2 className="size-4 animate-spin" />}
              {editDoc ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Form Dialog */}
      <Dialog open={folderFormOpen} onOpenChange={setFolderFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label className="text-slate-300">Nome da Pasta</Label>
            <Input value={formFolderName} onChange={(e) => setFormFolderName(e.target.value)}
              placeholder="Ex: Contratos" className="bg-slate-800 border-slate-700 text-white" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderFormOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button onClick={handleSaveFolder} disabled={savingFolder} className="bg-violet-600 hover:bg-violet-700">
              {savingFolder && <Loader2 className="size-4 animate-spin" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Excluir Documento</DialogTitle>
            <DialogDescription className="text-slate-400">
              Tem certeza que deseja excluir <span className="text-slate-200 font-medium">"{deleteTarget?.name}"</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteDoc} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
