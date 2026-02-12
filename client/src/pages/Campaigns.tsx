import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { Button } from '../components/ui/Button';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  type: 'BROADCAST' | 'SEQUENTIAL';
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  mediaUrl?: string;
  fileName?: string;
  caption?: string;
  scheduledFor?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  channel: {
    id: string;
    name: string;
    type: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [executingCampaign, setExecutingCampaign] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channelId: '',
    content: '',
    messageType: 'TEXT' as 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
    mediaUrl: '',
    fileName: '',
    caption: '',
    scheduledFor: '',
  });

  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  useEffect(() => {
    fetchCampaigns();
    fetchChannels();
    fetchContacts();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/api/campaigns');
      setCampaigns(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar campanhas:', error);
      alert('Erro ao carregar campanhas: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      setChannels(response.data.filter((c: Channel) => c.status === 'ACTIVE'));
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
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

  const handleCreateCampaign = async () => {
    if (!formData.name || !formData.channelId || !formData.content) {
      alert('Preencha todos os campos obrigatórios (Nome, Canal e Conteúdo)');
      return;
    }

    try {
      await api.post('/api/campaigns', {
        ...formData,
        scheduledFor: formData.scheduledFor || null,
      });
      await fetchCampaigns();
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        channelId: '',
        content: '',
        messageType: 'TEXT',
        mediaUrl: '',
        fileName: '',
        caption: '',
        scheduledFor: '',
      });
      alert('Campanha criada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar campanha:', error);
      alert('Erro ao criar campanha: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddRecipients = async () => {
    if (!selectedCampaign || selectedContactIds.length === 0) {
      alert('Selecione pelo menos um contato');
      return;
    }

    try {
      await api.post(`/api/campaigns/${selectedCampaign.id}/recipients`, {
        contactIds: selectedContactIds,
      });
      await fetchCampaigns();
      setShowRecipientsModal(false);
      setSelectedContactIds([]);
      setSelectedCampaign(null);
      alert('Destinatários adicionados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar destinatários:', error);
      alert('Erro ao adicionar destinatários: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleExecuteCampaign = async (campaignId: string) => {
    if (!confirm('Deseja realmente executar esta campanha? As mensagens serão enviadas agora.')) {
      return;
    }

    setExecutingCampaign(campaignId);
    try {
      await api.post(`/api/campaigns/${campaignId}/execute`);
      await fetchCampaigns();
      alert('Campanha executada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao executar campanha:', error);
      alert('Erro ao executar campanha: ' + (error.response?.data?.error || error.message));
    } finally {
      setExecutingCampaign(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Deseja realmente deletar esta campanha?')) {
      return;
    }

    try {
      await api.delete(`/api/campaigns/${campaignId}`);
      await fetchCampaigns();
      alert('Campanha deletada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar campanha:', error);
      alert('Erro ao deletar campanha: ' + (error.response?.data?.error || error.message));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'SENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PAUSED':
        return 'bg-orange-100 text-orange-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Rascunho';
      case 'SCHEDULED':
        return 'Agendada';
      case 'SENDING':
        return 'Enviando';
      case 'PAUSED':
        return 'Pausada';
      case 'COMPLETED':
        return 'Concluída';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Carregando campanhas...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Campanhas</h1>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Nova Campanha
        </Button>
      </div>

      {/* Lista de Campanhas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((campaign) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">{campaign.name}</h3>
                {campaign.description && (
                  <p className="text-sm text-gray-600 mb-2">{campaign.description}</p>
                )}
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(campaign.status)}`}>
                  {getStatusLabel(campaign.status)}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Canal:</strong> {campaign.channel.name}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Tipo:</strong> {campaign.messageType}
              </p>
              <p className="text-sm text-gray-600 line-clamp-2">{campaign.content}</p>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-600">Total</div>
                <div className="font-semibold text-gray-800">{campaign.totalRecipients}</div>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <div className="text-green-600">Enviadas</div>
                <div className="font-semibold text-green-800">{campaign.sentCount}</div>
              </div>
              <div className="bg-blue-50 p-2 rounded">
                <div className="text-blue-600">Entregues</div>
                <div className="font-semibold text-blue-800">{campaign.deliveredCount}</div>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <div className="text-red-600">Falhas</div>
                <div className="font-semibold text-red-800">{campaign.failedCount}</div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2 mt-4">
              {campaign.status === 'DRAFT' && campaign.totalRecipients === 0 && (
                <Button
                  variant="default"
                  onClick={() => {
                    setSelectedCampaign(campaign);
                    setShowRecipientsModal(true);
                  }}
                  className="flex-1 text-sm"
                >
                  📋 Adicionar Destinatários
                </Button>
              )}
              {campaign.status === 'DRAFT' && campaign.totalRecipients > 0 && (
                <Button
                  variant="primary"
                  onClick={() => handleExecuteCampaign(campaign.id)}
                  disabled={executingCampaign === campaign.id}
                  className="flex-1 text-sm"
                >
                  {executingCampaign === campaign.id ? '⏳ Enviando...' : '🚀 Executar'}
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => handleDeleteCampaign(campaign.id)}
                className="text-sm"
              >
                🗑️
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">Nenhuma campanha encontrada</p>
          <p className="text-sm">Crie sua primeira campanha clicando no botão acima</p>
        </div>
      )}

      {/* Modal de Criar Campanha */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Nova Campanha</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Campanha *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Promoção de Verão"
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
                  placeholder="Descrição opcional da campanha"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canal *
                </label>
                <select
                  value={formData.channelId}
                  onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecione um canal</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} ({channel.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Mensagem
                </label>
                <select
                  value={formData.messageType}
                  onChange={(e) => setFormData({ ...formData, messageType: e.target.value as any })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="TEXT">Texto</option>
                  <option value="IMAGE">Imagem</option>
                  <option value="VIDEO">Vídeo</option>
                  <option value="AUDIO">Áudio</option>
                  <option value="DOCUMENT">Documento</option>
                </select>
              </div>

              {formData.messageType !== 'TEXT' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL da Mídia
                    </label>
                    <input
                      type="text"
                      value={formData.mediaUrl}
                      onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://exemplo.com/imagem.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Arquivo
                    </label>
                    <input
                      type="text"
                      value={formData.fileName}
                      onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="imagem.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Legenda
                    </label>
                    <textarea
                      value={formData.caption}
                      onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Legenda para a mídia"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conteúdo da Mensagem *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={5}
                  placeholder="Digite a mensagem que será enviada..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use variáveis como {'{'}nome{'}'} para personalização
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agendar para (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledFor}
                  onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="default"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    name: '',
                    description: '',
                    channelId: '',
                    content: '',
                    messageType: 'TEXT',
                    mediaUrl: '',
                    fileName: '',
                    caption: '',
                    scheduledFor: '',
                  });
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleCreateCampaign}>
                Criar Campanha
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Adicionar Destinatários */}
      {showRecipientsModal && selectedCampaign && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Adicionar Destinatários - {selectedCampaign.name}
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                Selecione os contatos que receberão esta campanha:
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
                  setShowRecipientsModal(false);
                  setSelectedContactIds([]);
                  setSelectedCampaign(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleAddRecipients}>
                Adicionar Destinatários
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}


