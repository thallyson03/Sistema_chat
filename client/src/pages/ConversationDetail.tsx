import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

interface Message {
  id: string;
  content: string;
  type: string;
  metadata?: any;
  createdAt: string;
  user: {
    id: string;
    name: string;
  } | null;
}

interface Conversation {
  id: string;
  contact: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  channel: {
    id: string;
    name: string;
    type: string;
  };
  status: string;
  priority: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (id) {
      fetchConversation();
      fetchMessages();
    }
  }, [id]);

  const fetchConversation = async () => {
    try {
      const response = await api.get(`/api/conversations/${id}`);
      setConversation(response.data);
      // Se a conversa já vier com mensagens, usar elas
      if (response.data.messages) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Erro ao carregar conversa:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/api/messages/conversation/${id}`);
      // A API retorna em ordem desc (mais recentes primeiro), vamos inverter
      const reversedMessages = [...response.data].reverse();
      setMessages(reversedMessages);
      setLoading(false);
      
      // Marcar como lida
      try {
        await api.put(`/api/messages/conversation/${id}/read`);
      } catch (error) {
        // Ignorar erro se não conseguir marcar como lida
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      console.log('📤 Enviando mensagem...', {
        conversationId: id,
        content: newMessage.substring(0, 50),
        type: 'TEXT',
      });
      
      const response = await api.post('/api/messages', {
        conversationId: id,
        content: newMessage,
        type: 'TEXT',
      });
      
      console.log('✅ Mensagem enviada com sucesso:', response.data);
      setNewMessage('');
      fetchMessages();
      fetchConversation();
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
      
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao enviar mensagem';
      alert(`Erro ao enviar mensagem: ${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div>Carregando conversa...</div>;
  }

  if (!conversation) {
    return <div>Conversa não encontrada</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
        <button
          onClick={() => navigate('/conversations')}
          style={{
            marginBottom: '10px',
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
        <h2 style={{ margin: 0 }}>{conversation.contact.name}</h2>
        <p style={{ color: '#6b7280', margin: '5px 0' }}>
          {conversation.channel.name} • {conversation.contact.phone || 'Sem telefone'}
        </p>
        <span
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: '#e5e7eb',
            fontSize: '12px',
            display: 'inline-block',
          }}
        >
          {conversation.status}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#f9fafb',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '20px' }}>
            Nenhuma mensagem ainda.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: '15px',
                display: 'flex',
                justifyContent: message.user ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: message.user ? '#3b82f6' : 'white',
                  color: message.user ? 'white' : '#1f2937',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                }}
              >
                {message.user && (
                  <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '5px' }}>
                    {message.user.name}
                  </div>
                )}
                
                {/* Exibir mídia se for IMAGE, VIDEO ou AUDIO */}
                {['IMAGE', 'VIDEO', 'AUDIO'].includes(message.type) && message.id ? (
                  <div style={{ marginBottom: '8px' }}>
                    {message.type === 'IMAGE' && (
                      <img
                        src={`http://localhost:3007/api/media/${message.id}`}
                        alt={message.content || 'Imagem'}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          borderRadius: '8px',
                          objectFit: 'contain',
                          display: 'block',
                        }}
                        onLoad={() => {
                          console.log('✅ Imagem carregada com sucesso:', message.id);
                        }}
                        onError={(e) => {
                          console.error('❌ Erro ao carregar imagem:', message.id, e);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    {message.type === 'VIDEO' && (
                      <video
                        src={`http://localhost:3007/api/media/${message.id}`}
                        controls
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          borderRadius: '8px',
                          display: 'block',
                        }}
                        onLoadStart={() => {
                          console.log('✅ Vídeo carregando:', message.id);
                        }}
                        onError={(e) => {
                          console.error('❌ Erro ao carregar vídeo:', message.id, e);
                        }}
                      >
                        Seu navegador não suporta vídeo.
                      </video>
                    )}
                    {message.type === 'AUDIO' && (
                      <audio
                        src={`http://localhost:3007/api/media/${message.id}`}
                        controls
                        style={{
                          width: '100%',
                          display: 'block',
                        }}
                        onLoadStart={() => {
                          console.log('✅ Áudio carregando:', message.id);
                        }}
                        onError={(e) => {
                          console.error('❌ Erro ao carregar áudio:', message.id, e);
                        }}
                      >
                        Seu navegador não suporta áudio.
                      </audio>
                    )}
                    {message.content && (
                      <div style={{ marginTop: '8px', fontSize: '14px' }}>
                        {message.content}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>{message.content}</div>
                )}
                
                <div
                  style={{
                    fontSize: '11px',
                    opacity: 0.7,
                    marginTop: '5px',
                    textAlign: 'right',
                  }}
                >
                  {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '20px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white',
          display: 'flex',
          gap: '10px',
        }}
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Digite sua mensagem..."
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '14px',
          }}
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          style={{
            padding: '12px 24px',
            backgroundColor: sending || !newMessage.trim() ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

