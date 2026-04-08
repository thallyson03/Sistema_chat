import { useState, useEffect, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';

interface ImportResult {
  success: number;
  errors: number;
  skipped: number;
  total: number;
  details: Array<{
    row: number;
    contact: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
  }>;
}

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  profilePicture: string | null;
  channel: {
    id: string;
    name: string;
    type: string;
  };
  createdAt: string;
  _count?: {
    conversations: number;
  };
}

interface ContactList {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    members: number;
  };
}

const STEPS = [
  { n: 1, label: 'Carregar arquivo' },
  { n: 2, label: 'Mapear campos' },
  { n: 3, label: 'Finalizar' },
] as const;

export default function ContactImport() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [channelId, setChannelId] = useState<string>('');
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterChannelId, setFilterChannelId] = useState<string>('');
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>('');

  const isImportPage = location.pathname.includes('/contacts/import');
  const isAutoCreatedPage = location.pathname.includes('/contacts/auto-created');

  useEffect(() => {
    fetchChannels();
    fetchContacts();
    fetchContactLists();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchContacts();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filterChannelId]);

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      setChannels(response.data || []);
      if (response.data && response.data.length > 0 && !channelId) {
        setChannelId(response.data[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar canais:', err);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const params: any = {};
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (filterChannelId) {
        params.channelId = filterChannelId;
      }
      params.limit = 100;

      const response = await api.get('/api/contacts', { params });
      setContacts(response.data?.contacts || response.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar contatos:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchContactLists = async () => {
    setLoadingLists(true);
    try {
      const response = await api.get('/api/contact-lists');
      setContactLists(response.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar listas de contatos:', err);
    } finally {
      setLoadingLists(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase();

    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      setError('Apenas arquivos Excel (.xlsx, .xls) ou CSV são permitidos');
      return;
    }

    setFile(selectedFile);
    setError('');
    setImportResult(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) validateAndSetFile(dropped);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/api/contacts/template', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'template-contatos.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao baixar template:', err);
      alert('Erro ao baixar template');
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Selecione um arquivo CSV');
      return;
    }

    if (!channelId) {
      setError('Selecione um canal');
      return;
    }

    setLoading(true);
    setError('');
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('channelId', channelId);
      if (selectedListId) {
        formData.append('listId', selectedListId);
      }

      const response = await api.post('/api/contacts/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult(response.data.result);
      setFile(null);
      setSelectedListId('');

      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      await fetchContacts();
      await fetchContactLists();
    } catch (err: any) {
      console.error('Erro ao importar:', err);
      setError(err.response?.data?.error || 'Erro ao importar contatos');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectFieldClass =
    'mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-[#66dd8b]/50 focus:outline-none focus:ring-1 focus:ring-[#66dd8b]/40';
  const selectFieldClassNoMt =
    'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-[#66dd8b]/50 focus:outline-none focus:ring-1 focus:ring-[#66dd8b]/40';

  return (
    <div className="relative min-h-[calc(100vh-60px)] bg-surface pb-10 font-body text-on-surface">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_45%_at_50%_-15%,rgba(102,221,139,0.14),transparent_55%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        {!isImportPage && (
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              Contatos Criados Automaticamente
            </h1>
            <button
              type="button"
              onClick={() => navigate('/conversations')}
              className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-variant"
            >
              ← Voltar
            </button>
          </div>
        )}

        {isImportPage && (
          <>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                Importar Contatos
              </h1>
              <button
                type="button"
                onClick={() => navigate('/conversations')}
                className="shrink-0 rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-variant"
              >
                ← Voltar
              </button>
            </div>

            <div className="mb-8 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
              {STEPS.map((step, index) => (
                <span key={step.n} className="flex items-center gap-3">
                  {index > 0 && (
                    <span className="hidden text-on-surface-variant sm:inline" aria-hidden>
                      —
                    </span>
                  )}
                  <span className="flex items-center gap-2.5">
                    <span
                      className={
                        step.n === 1
                          ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#66dd8b] text-sm font-bold text-[#003919]'
                          : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest text-sm font-bold text-on-surface-variant'
                      }
                    >
                      {step.n}
                    </span>
                    <span
                      className={
                        step.n === 1
                          ? 'text-sm font-semibold text-[#66dd8b]'
                          : 'text-sm font-medium text-on-surface-variant'
                      }
                    >
                      {step.label}
                    </span>
                  </span>
                </span>
              ))}
            </div>

            <div className="rounded-xl border border-outline-variant bg-[rgba(40,42,40,0.55)] p-6 shadow-forest-glow backdrop-blur-xl">
              <div className="mb-6 flex flex-col gap-4 border-b border-outline-variant pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="font-headline text-lg font-bold text-on-surface">
                    Instruções de Importação
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                    O arquivo Excel (.xlsx, .xls) ou CSV deve conter as colunas{' '}
                    <strong className="text-on-surface">name</strong> (obrigatório),{' '}
                    <strong className="text-on-surface">phone</strong> (obrigatório) e{' '}
                    <strong className="text-on-surface">email</strong> (opcional).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:border-[#66dd8b]/35 hover:bg-surface-variant"
                >
                  <span className="material-symbols-outlined text-xl text-[#66dd8b]">download</span>
                  Baixar modelo
                </button>
              </div>

              <div className="mb-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#66dd8b]">
                  Canal de destino
                </label>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className={selectFieldClass}
                >
                  <option value="">Selecione um canal</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} ({channel.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Adicionar à lista (opcional)
                </label>
                {loadingLists ? (
                  <p className="mt-2 text-sm text-on-surface-variant">Carregando listas...</p>
                ) : (
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className={selectFieldClass}
                  >
                    <option value="">Não adicionar a nenhuma lista</option>
                    {contactLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list._count.members} contatos)
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  Se selecionar uma lista, os contatos importados serão automaticamente adicionados a ela
                </p>
              </div>

              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="sr-only"
              />

              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[rgba(102,221,139,0.35)] bg-surface-container-lowest/80 px-6 py-12 text-center transition-colors hover:border-[#66dd8b]/55 hover:bg-surface-container-highest/40"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined mb-3 text-5xl text-[#66dd8b]">upload_file</span>
                <p className="text-base font-medium text-on-surface">Arraste seu arquivo aqui</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  ou clique para navegar nos seus documentos
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="primary-gradient-channel mt-6 rounded-lg px-6 py-2.5 text-sm font-bold text-[#003919] shadow-forest-glow transition-opacity hover:opacity-95"
                >
                  Escolher arquivo
                </button>
              </div>

              {file && (
                <p className="mt-4 text-sm font-medium text-[#66dd8b]">
                  ✓ Arquivo selecionado: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-outline-variant pt-5 text-xs text-on-surface-variant sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                <span className="inline-flex items-center gap-2">
                  <span className="text-[#66dd8b]">✓</span> Limite: 50.000 linhas
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="text-[#66dd8b]">✓</span> Formatos: .csv, .xlsx
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="text-[#66dd8b]">✓</span> Codificação: UTF-8
                </span>
              </div>

              <button
                type="button"
                onClick={handleImport}
                disabled={loading || !file || !channelId}
                className={
                  loading || !file || !channelId
                    ? 'mt-6 w-full cursor-not-allowed rounded-lg bg-surface-container-highest py-3 text-sm font-bold text-on-surface-variant'
                    : 'primary-gradient-channel mt-6 w-full rounded-lg py-3 text-sm font-bold text-[#003919] shadow-forest-glow transition-opacity hover:opacity-95'
                }
              >
                {loading ? '⏳ Importando...' : 'Importar contatos'}
              </button>

              {error && (
                <div
                  className="mt-5 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  ❌ {error}
                </div>
              )}

              {importResult && (
                <div className="mt-6 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                  <h3 className="font-headline mt-0 text-base font-bold text-on-surface">
                    Resultado da importação
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <div className="min-w-[100px] flex-1 rounded-lg border border-[#66dd8b]/25 bg-emerald-950/30 px-3 py-3 text-center">
                      <div className="text-2xl font-bold text-[#66dd8b]">{importResult.success}</div>
                      <div className="text-xs text-on-surface-variant">Sucessos</div>
                    </div>
                    <div className="min-w-[100px] flex-1 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-3 text-center">
                      <div className="text-2xl font-bold text-red-400">{importResult.errors}</div>
                      <div className="text-xs text-on-surface-variant">Erros</div>
                    </div>
                    <div className="min-w-[100px] flex-1 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-3 text-center">
                      <div className="text-2xl font-bold text-amber-200">{importResult.skipped}</div>
                      <div className="text-xs text-on-surface-variant">Ignorados</div>
                    </div>
                  </div>

                  {importResult.details && importResult.details.length > 0 && (
                    <div className="mt-4 max-h-[300px] overflow-y-auto">
                      <h4 className="mb-2 text-sm font-semibold text-on-surface">Detalhes</h4>
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-outline-variant bg-surface-container-highest text-on-surface-variant">
                            <th className="border border-outline-variant p-2">Linha</th>
                            <th className="border border-outline-variant p-2">Contato</th>
                            <th className="border border-outline-variant p-2">Status</th>
                            <th className="border border-outline-variant p-2">Mensagem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.details.map((detail, index) => (
                            <tr
                              key={index}
                              className={
                                detail.status === 'success'
                                  ? 'bg-emerald-950/15'
                                  : detail.status === 'error'
                                    ? 'bg-red-950/15'
                                    : 'bg-amber-950/15'
                              }
                            >
                              <td className="border border-outline-variant p-2">{detail.row}</td>
                              <td className="border border-outline-variant p-2">{detail.contact}</td>
                              <td className="border border-outline-variant p-2">
                                {detail.status === 'success' ? '✅' : detail.status === 'error' ? '❌' : '⚠️'}
                              </td>
                              <td className="border border-outline-variant p-2">{detail.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {isAutoCreatedPage && (
          <div className="rounded-xl border border-outline-variant bg-[rgba(40,42,40,0.55)] p-6 shadow-forest-glow backdrop-blur-xl">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-headline m-0 text-lg font-bold text-on-surface">
                Contatos criados automaticamente
              </h2>
              <button
                type="button"
                onClick={fetchContacts}
                disabled={loadingContacts}
                className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingContacts ? '⏳ Carregando...' : '🔄 Atualizar'}
              </button>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
              <div className="min-w-[200px] flex-1">
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-[#66dd8b]/50 focus:outline-none focus:ring-1 focus:ring-[#66dd8b]/40"
                />
              </div>
              <div className="min-w-[200px]">
                <select
                  value={filterChannelId}
                  onChange={(e) => setFilterChannelId(e.target.value)}
                  className={selectFieldClassNoMt}
                >
                  <option value="">Todos os canais</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} ({channel.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingContacts ? (
              <div className="py-10 text-center text-on-surface-variant">⏳ Carregando contatos...</div>
            ) : contacts.length === 0 ? (
              <div className="py-10 text-center text-on-surface-variant">📭 Nenhum contato encontrado</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-outline-variant">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-highest text-left text-on-surface-variant">
                      <th className="border-b border-outline-variant px-3 py-3 font-semibold">Nome</th>
                      <th className="border-b border-outline-variant px-3 py-3 font-semibold">Telefone</th>
                      <th className="border-b border-outline-variant px-3 py-3 font-semibold">Email</th>
                      <th className="border-b border-outline-variant px-3 py-3 font-semibold">Canal</th>
                      <th className="border-b border-outline-variant px-3 py-3 font-semibold">Conversas</th>
                      <th className="border-b border-outline-variant px-3 py-3 font-semibold">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr
                        key={contact.id}
                        className={
                          contact._count?.conversations && contact._count.conversations > 0
                            ? 'border-b border-outline-variant bg-emerald-950/10'
                            : 'border-b border-outline-variant bg-surface-container-low/30'
                        }
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {contact.profilePicture ? (
                              <img
                                src={contact.profilePicture}
                                alt={contact.name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-[#66dd8b]">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-on-surface">{contact.name}</span>
                            {contact._count?.conversations && contact._count.conversations > 0 && (
                              <span className="rounded-full bg-[#66dd8b]/20 px-2 py-0.5 text-[10px] font-bold text-[#66dd8b]">
                                ✓ Ativo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-on-surface-variant">{contact.phone || '-'}</td>
                        <td className="px-3 py-3 text-on-surface-variant">{contact.email || '-'}</td>
                        <td className="px-3 py-3">
                          {contact.channel ? (
                            <span className="rounded-md border border-secondary/30 bg-secondary/10 px-2 py-1 text-xs text-secondary">
                              {contact.channel.name}
                            </span>
                          ) : (
                            <span className="text-xs text-on-surface-variant">Sem canal</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">{contact._count?.conversations || 0}</td>
                        <td className="px-3 py-3 text-xs text-on-surface-variant">
                          {formatDate(contact.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {contacts.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-6 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-secondary">{contacts.length}</div>
                  <div className="text-xs text-on-surface-variant">Total de contatos</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-[#66dd8b]">
                    {contacts.filter((c) => c._count?.conversations && c._count.conversations > 0).length}
                  </div>
                  <div className="text-xs text-on-surface-variant">Com conversas</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-outline-variant bg-[rgba(40,42,40,0.55)] p-6 shadow-forest-glow backdrop-blur-xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-headline m-0 text-lg font-bold text-on-surface">Listas de contatos</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchContactLists}
                disabled={loadingLists}
                className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingLists ? '⏳ Carregando...' : '🔄 Atualizar listas'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/contact-lists')}
                className="primary-gradient-channel rounded-lg px-4 py-2 text-sm font-bold text-[#003919] shadow-forest-glow hover:opacity-95"
              >
                Gerenciar listas
              </button>
            </div>
          </div>

          {loadingLists ? (
            <div className="py-8 text-center text-on-surface-variant">Carregando listas...</div>
          ) : contactLists.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant">
              Nenhuma lista criada ainda. Clique em <strong className="text-on-surface">Gerenciar listas</strong>{' '}
              para criar.
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {contactLists.map((list) => (
                <div
                  key={list.id}
                  className="flex min-w-[220px] flex-1 items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3"
                >
                  <div
                    className="h-10 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: list.color || '#66dd8b' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-on-surface">{list.name}</div>
                    {list.description && (
                      <div className="text-xs text-on-surface-variant">{list.description}</div>
                    )}
                    <div className="text-xs text-on-surface-variant">
                      {list._count?.members ?? 0} contato(s)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
