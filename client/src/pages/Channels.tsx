import { useEffect, useState } from 'react';
import api from '../utils/api';

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
  evolutionApiKey?: string;
  evolutionInstanceId?: string;
}

export default function Channels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'WHATSAPP',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      setChannels(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/api/channels', formData);
      setShowModal(false);
      setFormData({ name: '', type: 'WHATSAPP' });
      fetchChannels();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar canal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshStatus = async (channelId: string) => {
    try {
      await api.get(`/api/channels/${channelId}/status`);
      fetchChannels(); // Recarregar lista
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar status');
    }
  };

  const handleViewQRCode = async (channelId: string) => {
    try {
      const response = await api.get(`/api/channels/${channelId}/qrcode`);
      if (response.data.qrcode) {
        setQrCode(response.data.qrcode);
        setShowQRModal(true);
        startConnectionCheck(channelId);
      } else {
        alert('QR Code ainda não disponível. Aguarde alguns segundos.');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao obter QR Code');
    }
  };

  const startConnectionCheck = (channelId: string) => {
    setCheckingConnection(true);
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/api/channels/${channelId}/status`);
        const status = response.data.status;
        
        if (status === 'ACTIVE' || status === 'open' || status === 'connected') {
          // Conexão estabelecida!
          clearInterval(interval);
          setCheckingConnection(false);
          setShowQRModal(false);
          setQrCode(null);
          
          // Atualizar lista de canais
          await fetchChannels();
          
          alert('✅ WhatsApp conectado com sucesso!');
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 3000); // Verificar a cada 3 segundos

    // Limpar intervalo após 5 minutos (300 segundos)
    setTimeout(() => {
      clearInterval(interval);
      setCheckingConnection(false);
    }, 300000);
  };

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o canal "${channelName}"?\n\nEsta ação não pode ser desfeita e também excluirá a instância na Evolution API se existir.`)) {
      return;
    }

    try {
      console.log('🗑️ Excluindo canal:', channelId, channelName);
      const response = await api.delete(`/api/channels/${channelId}`);
      console.log('✅ Canal excluído com sucesso:', response.data);
      alert('Canal excluído com sucesso!');
      fetchChannels();
    } catch (error: any) {
      console.error('❌ Erro ao excluir canal:', error);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao excluir canal';
      alert(`Erro ao excluir canal: ${errorMessage}`);
    }
  };

  if (loading) {
    return <div>Carregando canais...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Canais</h1>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Novo Canal
        </button>
      </div>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '10px',
              width: '500px',
              maxWidth: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Criar Novo Canal</h2>
            <form onSubmit={handleCreateChannel}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Nome do Canal
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                  }}
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="EMAIL">Email</option>
                  <option value="WEBCHAT">Webchat</option>
                </select>
              </div>


              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQRModal && qrCode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001,
          }}
          onClick={() => {
            if (!checkingConnection) {
              setShowQRModal(false);
              setQrCode(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '15px',
              width: '450px',
              maxWidth: '90%',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: '#25D366' }}>📱 Conectar WhatsApp</h2>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
              Escaneie este QR Code com o WhatsApp
            </p>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: '20px',
              padding: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '10px',
            }}>
              <img 
                src={qrCode} 
                alt="QR Code" 
                style={{ 
                  maxWidth: '100%', 
                  height: 'auto',
                  border: '3px solid #25D366', 
                  borderRadius: '10px',
                }} 
              />
            </div>
            {checkingConnection && (
              <div style={{ 
                marginTop: '15px', 
                padding: '10px',
                backgroundColor: '#eff6ff',
                borderRadius: '5px',
                color: '#1e40af',
                fontSize: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #1e40af',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}></div>
                  Aguardando conexão...
                </div>
              </div>
            )}
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setQrCode(null);
                  setCheckingConnection(false);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      )}

      {channels.length === 0 ? (
        <p style={{ marginTop: '20px', color: '#6b7280' }}>
          Nenhum canal configurado.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
            marginTop: '20px',
          }}
        >
          {channels.map((channel) => (
            <div
              key={channel.id}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '10px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              }}
            >
              <h3>{channel.name}</h3>
              <p style={{ color: '#6b7280', marginTop: '5px' }}>
                Tipo: {channel.type}
              </p>
              <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    backgroundColor:
                      channel.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                    color: 'white',
                    fontSize: '12px',
                  }}
                >
                  {channel.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </span>
                
                {channel.type === 'WHATSAPP' && (
                  <>
                    <button
                      onClick={() => handleRefreshStatus(channel.id)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Atualizar Status
                    </button>
                    <button
                      onClick={() => handleViewQRCode(channel.id)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Ver QR Code
                    </button>
                  </>
                )}
              </div>
              
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => handleDeleteChannel(channel.id, channel.name)}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    width: '100%',
                  }}
                >
                  Excluir Canal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
