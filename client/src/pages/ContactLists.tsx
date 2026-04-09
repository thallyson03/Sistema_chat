import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { Button } from '../components/ui/Button';

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

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  profilePicture?: string;
  channel: {
    id: string;
    name: string;
    type: string;
  };
}

export default function ContactLists() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddContactsModal, setShowAddContactsModal] = useState(false);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [listContacts, setListContacts] = useState<Contact[]>([]);
  const [loadingListContacts, setLoadingListContacts] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });

  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  useEffect(() => {
    fetchLists();
    fetchContacts();
  }, []);

  const fetchLists = async () => {
    try {
      const response = await api.get('/api/contact-lists');
      setLists(response.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar listas:', error);
      alert('Erro ao carregar listas: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await api.get('/api/contacts', { params: { limit: 1000 } });
      setContacts(response.data?.contacts || response.data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  };

  const fetchListContacts = async (listId: string) => {
    setLoadingListContacts(true);
    try {
      const response = await api.get(`/api/contact-lists/${listId}/contacts`);
      setListContacts(response.data?.members?.map((m: any) => m.contact) || []);
    } catch (error: any) {
      console.error('Erro ao carregar contatos da lista:', error);
      alert('Erro ao carregar contatos: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadingListContacts(false);
    }
  };

  const handleCreateList = async () => {
    if (!formData.name.trim()) {
      alert('Informe um nome para a lista');
      return;
    }

    try {
      await api.post('/api/contact-lists', {
        name: formData.name.trim(),
        description: formData.description || null,
        color: formData.color,
      });
      await fetchLists();
      setShowCreateModal(false);
      setFormData({ name: '', description: '', color: '#3B82F6' });
      alert('Lista criada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar lista:', error);
      alert('Erro ao criar lista: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Deseja realmente deletar esta lista? Todos os contatos serão removidos.')) {
      return;
    }

    try {
      await api.delete(`/api/contact-lists/${listId}`);
      await fetchLists();
      if (selectedList?.id === listId) {
        setSelectedList(null);
        setListContacts([]);
      }
      alert('Lista deletada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar lista:', error);
      alert('Erro ao deletar lista: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddContacts = async () => {
    if (!selectedList || selectedContactIds.length === 0) {
      alert('Selecione pelo menos um contato');
      return;
    }

    try {
      await api.post(`/api/contact-lists/${selectedList.id}/contacts`, {
        contactIds: selectedContactIds,
      });
      await fetchListContacts(selectedList.id);
      setShowAddContactsModal(false);
      setSelectedContactIds([]);
      await fetchLists(); // Atualizar contagem
      alert('Contatos adicionados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar contatos:', error);
      alert('Erro ao adicionar contatos: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!selectedList) return;

    if (!confirm('Deseja remover este contato da lista?')) {
      return;
    }

    try {
      await api.delete(`/api/contact-lists/${selectedList.id}/contacts`, {
        data: { contactIds: [contactId] },
      });
      await fetchListContacts(selectedList.id);
      await fetchLists(); // Atualizar contagem
      alert('Contato removido com sucesso!');
    } catch (error: any) {
      console.error('Erro ao remover contato:', error);
      alert('Erro ao remover contato: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSelectList = async (list: ContactList) => {
    setSelectedList(list);
    await fetchListContacts(list.id);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-60px)] items-center justify-center bg-surface font-body text-on-surface-variant">
        <div className="text-base">Carregando listas...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-60px)] bg-surface font-body text-on-surface">
      {/* Lateral esquerda: lista de listas */}
      <div className="flex w-80 flex-col border-r border-outline-variant bg-surface-container-low">
        <div className="glass-channel-card border-b border-outline-variant p-4">
          <h1 className="mb-1 font-headline text-xl font-bold text-on-surface">Listas de Contatos</h1>
          <p className="text-xs text-on-surface-variant">Organize contatos em listas para segmentação</p>
        </div>

        <div className="border-b border-outline-variant p-4">
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="w-full"
          >
            ➕ Nova Lista
          </Button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {lists.length === 0 && (
            <p className="text-xs text-on-surface-variant">Nenhuma lista criada ainda.</p>
          )}
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => handleSelectList(list)}
              className={`mb-1 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedList?.id === list.id
                  ? 'border-primary/45 bg-primary/10 text-primary-fixed-dim'
                  : 'border-outline-variant bg-surface-container hover:bg-surface-container-highest'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: list.color }}
                />
                <div className="flex-1">
                  <div className="font-semibold truncate">{list.name}</div>
                  <div className="mt-1 text-[11px] text-on-surface-variant">
                    {list._count.members} contato(s)
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Centro: detalhes da lista selecionada */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedList ? (
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedList.color }}
                  />
                  <h2 className="text-2xl font-bold text-on-surface">{selectedList.name}</h2>
                </div>
                {selectedList.description && (
                  <p className="mb-2 text-on-surface-variant">{selectedList.description}</p>
                )}
                <p className="text-sm text-on-surface-variant">
                  {selectedList._count.members} contato(s) nesta lista
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowAddContactsModal(true);
                  }}
                >
                  ➕ Adicionar Contatos
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDeleteList(selectedList.id)}
                >
                  🗑️ Deletar Lista
                </Button>
              </div>
            </div>

            {loadingListContacts ? (
              <div className="py-8 text-center text-on-surface-variant">Carregando contatos...</div>
            ) : listContacts.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant">
                <p className="mb-2">Esta lista está vazia.</p>
                <p className="text-sm">Clique em "Adicionar Contatos" para começar.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low shadow-forest-glow">
                <table className="min-w-full divide-y divide-outline-variant">
                  <thead className="bg-surface-container-high">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Telefone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Canal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant bg-surface-container-low">
                    {listContacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-surface-container-highest/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {contact.profilePicture ? (
                              <img
                                src={contact.profilePicture}
                                alt={contact.name}
                                className="h-8 w-8 rounded-full mr-3"
                              />
                            ) : (
                              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-xs font-semibold text-primary-fixed-dim">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="text-sm font-medium text-on-surface">{contact.name}</div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-on-surface-variant">
                          {contact.phone || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-on-surface-variant">
                          {contact.email || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-on-surface-variant">
                          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs text-primary-fixed-dim">
                            {contact.channel.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <button
                            onClick={() => handleRemoveContact(contact.id)}
                            className="text-red-400 transition-colors hover:text-red-300"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-on-surface-variant">
            <p className="text-lg mb-2">Nenhuma lista selecionada</p>
            <p className="text-sm">Selecione uma lista à esquerda ou crie uma nova.</p>
          </div>
        )}
      </div>

      {/* Modal de criar lista */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-highest p-8 text-on-surface shadow-forest-glow"
          >
            <h2 className="mb-6 text-2xl font-bold text-on-surface">Nova Lista</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-on-surface-variant">
                  Nome da Lista *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Ex: Clientes VIP"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-on-surface-variant">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  rows={3}
                  placeholder="Descrição opcional da lista"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-on-surface-variant">
                  Cor
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', description: '', color: '#3B82F6' });
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleCreateList}>
                Criar Lista
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de adicionar contatos */}
      {showAddContactsModal && selectedList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-highest p-8 text-on-surface shadow-forest-glow"
          >
            <h2 className="mb-6 text-2xl font-bold text-on-surface">
              Adicionar Contatos - {selectedList.name}
            </h2>

            <div className="mb-4">
              <p className="mb-4 text-sm text-on-surface-variant">
                Selecione os contatos que deseja adicionar a esta lista:
              </p>
              <div className="max-h-96 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-low p-4">
                {contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center rounded p-3 hover:bg-surface-container-highest"
                  >
                    <input
                      type="checkbox"
                      checked={selectedContactIds.includes(contact.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContactIds([...selectedContactIds, contact.id]);
                        } else {
                          setSelectedContactIds(selectedContactIds.filter((id) => id !== contact.id));
                        }
                      }}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-on-surface">{contact.name}</div>
                      {contact.phone && (
                        <div className="text-sm text-on-surface-variant">{contact.phone}</div>
                      )}
                      {contact.email && (
                        <div className="text-sm text-on-surface-variant">{contact.email}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-4 text-sm text-primary/80">
                {selectedContactIds.length} contato(s) selecionado(s)
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddContactsModal(false);
                  setSelectedContactIds([]);
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleAddContacts}>
                Adicionar Contatos
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

