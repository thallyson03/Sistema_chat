import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function ContactImport() {
  const navigate = useNavigate();
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

  // Carregar canais e contatos ao montar componente
  useEffect(() => {
    fetchChannels();
    fetchContacts();
    fetchContactLists();
  }, []);

  // Recarregar contatos quando filtros mudarem
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchContacts();
    }, 500); // Debounce de 500ms

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const fileName = selectedFile.name.toLowerCase();
      
      // Validar extensão
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
        setError('Apenas arquivos Excel (.xlsx, .xls) ou CSV são permitidos');
        return;
      }

      setFile(selectedFile);
      setError('');
      setImportResult(null);
    }
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
      setSelectedListId(''); // Limpar seleção de lista
      
      // Limpar input de arquivo
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      // Recarregar lista de contatos e listas após importação
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

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Importar Contatos</h1>
        <button
          onClick={() => navigate('/conversations')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          ← Voltar
        </button>
      </div>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        {/* Informações */}
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f3f4f6', borderRadius: '5px' }}>
          <h3 style={{ marginTop: 0 }}>📋 Formato do Arquivo</h3>
          <p style={{ margin: '5px 0' }}>
            O arquivo Excel (.xlsx) ou CSV deve conter as seguintes colunas:
          </p>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li><strong>name</strong> (obrigatório) - Nome do contato</li>
            <li><strong>phone</strong> (obrigatório) - Telefone do contato</li>
            <li><strong>email</strong> (opcional) - E-mail do contato</li>
          </ul>
          <button
            onClick={handleDownloadTemplate}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            📥 Baixar Template Excel (.xlsx)
          </button>
        </div>

        {/* Seleção de Canal */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Canal *
          </label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #d1d5db',
              borderRadius: '5px',
              fontSize: '14px',
            }}
          >
            <option value="">Selecione um canal</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name} ({channel.type})
              </option>
            ))}
          </select>
        </div>

        {/* Seleção de Lista (Opcional) */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Adicionar à Lista (Opcional)
          </label>
          {loadingLists ? (
            <p style={{ fontSize: '14px', color: '#6b7280' }}>Carregando listas...</p>
          ) : (
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                fontSize: '14px',
                backgroundColor: 'white',
              }}
            >
              <option value="">Não adicionar a nenhuma lista</option>
              {contactLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list._count.members} contatos)
                </option>
              ))}
            </select>
          )}
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Se selecionar uma lista, os contatos importados serão automaticamente adicionados a ela
          </p>
        </div>

        {/* Upload de Arquivo */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Arquivo Excel ou CSV *
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #d1d5db',
              borderRadius: '5px',
              fontSize: '14px',
            }}
          />
          {file && (
            <p style={{ marginTop: '8px', color: '#059669', fontSize: '14px' }}>
              ✓ Arquivo selecionado: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {/* Erro */}
        {error && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '5px',
            fontSize: '14px',
          }}>
            ❌ {error}
          </div>
        )}

        {/* Botão de Importar */}
        <button
          onClick={handleImport}
          disabled={loading || !file || !channelId}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading || !file || !channelId ? '#9ca3af' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading || !file || !channelId ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ Importando...' : '📤 Importar Contatos'}
        </button>

        {/* Resultado da Importação */}
        {importResult && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '5px' }}>
            <h3 style={{ marginTop: 0 }}>📊 Resultado da Importação</h3>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', backgroundColor: '#d1fae5', borderRadius: '5px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                  {importResult.success}
                </div>
                <div style={{ fontSize: '12px', color: '#065f46' }}>Sucessos</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', backgroundColor: '#fee2e2', borderRadius: '5px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>
                  {importResult.errors}
                </div>
                <div style={{ fontSize: '12px', color: '#991b1b' }}>Erros</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px', backgroundColor: '#fef3c7', borderRadius: '5px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>
                  {importResult.skipped}
                </div>
                <div style={{ fontSize: '12px', color: '#92400e' }}>Ignorados</div>
              </div>
            </div>

            {/* Detalhes */}
            {importResult.details && importResult.details.length > 0 && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '15px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>Detalhes:</h4>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e5e7eb', textAlign: 'left' }}>
                      <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Linha</th>
                      <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Contato</th>
                      <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Status</th>
                      <th style={{ padding: '8px', border: '1px solid #d1d5db' }}>Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.details.map((detail, index) => (
                      <tr key={index} style={{ backgroundColor: detail.status === 'success' ? '#d1fae5' : detail.status === 'error' ? '#fee2e2' : '#fef3c7' }}>
                        <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{detail.row}</td>
                        <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{detail.contact}</td>
                        <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>
                          {detail.status === 'success' ? '✅' : detail.status === 'error' ? '❌' : '⚠️'}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{detail.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de Contatos */}
      <div style={{ marginTop: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>📋 Contatos Criados Automaticamente</h2>
          <button
            onClick={fetchContacts}
            disabled={loadingContacts}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loadingContacts ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            {loadingContacts ? '⏳ Carregando...' : '🔄 Atualizar'}
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                fontSize: '14px',
              }}
            />
          </div>
          <div style={{ minWidth: '200px' }}>
            <select
              value={filterChannelId}
              onChange={(e) => setFilterChannelId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                fontSize: '14px',
              }}
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

        {/* Lista de Contatos */}
        {loadingContacts ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            ⏳ Carregando contatos...
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            📭 Nenhum contato encontrado
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb', fontWeight: 'bold' }}>Nome</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb', fontWeight: 'bold' }}>Telefone</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb', fontWeight: 'bold' }}>Email</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb', fontWeight: 'bold' }}>Canal</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb', fontWeight: 'bold' }}>Conversas</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb', fontWeight: 'bold' }}>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: contact._count?.conversations && contact._count.conversations > 0 ? '#f0fdf4' : 'white',
                    }}
                  >
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {contact.profilePicture ? (
                          <img
                            src={contact.profilePicture}
                            alt={contact.name}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '12px',
                            }}
                          >
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: '500' }}>{contact.name}</span>
                        {contact._count?.conversations && contact._count.conversations > 0 && (
                          <span
                            style={{
                              padding: '2px 8px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                            }}
                          >
                            ✓ Ativo
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>
                      {contact.phone || '-'}
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>
                      {contact.email || '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {contact.channel.name}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {contact._count?.conversations || 0}
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280', fontSize: '12px' }}>
                      {formatDate(contact.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Estatísticas */}
        {contacts.length > 0 && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '5px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>
                {contacts.length}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Total de Contatos</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                {contacts.filter(c => c._count?.conversations && c._count.conversations > 0).length}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Com Conversas</div>
            </div>
          </div>
        )}
      </div>

      {/* Listas de Contatos (resumo + atalho para gerenciar) */}
      <div style={{ marginTop: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>📂 Listas de Contatos</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchContactLists}
              disabled={loadingLists}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loadingLists ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {loadingLists ? '⏳ Carregando...' : '🔄 Atualizar listas'}
            </button>
            <button
              onClick={() => navigate('/contact-lists')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ⚙️ Gerenciar Listas
            </button>
          </div>
        </div>

        {loadingLists ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            Carregando listas...
          </div>
        ) : contactLists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            Nenhuma lista criada ainda. Clique em <strong>Gerenciar Listas</strong> para criar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            {contactLists.map((list) => (
              <div
                key={list.id}
                style={{
                  flex: '1 1 220px',
                  minWidth: '220px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#f9fafb',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '40px',
                    borderRadius: '999px',
                    backgroundColor: list.color || '#3b82f6',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                    {list.name}
                  </div>
                  {list.description && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      {list.description}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#4b5563' }}>
                    {list._count?.members ?? 0} contato(s)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

