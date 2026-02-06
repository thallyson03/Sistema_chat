import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';

// Componente de Player de Áudio estilo WhatsApp
function AudioPlayer({ 
  src, 
  duration, 
  isUserMessage, 
  messageId 
}: { 
  src: string; 
  duration?: number; 
  isUserMessage: boolean;
  messageId: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      const dur = audio.duration || duration || 0;
      setTotalDuration(dur);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Se duration foi passado como prop, usar diretamente
    if (duration && duration > 0) {
      setTotalDuration(duration);
    }

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [duration]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error('Erro ao reproduzir áudio:', err);
      });
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    audio.currentTime = percentage * audio.duration;
  };

  const progressPercentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Cores estilo WhatsApp
  const playButtonBg = isUserMessage ? 'rgba(255,255,255,0.25)' : '#25D366';
  const playButtonIcon = isUserMessage ? 'white' : 'white';
  const progressBg = isUserMessage ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)';
  const progressFill = isUserMessage ? 'white' : '#25D366';
  const textColor = isUserMessage ? 'rgba(255,255,255,0.95)' : '#111b21';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 8px',
      minWidth: '180px',
      maxWidth: '280px',
    }}>
      {/* Botão Play/Pause - estilo WhatsApp */}
      <button
        onClick={togglePlayPause}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: playButtonBg,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
          outline: 'none',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.opacity = '1';
        }}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill={playButtonIcon} style={{ marginLeft: '1px' }}>
            <rect x="6" y="4" width="3" height="16" rx="1" />
            <rect x="13" y="4" width="3" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill={playButtonIcon} style={{ marginLeft: '2px' }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Barra de progresso e tempo */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Barra de progresso - estilo WhatsApp */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          style={{
            width: '100%',
            height: '2px',
            backgroundColor: progressBg,
            borderRadius: '1px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercentage}%`,
              height: '100%',
              backgroundColor: progressFill,
              borderRadius: '1px',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {/* Tempo - estilo WhatsApp */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: '500',
          color: textColor,
          letterSpacing: '0.3px',
        }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(Math.floor(currentTime))}
          </span>
          <span style={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
            {totalDuration > 0 ? formatDuration(Math.floor(totalDuration)) : (duration ? formatDuration(duration) : '--:--')}
          </span>
        </div>
      </div>

      {/* Audio element (oculto) */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onError={(e) => {
          console.error('❌ Erro ao carregar áudio:', messageId, e);
        }}
      />
    </div>
  );
}

interface Message {
  id: string;
  content: string;
  type: string;
  status: string;
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

// Função para obter ícone de status (como WhatsApp)
function getStatusIcon(status: string) {
  switch (status) {
    case 'PENDING':
      return <span style={{ color: '#9ca3af' }}>⏱</span>; // Relógio - aguardando envio
    case 'SENT':
      return <span style={{ color: '#9ca3af' }}>✓</span>; // Check simples - enviado
    case 'DELIVERED':
      return <span style={{ color: '#9ca3af' }}>✓✓</span>; // Dois checks - entregue
    case 'READ':
      return <span style={{ color: '#3b82f6' }}>✓✓</span>; // Dois checks azuis - lido
    case 'FAILED':
      return <span style={{ color: '#ef4444' }}>✗</span>; // X vermelho - falhou
    default:
      return <span style={{ color: '#9ca3af' }}>⏱</span>;
  }
}

// Função para formatar duração (segundos para mm:ss)
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Função para formatar tamanho de arquivo
function formatFileSize(bytes: string | number): string {
  const numBytes = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (!numBytes || isNaN(numBytes)) return '';
  
  if (numBytes < 1024) return `${numBytes} B`;
  if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(1)} KB`;
  return `${(numBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Função para fazer scroll até o final
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (id) {
      fetchConversation();
      fetchMessages();
    }

    // Conectar ao Socket.IO para atualizações em tempo real
    const socket: Socket = io('http://localhost:3007', {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('✅ [ConversationDetail] Conectado ao Socket.IO');
    });

    socket.on('new_message', async (data: { conversationId: string; channelId: string }) => {
      console.log('📨 [ConversationDetail] Nova mensagem recebida via Socket.IO:', data);
      if (data.conversationId === id) {
        // Recarregar mensagens quando uma nova chegar nesta conversa
        await fetchMessages();
        // Scroll para o final após um pequeno delay para garantir que a mensagem foi renderizada
        setTimeout(scrollToBottom, 100);
      }
    });

    socket.on('conversation_updated', async (data: { conversationId: string; channelId: string }) => {
      console.log('🔄 [ConversationDetail] Conversa atualizada via Socket.IO:', data);
      if (data.conversationId === id) {
        await fetchMessages();
        await fetchConversation();
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ [ConversationDetail] Desconectado do Socket.IO');
    });

    // Limpar conexão ao desmontar componente
    return () => {
      socket.disconnect();
    };
  }, [id]);

  // Scroll automático quando mensagens mudarem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    const messageContent = newMessage;
    setNewMessage(''); // Limpar campo imediatamente para melhor UX
    
    // Adicionar mensagem otimisticamente com status PENDING
    const tempMessageId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempMessageId,
      content: messageContent,
      type: 'TEXT',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      user: {
        id: 'current-user',
        name: 'Você',
      },
    };
    setMessages(prev => [...prev, tempMessage]);
    
    try {
      console.log('📤 [Frontend] Enviando mensagem...', {
        conversationId: id,
        content: messageContent.substring(0, 50),
        type: 'TEXT',
      });
      
      const response = await api.post('/api/messages', {
        conversationId: id,
        content: messageContent,
        type: 'TEXT',
      });
      
      console.log('✅ [Frontend] Mensagem enviada com sucesso:', response.data);
      
      // Atualizar mensagem temporária com a real
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId
          ? { ...response.data, user: tempMessage.user }
          : msg
      ));
      
      // Recarregar mensagens para garantir sincronização
      await fetchMessages();
      await fetchConversation();
    } catch (error: any) {
      console.error('❌ [Frontend] Erro ao enviar mensagem:', error);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
      
      // Remover mensagem temporária em caso de erro
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
      
      // Restaurar mensagem no campo
      setNewMessage(messageContent);
      
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao enviar mensagem';
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'Sem detalhes';
      alert(`Erro ao enviar mensagem: ${errorMessage}\n\nDetalhes:\n${errorDetails}`);
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
        ref={messagesContainerRef}
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
          <>
            {messages.map((message) => (
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
                      <div style={{ position: 'relative' }}>
                        <img
                          src={`http://localhost:3007/api/media/${message.id}`}
                          alt={message.content || 'Imagem'}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            borderRadius: '8px',
                            objectFit: 'contain',
                            display: 'block',
                            backgroundColor: message.user ? 'rgba(255,255,255,0.1)' : '#f3f4f6',
                          }}
                          onLoad={() => {
                            console.log('✅ Imagem carregada com sucesso:', message.id);
                          }}
                          onError={(e) => {
                            console.error('❌ Erro ao carregar imagem:', message.id, e);
                            const target = e.target as HTMLImageElement;
                            // Fallback: tentar URL direta do metadata se disponível
                            if (message.metadata?.mediaUrl) {
                              if (message.metadata.mediaUrl.startsWith('http')) {
                                target.src = message.metadata.mediaUrl;
                              } else {
                                target.src = `http://localhost:3007${message.metadata.mediaUrl}`;
                              }
                              console.log('🔄 Tentando URL alternativa:', target.src);
                            } else {
                              target.style.display = 'none';
                            }
                          }}
                        />
                        {message.metadata?.mediaMetadata && (
                          <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}>
                            {formatFileSize(message.metadata.mediaMetadata.fileLength)}
                          </div>
                        )}
                      </div>
                    )}
                    {message.type === 'VIDEO' && (
                      <div style={{ position: 'relative' }}>
                        <video
                          src={`http://localhost:3007/api/media/${message.id}`}
                          controls
                          style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            borderRadius: '8px',
                            display: 'block',
                            backgroundColor: '#000',
                          }}
                          onLoadStart={() => {
                            console.log('✅ Vídeo carregando:', message.id);
                          }}
                          onError={(e) => {
                            console.error('❌ Erro ao carregar vídeo:', message.id, e);
                            const target = e.target as HTMLVideoElement;
                            // Fallback: tentar URL direta do metadata se disponível
                            if (message.metadata?.mediaUrl) {
                              if (message.metadata.mediaUrl.startsWith('http')) {
                                target.src = message.metadata.mediaUrl;
                              } else {
                                target.src = `http://localhost:3007${message.metadata.mediaUrl}`;
                              }
                              console.log('🔄 Tentando URL alternativa:', target.src);
                            }
                          }}
                        >
                          Seu navegador não suporta vídeo.
                        </video>
                        {message.metadata?.mediaMetadata && (
                          <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}>
                            {message.metadata.mediaMetadata.seconds && 
                              `${formatDuration(message.metadata.mediaMetadata.seconds)} • `}
                            {formatFileSize(message.metadata.mediaMetadata.fileLength)}
                          </div>
                        )}
                      </div>
                    )}
                    {message.type === 'AUDIO' && (
                      <AudioPlayer 
                        src={`http://localhost:3007/api/media/${message.id}`}
                        duration={message.metadata?.mediaMetadata?.seconds}
                        isUserMessage={!!message.user}
                        messageId={message.id}
                      />
                    )}
                    {/* Exibir conteúdo apenas se não for um placeholder de mídia */}
                    {message.content && 
                     !message.content.match(/^\[(Imagem|Áudio|Vídeo|Video|Documento|Mensagem não suportada)\]/i) && (
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
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {message.user && (
                    <span style={{ marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {getStatusIcon(message.status)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
            <div ref={messagesEndRef} />
          </>
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

