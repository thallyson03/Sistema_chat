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
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Carregando listas...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-50">
      {/* Lateral esquerda: lista de listas */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Listas de Contatos</h1>
          <p className="text-xs text-gray-500">Organize contatos em listas para segmentação</p>
        </div>

        <div className="p-4 border-b border-gray-200">
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="w-full"
          >
            ➕ Nova Lista
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lists.length === 0 && (
            <p className="text-xs text-gray-500">Nenhuma lista criada ainda.</p>
          )}
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => handleSelectList(list)}
              className={`w-full text-left px-3 py-2 rounded border text-sm mb-1 ${
                selectedList?.id === list.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: list.color }}
                />
                <div className="flex-1">
                  <div className="font-semibold truncate">{list.name}</div>
                  <div className="text-[11px] text-gray-500 mt-1">
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
                  <h2 className="text-2xl font-bold text-gray-800">{selectedList.name}</h2>
                </div>
                {selectedList.description && (
                  <p className="text-gray-600 mb-2">{selectedList.description}</p>
                )}
                <p className="text-sm text-gray-500">
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
              <div className="text-center py-8 text-gray-500">Carregando contatos...</div>
            ) : listContacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">Esta lista está vazia.</p>
                <p className="text-sm">Clique em "Adicionar Contatos" para começar.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Telefone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Canal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {listContacts.map((contact) => (
                      <tr key={contact.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {contact.profilePicture ? (
                              <img
                                src={contact.profilePicture}
                                alt={contact.name}
                                className="h-8 w-8 rounded-full mr-3"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold mr-3">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {contact.phone || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {contact.email || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {contact.channel.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleRemoveContact(contact.id)}
                            className="text-red-600 hover:text-red-800"
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
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Nenhuma lista selecionada</p>
            <p className="text-sm">Selecione uma lista à esquerda ou crie uma nova.</p>
          </div>
        )}
      </div>

      {/* Modal de criar lista */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Nova Lista</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Lista *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Clientes VIP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Descrição opcional da lista"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cor
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="default"
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
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Adicionar Contatos - {selectedList.name}
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                Selecione os contatos que deseja adicionar a esta lista:
              </p>
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                {contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center p-3 hover:bg-gray-50 rounded cursor-pointer"
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
                      <div className="font-medium text-gray-800">{contact.name}</div>
                      {contact.phone && (
                        <div className="text-sm text-gray-600">{contact.phone}</div>
                      )}
                      {contact.email && (
                        <div className="text-sm text-gray-600">{contact.email}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-4">
                {selectedContactIds.length} contato(s) selecionado(s)
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="default"
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

