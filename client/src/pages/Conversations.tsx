import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';

interface Conversation {
  id: string;
  channelId: string;
  contact: {
    id: string;
    name: string;
    phone?: string;
  };
  lastMessage: string;
  status: string;
  unreadCount: number;
  channel: {
    id: string;
    name: string;
    type: string;
  };
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations();

    // Conectar ao Socket.IO para atualizações em tempo real
    const socket: Socket = io('http://localhost:3007', {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('✅ Conectado ao Socket.IO');
    });

    socket.on('new_message', async (data: { conversationId: string; channelId: string }) => {
      console.log('📨 Nova mensagem recebida via Socket.IO:', data);
      // Atualizar lista de conversas quando uma nova mensagem chegar
      await fetchConversations();
    });

    socket.on('conversation_updated', async () => {
      console.log('🔄 Conversa atualizada via Socket.IO');
      // Atualizar lista de conversas
      await fetchConversations();
    });

    socket.on('disconnect', () => {
      console.log('❌ Desconectado do Socket.IO');
    });

    // Limpar conexão ao desmontar componente
    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await api.get('/api/conversations');
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    navigate(`/conversations/${conversationId}`);
  };

  if (loading) {
    return <div>Carregando conversas...</div>;
  }

  return (
    <div>
      <h1>Conversas</h1>
      {conversations.length === 0 ? (
        <p style={{ marginTop: '20px', color: '#6b7280' }}>
          Nenhuma conversa encontrada.
        </p>
      ) : (
        <div style={{ marginTop: '20px' }}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleConversationClick(conv.id)}
              style={{
                backgroundColor: 'white',
                padding: '15px',
                marginBottom: '10px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{conv.contact.name}</h3>
                  <p style={{ color: '#6b7280', marginTop: '5px', marginBottom: '5px' }}>
                    {conv.channel.name} • {conv.contact.phone || 'Sem telefone'}
                  </p>
                  <p style={{ color: '#6b7280', marginTop: '5px', fontSize: '14px' }}>
                    {conv.lastMessage || 'Sem mensagens'}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#e5e7eb',
                      fontSize: '12px',
                    }}
                  >
                    {conv.status}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      {conv.unreadCount} não lidas
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
