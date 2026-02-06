import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import QuickRepliesModal from '../components/QuickRepliesModal';
import { getTimeAgo } from '../utils/timeUtils';

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
  lastCustomerMessageAt?: string;
  lastAgentMessageAt?: string;
  channel: {
    id: string;
    name: string;
    type: string;
  };
}

interface Message {
  id: string;
  content: string;
  type: string;
  status: string;
  userId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  metadata?: {
    mediaUrl?: string;
    fileName?: string;
    caption?: string;
  };
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  // Mantém sempre o ID da conversa selecionada mais recente para usar dentro dos handlers do socket
  const currentConversationIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Atualizar o ref sempre que a conversa selecionada mudar
  useEffect(() => {
    currentConversationIdRef.current = selectedConversation?.id || null;
  }, [selectedConversation]);

  useEffect(() => {
    fetchConversations();
    fetchUsers();

    // Conectar ao Socket.IO para atualizações em tempo real
    const socket: Socket = io('http://localhost:3007', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Conectado ao Socket.IO');
    });

    socket.on('new_message', async (data: { conversationId: string; messageId: string }) => {
      console.log('📨 Nova mensagem recebida via Socket.IO:', data);
      const currentId = currentConversationIdRef.current;

      // Se a mensagem é da conversa atualmente selecionada, buscar novamente as mensagens
      if (currentId && data.conversationId === currentId) {
        await fetchMessages(currentId);
      }
      
      // Atualizar lista de conversas
      await fetchConversations();
    });

    socket.on('conversation_updated', async () => {
      console.log('🔄 Conversa atualizada via Socket.IO');
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

  useEffect(() => {
    // Scroll para última mensagem quando mensagens mudarem
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    // Carregar mensagens quando uma conversa for selecionada
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    // Recarregar conversas quando o filtro mudar
    fetchConversations();
  }, [statusFilter]);

  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      const response = await api.get(`/api/conversations?${params.toString()}`);
      console.log('📥 Resposta da API de conversas:', response.data);
      
      const conversationsData = response.data.conversations || response.data || [];
      console.log(`✅ ${conversationsData.length} conversas carregadas`);
      
      setConversations(conversationsData);
    } catch (error: any) {
      console.error('❌ Erro ao carregar conversas:', error);
      console.error('Detalhes do erro:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      alert('Erro ao carregar conversas. Verifique o console para mais detalhes.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const response = await api.get(`/api/messages/conversation/${conversationId}`);
      // Inverter ordem para mostrar mensagens mais antigas primeiro
      const messagesData = response.data || [];
      setMessages(messagesData.reverse());
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleConversationClick = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setMessages([]);
  };

  const handleSendMessage = async (e: React.FormEvent, mediaUrl?: string, messageType?: string, fileName?: string, caption?: string) => {
    e.preventDefault();
    if ((!messageInput.trim() && !mediaUrl) || !selectedConversation || sending) return;

    setSending(true);
    try {
      await api.post('/api/messages', {
        conversationId: selectedConversation.id,
        content: messageInput.trim() || caption || '',
        type: messageType || 'TEXT',
        mediaUrl,
        fileName,
        caption: messageInput.trim() || caption,
      });

      setMessageInput('');
      setShowEmojiPicker(false);
      // As mensagens serão atualizadas via Socket.IO
      await fetchMessages(selectedConversation.id);
      await fetchConversations();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleQuickReplySelect = (quickReply: any) => {
    // Se tiver mídia, enviar como mídia
    if (quickReply.mediaUrl && quickReply.type !== 'TEXT') {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSendMessage(
        fakeEvent,
        quickReply.mediaUrl,
        quickReply.type,
        quickReply.name,
        quickReply.previewContent || quickReply.content
      );
    } else {
      // Se for texto, colocar no input ou enviar direto
      setMessageInput(quickReply.previewContent || quickReply.content);
      setShowQuickReplies(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await api.post('/api/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { url, mimetype } = uploadResponse.data;
      
      // Determinar tipo de mensagem baseado no mimetype
      let messageType = 'DOCUMENT';
      if (mimetype.startsWith('image/')) {
        messageType = 'IMAGE';
      } else if (mimetype.startsWith('video/')) {
        messageType = 'VIDEO';
      } else if (mimetype.startsWith('audio/')) {
        messageType = 'AUDIO';
      }

      // Enviar mensagem com mídia (incluindo mimetype para envio correto)
      await api.post('/api/messages', {
        conversationId: selectedConversation.id,
        content: messageInput.trim() || file.name,
        type: messageType,
        mediaUrl: url,
        fileName: file.name,
        caption: messageInput.trim() || file.name,
        mimetype: mimetype, // Passar mimetype para o backend usar no envio
      });

      setMessageInput('');
      setShowEmojiPicker(false);
      // As mensagens serão atualizadas via Socket.IO
      await fetchMessages(selectedConversation.id);
      await fetchConversations();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do arquivo. Tente novamente.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startRecording = async () => {
    try {
      // Verificar se a API está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Seu navegador não suporta gravação de áudio. Use Chrome, Firefox ou Edge.');
        return;
      }

      // Verificar permissões primeiro
      try {
        const permissionResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionResult.state === 'denied') {
          alert('Permissão de microfone negada. Por favor, permita o acesso ao microfone nas configurações do navegador.');
          return;
        }
      } catch (permError) {
        // Alguns navegadores não suportam permissions.query, continuar normalmente
        console.log('Não foi possível verificar permissões:', permError);
      }

      // Tentar acessar o microfone
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      } catch (mediaError: any) {
        let errorMessage = 'Erro ao acessar o microfone.';
        
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          errorMessage = 'Permissão de microfone negada. Por favor, permita o acesso ao microfone nas configurações do navegador e recarregue a página.';
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          errorMessage = 'Nenhum microfone encontrado. Verifique se há um microfone conectado ao seu computador.';
        } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
          errorMessage = 'O microfone está sendo usado por outro aplicativo. Feche outros aplicativos que possam estar usando o microfone.';
        } else if (mediaError.name === 'OverconstrainedError' || mediaError.name === 'ConstraintNotSatisfiedError') {
          errorMessage = 'As configurações do microfone não são suportadas. Tente usar outro navegador.';
        } else {
          errorMessage = `Erro ao acessar o microfone: ${mediaError.message || mediaError.name}`;
        }
        
        alert(errorMessage);
        console.error('Erro ao acessar microfone:', mediaError);
        return;
      }

      // Verificar se MediaRecorder está disponível
      if (!window.MediaRecorder) {
        alert('Seu navegador não suporta gravação de áudio. Use Chrome, Firefox ou Edge atualizado.');
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Criar MediaRecorder com fallback de tipos MIME
      // Priorizar OGG/OPUS para compatibilidade com WhatsApp PTT (push-to-talk)
      let recorder: MediaRecorder;
      const mimeTypes = [
        'audio/ogg;codecs=opus',  // Priorizar OGG para PTT no WhatsApp
        'audio/webm;codecs=opus',  // Fallback para WEBM
        'audio/webm',
        'audio/mp4',
        'audio/wav',
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('🎤 Tipo de áudio selecionado para gravação:', mimeType);
          break;
        }
      }

      if (!selectedMimeType) {
        // Usar o tipo padrão do navegador
        recorder = new MediaRecorder(stream);
      } else {
        recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      }

      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onerror = (e) => {
        console.error('Erro durante a gravação:', e);
        alert('Erro durante a gravação. Tente novamente.');
        setRecording(false);
        setMediaRecorder(null);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.onstop = async () => {
        try {
          if (chunks.length === 0) {
            alert('Nenhum áudio foi gravado. Tente novamente.');
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          const audioBlob = new Blob(chunks, { type: selectedMimeType || 'audio/webm' });
          
          // Verificar se o blob tem conteúdo
          if (audioBlob.size === 0) {
            alert('O áudio gravado está vazio. Tente novamente.');
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          // Determinar extensão baseada no MIME type
          let extension = 'ogg'; // Padrão OGG para compatibilidade com WhatsApp PTT
          if (selectedMimeType.includes('ogg')) extension = 'ogg';
          else if (selectedMimeType.includes('webm')) extension = 'webm';
          else if (selectedMimeType.includes('mp4')) extension = 'm4a';
          else if (selectedMimeType.includes('wav')) extension = 'wav';

          const audioFile = new File([audioBlob], `audio.${extension}`, { type: selectedMimeType || 'audio/ogg;codecs=opus' });
          
          // Fazer upload do áudio
          setUploadingFile(true);
          try {
            const formData = new FormData();
            formData.append('file', audioFile);

            const uploadResponse = await api.post('/api/media/upload', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            const { url, mimetype } = uploadResponse.data;
            
            // Enviar mensagem de áudio (incluindo mimetype)
            await api.post('/api/messages', {
              conversationId: selectedConversation.id,
              content: 'Áudio',
              type: 'AUDIO',
              mediaUrl: url,
              fileName: `audio.${extension}`,
              caption: 'Áudio',
              mimetype: mimetype, // Passar mimetype para o backend usar no envio
            });
            
            // Atualizar mensagens
            await fetchMessages(selectedConversation.id);
            await fetchConversations();
          } catch (error: any) {
            console.error('Erro ao fazer upload do áudio:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Erro ao enviar áudio.';
            alert(`Erro ao enviar áudio: ${errorMsg}`);
          } finally {
            setUploadingFile(false);
          }
        } catch (error: any) {
          console.error('Erro ao processar áudio gravado:', error);
          alert('Erro ao processar o áudio gravado. Tente novamente.');
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error: any) {
      console.error('Erro inesperado ao iniciar gravação:', error);
      alert(`Erro inesperado: ${error.message || 'Erro desconhecido'}. Tente novamente.`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h atrás`;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Carregando conversas...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', position: 'relative' }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
      {/* Sidebar Esquerda - Lista de Conversas */}
      <div
        style={{
          width: '350px',
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: 'white',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', marginBottom: '15px' }}>Conversas</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              backgroundColor: 'white',
            }}
          >
            <option value="ALL">Todas</option>
            <option value="OPEN">Abertas</option>
            <option value="WAITING">Aguardando</option>
            <option value="CLOSED">Fechadas</option>
            <option value="ARCHIVED">Arquivadas</option>
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
              <p>Nenhuma conversa encontrada.</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleConversationClick(conv)}
                style={{
                  backgroundColor: selectedConversation?.id === conv.id ? '#e0e7ff' : 'white',
                  padding: '15px',
                  marginBottom: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: selectedConversation?.id === conv.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                }}
                onMouseEnter={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {conv.contact.name}
                    </h3>
                    <p
                      style={{
                        color: '#6b7280',
                        marginTop: '4px',
                        marginBottom: '4px',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {conv.channel.name} • {conv.contact.phone || 'Sem telefone'}
                    </p>
                    <p
                      style={{
                        color: '#6b7280',
                        marginTop: '4px',
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {conv.lastMessage || 'Sem mensagens'}
                    </p>
                    {/* Tempos de atendimento */}
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {conv.lastCustomerMessageAt && (
                        <span>
                          Cliente: {getTimeAgo(conv.lastCustomerMessageAt)}
                        </span>
                      )}
                      {conv.lastAgentMessageAt && (
                        <span>
                          Você: {getTimeAgo(conv.lastAgentMessageAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end', marginLeft: '10px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#e5e7eb',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {conv.status}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          minWidth: '20px',
                          textAlign: 'center',
                        }}
                      >
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área Direita - Chat */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          overflow: 'hidden',
        }}
      >
        {selectedConversation ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header do Chat */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                    {selectedConversation.contact.name}
                  </h3>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor:
                        selectedConversation.status === 'OPEN'
                          ? '#dcfce7'
                          : selectedConversation.status === 'WAITING'
                          ? '#fef3c7'
                          : selectedConversation.status === 'CLOSED'
                          ? '#f3f4f6'
                          : '#e5e7eb',
                      color:
                        selectedConversation.status === 'OPEN'
                          ? '#166534'
                          : selectedConversation.status === 'WAITING'
                          ? '#92400e'
                          : selectedConversation.status === 'CLOSED'
                          ? '#374151'
                          : '#6b7280',
                    }}
                  >
                    {selectedConversation.status === 'OPEN'
                      ? 'Aberta'
                      : selectedConversation.status === 'WAITING'
                      ? 'Aguardando'
                      : selectedConversation.status === 'CLOSED'
                      ? 'Fechada'
                      : 'Arquivada'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  {selectedConversation.channel.name} • {selectedConversation.contact.phone || 'Sem telefone'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                {selectedConversation.status === 'CLOSED' || selectedConversation.status === 'ARCHIVED' ? (
                  <button
                    onClick={async () => {
                      try {
                        await api.put(`/api/conversations/${selectedConversation.id}`, { status: 'OPEN' });
                        await fetchConversations();
                        if (selectedConversation) {
                          const updated = conversations.find((c) => c.id === selectedConversation.id);
                          if (updated) setSelectedConversation({ ...updated, status: 'OPEN' });
                        }
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'Erro ao abrir conversa');
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                    }}
                    title="Abrir conversa"
                  >
                    Abrir
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!confirm('Tem certeza que deseja fechar esta conversa?')) return;
                      try {
                        await api.put(`/api/conversations/${selectedConversation.id}`, { status: 'CLOSED' });
                        await fetchConversations();
                        if (selectedConversation) {
                          const updated = conversations.find((c) => c.id === selectedConversation.id);
                          if (updated) setSelectedConversation({ ...updated, status: 'CLOSED' });
                        }
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'Erro ao fechar conversa');
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                    }}
                    title="Fechar conversa"
                  >
                    Fechar
                  </button>
                )}
                <button
                  onClick={() => setShowTransferModal(true)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                  title="Transferir conversa"
                >
                  Transferir
                </button>
              </div>
              <span
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#e5e7eb',
                  fontSize: '12px',
                }}
              >
                {selectedConversation.status}
              </span>
            </div>

            {/* Área de Mensagens */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                backgroundColor: '#f9fafb',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <p>Nenhuma mensagem ainda.</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>
                    Envie uma mensagem para começar a conversa.
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.userId !== null;
                  return (
                    <div
                      key={message.id}
                      style={{
                        display: 'flex',
                        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          backgroundColor: isOwnMessage ? '#3b82f6' : 'white',
                          color: isOwnMessage ? 'white' : '#1f2937',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }}
                      >
                        {!isOwnMessage && (
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              marginBottom: '4px',
                              opacity: 0.8,
                            }}
                          >
                            {selectedConversation.contact.name}
                          </div>
                        )}
                        
                        {/* Exibir mídia se houver */}
                        {['IMAGE', 'VIDEO', 'AUDIO'].includes(message.type) && message.id && (
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
                                  const imgEl = e.target as HTMLImageElement;
                                  // Fallback: tentar URL direta do metadata se disponível
                                  if (message.metadata?.mediaUrl) {
                                    if (message.metadata.mediaUrl.startsWith('http')) {
                                      imgEl.src = message.metadata.mediaUrl;
                                    } else {
                                      imgEl.src = `http://localhost:3007${message.metadata.mediaUrl}`;
                                    }
                                    console.log('🔄 Tentando URL alternativa:', imgEl.src);
                                  } else {
                                    imgEl.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagem não disponível%3C/text%3E%3C/svg%3E';
                                  }
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
                                }}
                                onLoadedMetadata={() => {
                                  console.log('✅ Vídeo carregado com sucesso:', message.id);
                                }}
                                onError={(e) => {
                                  console.error('❌ Erro ao carregar vídeo:', message.id, e);
                                  const videoEl = e.target as HTMLVideoElement;
                                  // Fallback: tentar URL direta do metadata se disponível
                                  if (message.metadata?.mediaUrl) {
                                    if (message.metadata.mediaUrl.startsWith('http')) {
                                      videoEl.src = message.metadata.mediaUrl;
                                    } else {
                                      videoEl.src = `http://localhost:3007${message.metadata.mediaUrl}`;
                                    }
                                    console.log('🔄 Tentando URL alternativa:', videoEl.src);
                                  }
                                }}
                              />
                            )}
                            {message.type === 'AUDIO' && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px',
                                  backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                  borderRadius: '8px',
                                  minWidth: '250px',
                                }}
                              >
                                <span style={{ fontSize: '24px' }}>🎧</span>
                                <audio
                                  src={
                                    // Sempre tentar rota de mídia primeiro (funciona para recebidos e enviados)
                                    // Se falhar, tentar URL direta
                                    `http://localhost:3007/api/media/${message.id}`
                                  }
                                  controls
                                  style={{ 
                                    width: '220px',
                                    height: '32px',
                                    flex: 1,
                                  }}
                                  preload="metadata"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    console.error('❌ Erro ao carregar áudio via /api/media/:id:', message.id, e);
                                    const audioEl = e.target as HTMLAudioElement;
                                    // Fallback: tentar URL direta do metadata
                                    if (message.metadata?.mediaUrl) {
                                      if (message.metadata.mediaUrl.startsWith('http')) {
                                        audioEl.src = message.metadata.mediaUrl;
                                      } else {
                                        audioEl.src = `http://localhost:3007${message.metadata.mediaUrl}`;
                                      }
                                      console.log('🔄 Tentando URL alternativa:', audioEl.src);
                                    }
                                  }}
                                  onLoadedMetadata={() => {
                                    console.log('✅ Áudio carregado com sucesso:', message.id);
                                  }}
                                />
                              </div>
                            )}
                            {message.type === 'DOCUMENT' && (
                              <div
                                style={{
                                  padding: '12px',
                                  backgroundColor: 'rgba(0,0,0,0.1)',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                }}
                              >
                                <span style={{ fontSize: '24px' }}>📄</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px' }}>
                                    {message.metadata.fileName || 'Documento'}
                                  </div>
                                  <a
                                    href={`http://localhost:3007${message.metadata.mediaUrl}`}
                                    download
                                    style={{
                                      color: isOwnMessage ? 'white' : '#3b82f6',
                                      fontSize: '12px',
                                      textDecoration: 'underline',
                                    }}
                                  >
                                    Baixar arquivo
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Exibir conteúdo/caption */}
                        {message.content && (
                          <div
                            style={{
                              fontSize: '15px',
                              lineHeight: '1.4',
                              whiteSpace: 'pre-wrap',   // preserva quebras de linha
                              wordBreak: 'break-word',  // quebra palavras muito longas
                            }}
                          >
                            {message.content}
                          </div>
                        )}
                        
                        <div
                          style={{
                            fontSize: '11px',
                            marginTop: '6px',
                            opacity: 0.7,
                            textAlign: 'right',
                          }}
                        >
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: 'white',
                position: 'relative',
              }}
            >
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  style={{
                    position: 'absolute',
                    bottom: '80px',
                    left: '20px',
                    zIndex: 1000,
                  }}
                >
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width={350}
                    height={400}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}

              <form onSubmit={(e) => {
                if (recording) {
                  e.preventDefault();
                  stopRecording();
                } else {
                  handleSendMessage(e);
                }
              }} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Botão Respostas Rápidas */}
                <button
                  type="button"
                  onClick={() => setShowQuickReplies(true)}
                  style={{
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Respostas rápidas"
                >
                  ⚡
                </button>

                {/* Botão Emoji */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Emojis"
                >
                  😊
                </button>

                {/* Botão Upload */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || sending}
                  style={{
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: uploadingFile || sending ? 'not-allowed' : 'pointer',
                    fontSize: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: uploadingFile || sending ? 0.5 : 1,
                  }}
                  title="Enviar arquivo"
                >
                  📎
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                  style={{ display: 'none' }}
                />

                {/* Botão Gravar Áudio */}
                {!recording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={sending || uploadingFile}
                    style={{
                      padding: '10px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: sending || uploadingFile ? 'not-allowed' : 'pointer',
                      fontSize: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: sending || uploadingFile ? 0.5 : 1,
                    }}
                    title="Gravar áudio"
                  >
                    🎤
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    style={{
                      padding: '10px',
                      backgroundColor: '#ef4444',
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: '20px',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'pulse 1s infinite',
                    }}
                    title="Parar gravação"
                  >
                    ⏹
                  </button>
                )}

                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={recording ? "Gravando áudio..." : uploadingFile ? "Enviando arquivo..." : "Digite sua mensagem..."}
                  disabled={recording || uploadingFile}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '24px',
                    fontSize: '15px',
                    outline: 'none',
                    opacity: recording || uploadingFile ? 0.6 : 1,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                />
                <button
                  type="submit"
                  disabled={(!messageInput.trim() && !recording && !uploadingFile) || sending || uploadingFile}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: (messageInput.trim() || recording) && !sending && !uploadingFile ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '24px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: (messageInput.trim() || recording) && !sending && !uploadingFile ? 'pointer' : 'not-allowed',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {sending ? 'Enviando...' : uploadingFile ? 'Enviando...' : recording ? 'Gravando...' : 'Enviar'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#6b7280',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>Selecione uma conversa</p>
              <p style={{ fontSize: '14px' }}>Escolha uma conversa da lista para começar a conversar</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Respostas Rápidas */}
      <QuickRepliesModal
        isOpen={showQuickReplies}
        onClose={() => setShowQuickReplies(false)}
        onSelect={handleQuickReplySelect}
        contactId={selectedConversation?.contact.id}
        conversationId={selectedConversation?.id}
      />

      {/* Modal de Transferência */}
      {showTransferModal && selectedConversation && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowTransferModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Transferir Conversa</h2>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
              Selecione o usuário para transferir a conversa:
            </p>
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '10px',
              }}
            >
              {users.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
                  Carregando usuários...
                </p>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    onClick={async () => {
                      try {
                        await api.post(`/api/conversations/${selectedConversation.id}/assign`, {
                          userId: user.id,
                        });
                        alert(`Conversa transferida para ${user.name}`);
                        setShowTransferModal(false);
                        await fetchConversations();
                        const updated = conversations.find((c) => c.id === selectedConversation.id);
                        if (updated) setSelectedConversation(updated);
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'Erro ao transferir conversa');
                      }
                    }}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      border: '1px solid #e5e7eb',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{user.name}</div>
                        <div style={{ color: '#6b7280', fontSize: '12px' }}>{user.email}</div>
                        {user.sectors && user.sectors.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {user.sectors.map((us: any) => (
                              <span
                                key={us.sector.id}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: `${us.sector.color}20`,
                                  color: us.sector.color,
                                }}
                              >
                                {us.sector.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor:
                            user.role === 'ADMIN'
                              ? '#dc2626'
                              : user.role === 'SUPERVISOR'
                              ? '#f59e0b'
                              : '#3b82f6',
                          color: 'white',
                        }}
                      >
                        {user.role}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setShowTransferModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
