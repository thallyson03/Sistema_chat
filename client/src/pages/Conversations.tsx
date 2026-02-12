import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion } from 'framer-motion';
import api from '../utils/api';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import QuickRepliesModal from '../components/QuickRepliesModal';
import { getTimeAgo } from '../utils/timeUtils';
import { ConversationCard } from '../components/ui/ConversationCard';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';

// Função para gerar avatar com iniciais
const getAvatarUrl = (name: string, size: number = 40): string => {
  // Limpar nome e extrair iniciais (remover emojis e caracteres especiais)
  const cleanName = name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim() || name;
  
  const initials = cleanName
    .split(' ')
    .map(n => {
      // Pegar primeiro caractere alfanumérico
      const match = n.match(/[a-zA-Z0-9\u00C0-\u017F]/);
      return match ? match[0] : '';
    })
    .filter(char => char !== '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || cleanName.charAt(0).toUpperCase() || '?';
  
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];
  
  const colorIndex = (cleanName.charCodeAt(0) || 0) % colors.length;
  const bgColor = colors[colorIndex];
  
  // Usar encodeURIComponent para evitar problemas com caracteres especiais
  const svgContent = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${bgColor}" rx="${size / 2}"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" 
          fill="white" text-anchor="middle" dominant-baseline="central" font-weight="600">
      ${initials}
    </text>
  </svg>`;
  
  // Codificar SVG de forma segura para Unicode
  try {
    const encoded = btoa(unescape(encodeURIComponent(svgContent)));
    return `data:image/svg+xml;base64,${encoded}`;
  } catch (error) {
    // Fallback: usar encodeURIComponent se btoa falhar
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
  }
};

// Função para obter avatar do contato (foto real ou gerada)
const getContactAvatar = (contact: { name: string; profilePicture?: string }, size: number = 40): string => {
  // Se tiver foto de perfil do WhatsApp, usar ela
  if (contact.profilePicture) {
    return contact.profilePicture;
  }
  // Caso contrário, gerar avatar com iniciais
  return getAvatarUrl(contact.name, size);
};

interface Conversation {
  id: string;
  channelId: string;
  contact: {
    id: string;
    name: string;
    phone?: string;
    profilePicture?: string;
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
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loadingNewConversation, setLoadingNewConversation] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
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
    fetchChannels();

    // Listener para selecionar conversa via evento customizado (usado ao clicar em telefone no DealDetail)
    const handleSelectConversation = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId: string }>;
      const { conversationId } = customEvent.detail;
      if (conversationId) {
        // Buscar a conversa na lista
        fetchConversations().then(() => {
          // Aguardar um pouco para garantir que as conversas foram carregadas
          setTimeout(() => {
            setConversations(prevConversations => {
              const conv = prevConversations.find(c => c.id === conversationId);
              if (conv) {
                setSelectedConversation(conv);
              }
              return prevConversations;
            });
          }, 300);
        });
      }
    };

    window.addEventListener('selectConversation', handleSelectConversation);

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
        // Se a conversa está aberta, marcar como lida automaticamente
        try {
          await api.put(`/api/messages/conversation/${currentId}/read`);
          // Atualizar estado local para não mostrar badge
          setConversations(prev => 
            prev.map(conv => 
              conv.id === currentId 
                ? { ...conv, unreadCount: 0 }
                : conv
            )
          );
        } catch (error: any) {
          console.error('❌ Erro ao marcar conversa como lida:', error);
        }
      }
      
      // Atualizar lista de conversas (isso vai atualizar o contador se a conversa não estiver aberta)
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
      window.removeEventListener('selectConversation', handleSelectConversation);
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
      
      // Se a conversa selecionada tiver mensagens não lidas, marcar como lida automaticamente
      if (selectedConversation) {
        const selectedConv = conversationsData.find((c: Conversation) => c.id === selectedConversation.id);
        if (selectedConv && selectedConv.unreadCount > 0) {
          try {
            await api.put(`/api/messages/conversation/${selectedConversation.id}/read`);
            // Atualizar estado local
            setConversations(prev => 
              prev.map(conv => 
                conv.id === selectedConversation.id 
                  ? { ...conv, unreadCount: 0 }
                  : conv
              )
            );
            console.log('✅ Conversa selecionada marcada como lida automaticamente');
          } catch (error: any) {
            console.error('❌ Erro ao marcar conversa como lida:', error);
          }
        }
      }
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

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      setChannels(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    }
  };

  const handleStartNewConversation = async () => {
    if (!phoneNumber.trim()) {
      alert('Digite um número de telefone');
      return;
    }

    // Limpar número (remover caracteres não numéricos, exceto +)
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    if (cleanPhone.length < 10) {
      alert('Número de telefone inválido. Digite pelo menos 10 dígitos.');
      return;
    }

    setLoadingNewConversation(true);

    try {
      // Buscar primeiro canal disponível (ou usar o primeiro da lista)
      const channel = channels.length > 0 ? channels[0] : null;
      
      if (!channel) {
        alert('Nenhum canal disponível. Configure um canal primeiro.');
        setLoadingNewConversation(false);
        return;
      }

      // Buscar contato existente pelo telefone
      const contactsResponse = await api.get(`/api/contacts?search=${encodeURIComponent(cleanPhone)}`);
      const contacts = contactsResponse.data?.contacts || contactsResponse.data || [];
      
      let contact = contacts.find((c: any) => {
        const contactPhone = c.phone?.replace(/\D/g, '') || '';
        return contactPhone === cleanPhone || contactPhone.includes(cleanPhone) || cleanPhone.includes(contactPhone);
      });

      // Se não encontrou, criar novo contato
      if (!contact) {
        const newContactResponse = await api.post('/api/contacts', {
          name: `Contato ${cleanPhone}`,
          phone: cleanPhone,
          channelId: channel.id,
          channelIdentifier: `${cleanPhone}@s.whatsapp.net`,
        });
        contact = newContactResponse.data;
      }

      // Buscar conversa existente para este contato
      const conversationsResponse = await api.get(`/api/conversations?contactId=${contact.id}`);
      const existingConversations = conversationsResponse.data?.conversations || conversationsResponse.data || [];
      
      let conversation = existingConversations.length > 0 ? existingConversations[0] : null;

      // Se não encontrou, criar nova conversa
      if (!conversation) {
        const newConversationResponse = await api.post('/api/conversations', {
          channelId: channel.id,
          contactId: contact.id,
        });
        conversation = newConversationResponse.data;
      }

      // Recarregar lista de conversas
      await fetchConversations();

      // Selecionar a conversa criada/encontrada
      setTimeout(() => {
        const foundConversation = conversations.find(c => c.id === conversation.id) || conversation;
        setSelectedConversation(foundConversation as Conversation);
        setShowNewConversationModal(false);
        setPhoneNumber('');
      }, 500);

    } catch (error: any) {
      console.error('Erro ao iniciar conversa:', error);
      alert(error.response?.data?.error || 'Erro ao iniciar conversa. Verifique se o número está correto.');
    } finally {
      setLoadingNewConversation(false);
    }
  };

  const handleNumberKeyPress = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
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

  const handleConversationClick = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setMessages([]);
    
    // Marcar conversa como lida quando for selecionada
    if (conversation.unreadCount > 0) {
      try {
        await api.put(`/api/messages/conversation/${conversation.id}/read`);
        
        // Atualizar estado local para remover badge imediatamente
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversation.id 
              ? { ...conv, unreadCount: 0 }
              : conv
          )
        );
        
        console.log('✅ Conversa marcada como lida:', conversation.id);
      } catch (error: any) {
        console.error('❌ Erro ao marcar conversa como lida:', error);
      }
    }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Conversas</h2>
            <button
              onClick={() => setShowNewConversationModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Iniciar nova conversa"
            >
              📞 Nova Conversa
            </button>
          </div>
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
          {conversations.filter(conv => 
            !!conv.lastMessage || !!conv.lastCustomerMessageAt || !!conv.lastAgentMessageAt
          ).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
              <p>Nenhuma conversa encontrada.</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.05,
                  },
                },
              }}
            >
              {conversations
                .filter(conv => 
                  !!conv.lastMessage || !!conv.lastCustomerMessageAt || !!conv.lastAgentMessageAt
                )
                .map((conv, index) => (
                <ConversationCard
                  key={conv.id}
                  onClick={() => handleConversationClick(conv)}
                  isActive={selectedConversation?.id === conv.id}
                  unreadCount={conv.unreadCount}
                  index={index}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <img
                          src={getContactAvatar(conv.contact, 32)}
                          alt={conv.contact.name}
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {conv.contact.name}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 mb-1 truncate">
                        {conv.channel.name} • {conv.contact.phone || 'Sem telefone'}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-sm text-gray-600 truncate mb-2">
                          {conv.lastMessage}
                        </p>
                      )}
                      {/* Tempos de atendimento */}
                      <div className="text-xs text-gray-400 space-y-0.5">
                        {conv.lastCustomerMessageAt && (
                          <span>Cliente: {getTimeAgo(conv.lastCustomerMessageAt)}</span>
                        )}
                        {conv.lastAgentMessageAt && (
                          <span>Você: {getTimeAgo(conv.lastAgentMessageAt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end ml-3">
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 whitespace-nowrap">
                        {conv.status}
                      </span>
                    </div>
                  </div>
                </ConversationCard>
              ))}
            </motion.div>
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
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Avatar do cliente no header */}
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    overflow: 'hidden',
                    backgroundColor: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #e5e7eb',
                  }}
                >
                  <img
                    src={getContactAvatar(selectedConversation.contact, 48)}
                    alt={selectedConversation.contact.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      // Se a foto real falhar, usar avatar gerado
                      const target = e.target as HTMLImageElement;
                      target.src = getAvatarUrl(selectedConversation.contact.name, 48);
                    }}
                  />
                </div>
                
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
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: {
                      transition: {
                        staggerChildren: 0.05,
                      },
                    },
                  }}
                >
                  {messages.map((message, index) => {
                    const isOwnMessage = message.userId !== null;
                    const contactName = selectedConversation.contact.name;
                    const contactAvatar = getContactAvatar(selectedConversation.contact);
                    
                    return (
                      <motion.div
                        key={message.id}
                        variants={{
                          hidden: { opacity: 0, y: 10, scale: 0.95 },
                          visible: { opacity: 1, y: 0, scale: 1 },
                        }}
                        transition={{ 
                          duration: 0.2,
                          type: "spring",
                          stiffness: 200
                        }}
                        className="flex items-end gap-2 mb-1"
                      style={{
                        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                      }}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        duration: 0.2,
                        type: "spring",
                        stiffness: 200
                      }}
                    >
                      {/* Avatar do cliente (só aparece em mensagens do cliente) */}
                      {!isOwnMessage && (
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            flexShrink: 0,
                            overflow: 'hidden',
                            backgroundColor: '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={contactAvatar}
                            alt={contactName}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            onError={(e) => {
                              // Se falhar, usar SVG inline
                              const target = e.target as HTMLImageElement;
                              target.src = contactAvatar;
                            }}
                          />
                        </div>
                      )}
                      
                      <motion.div
                        className="max-w-[70%] px-4 py-3 rounded-xl shadow-sm relative"
                        style={{
                          backgroundColor: isOwnMessage ? '#3b82f6' : 'white',
                          color: isOwnMessage ? 'white' : '#1f2937',
                        }}
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        {!isOwnMessage && (
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              marginBottom: '4px',
                              opacity: 0.9,
                            }}
                          >
                            {contactName}
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
                            textAlign: isOwnMessage ? 'right' : 'left',
                          }}
                        >
                          {formatTime(message.createdAt)}
                        </div>
                      </motion.div>
                      
                      {/* Avatar do agente (só aparece em mensagens do agente) */}
                      {isOwnMessage && message.user && (
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            flexShrink: 0,
                            overflow: 'hidden',
                            backgroundColor: '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={getAvatarUrl(message.user.name)}
                            alt={message.user.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = getAvatarUrl(message.user!.name);
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
                </motion.div>
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

              <motion.form
                onSubmit={(e) => {
                  if (recording) {
                    e.preventDefault();
                    stopRecording();
                  } else {
                    handleSendMessage(e);
                  }
                }}
                className="flex gap-2 items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Botão Respostas Rápidas */}
                <IconButton
                  onClick={() => setShowQuickReplies(true)}
                  title="Respostas rápidas"
                >
                  <span className="text-xl">⚡</span>
                </IconButton>

                {/* Botão Emoji */}
                <IconButton
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Emojis"
                >
                  <span className="text-2xl">😊</span>
                </IconButton>

                {/* Botão Upload */}
                <IconButton
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || sending}
                  title="Enviar arquivo"
                >
                  <span className="text-xl">📎</span>
                </IconButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />

                {/* Botão Gravar Áudio */}
                {!recording ? (
                  <IconButton
                    onClick={startRecording}
                    disabled={sending || uploadingFile}
                    title="Gravar áudio"
                  >
                    <span className="text-xl">🎤</span>
                  </IconButton>
                ) : (
                  <motion.button
                    type="button"
                    onClick={stopRecording}
                    className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white"
                    title="Parar gravação"
                    animate={{
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="text-xl">⏹</span>
                  </motion.button>
                )}

                <motion.input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={recording ? "Gravando áudio..." : uploadingFile ? "Enviando arquivo..." : "Digite sua mensagem..."}
                  disabled={recording || uploadingFile}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-60"
                  whileFocus={{ scale: 1.02 }}
                />
                
                <Button
                  type="submit"
                  variant="primary"
                  disabled={(!messageInput.trim() && !recording && !uploadingFile) || sending || uploadingFile}
                  className="px-6 py-3 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Enviando...' : uploadingFile ? 'Enviando...' : recording ? 'Gravando...' : 'Enviar'}
                </Button>
              </motion.form>
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

      {/* Modal de Nova Conversa */}
      {showNewConversationModal && (
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
            zIndex: 1000,
          }}
          onClick={() => {
            if (!loadingNewConversation) {
              setShowNewConversationModal(false);
              setPhoneNumber('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
              📞 Iniciar Nova Conversa
            </h3>

            {/* Display do Número */}
            <div
              style={{
                padding: '20px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'center',
                fontSize: '24px',
                fontWeight: '600',
                letterSpacing: '2px',
                minHeight: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace',
              }}
            >
              {phoneNumber || 'Digite o número...'}
            </div>

            {/* Teclado Numérico */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫'].map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === '⌫') {
                      handleBackspace();
                    } else {
                      handleNumberKeyPress(key);
                    }
                  }}
                  disabled={loadingNewConversation}
                  style={{
                    padding: '20px',
                    fontSize: '20px',
                    fontWeight: '600',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: key === '⌫' ? '#ef4444' : key === '+' ? '#3b82f6' : 'white',
                    color: key === '⌫' || key === '+' ? 'white' : '#111827',
                    cursor: loadingNewConversation ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseDown={(e) => {
                    if (!loadingNewConversation) {
                      e.currentTarget.style.transform = 'scale(0.95)';
                    }
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Botões de Ação */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleClear}
                disabled={loadingNewConversation || !phoneNumber}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loadingNewConversation || !phoneNumber ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Limpar
              </button>
              <button
                onClick={handleStartNewConversation}
                disabled={loadingNewConversation || !phoneNumber || phoneNumber.replace(/\D/g, '').length < 10}
                style={{
                  flex: 2,
                  padding: '12px',
                  backgroundColor: loadingNewConversation || !phoneNumber || phoneNumber.replace(/\D/g, '').length < 10 ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loadingNewConversation || !phoneNumber || phoneNumber.replace(/\D/g, '').length < 10 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                {loadingNewConversation ? '⏳ Iniciando...' : '✅ Iniciar Conversa'}
              </button>
              <button
                onClick={() => {
                  setShowNewConversationModal(false);
                  setPhoneNumber('');
                }}
                disabled={loadingNewConversation}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loadingNewConversation ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
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
