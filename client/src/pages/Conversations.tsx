import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { getPublicApiOrigin, resolveMessageMediaPreviewUrl, isDirectlyRenderableMediaUrl, resolveMediaMetadataUrl } from '../config/publicUrl';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import QuickRepliesModal from '../components/QuickRepliesModal';
import { getTimeAgo } from '../utils/timeUtils';
import {
  formatMessagingWindowRemaining,
  getSendBlockedReason,
  resolveConversationMessagingWindow,
  type MessagingWindowStatus,
} from '../utils/whatsappMessagingWindow';
import { getConversationChannelLabel, normalizePhone } from '../utils/phone';
import { ConversationCard } from '../components/ui/ConversationCard';
import { IconButton } from '../components/ui/IconButton';
import { useConfirm } from '../components/ui/ConfirmProvider';
import TaskNotificationCard, {
  TaskNotificationData,
} from '../components/chat/TaskNotificationCard';
import NoteNotificationCard, {
  NoteNotificationData,
} from '../components/chat/NoteNotificationCard';
import { useEvolutionOutboundPresence } from '../hooks/useEvolutionOutboundPresence';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

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
    '#065f46', '#047857', '#059669', '#0d9488', '#047857',
    '#065f46', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0',
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

interface ContactThread {
  id: string;
  channelId: string | null;
  status: string;
  channelDisplayName?: string;
  channel?: { id: string; name: string; type: string; config?: { provider?: string } } | null;
  channelSnapshot?: { name?: string; channelId?: string; provider?: string } | null;
  lastMessageAt?: string | null;
  accessible?: boolean;
}

interface Conversation {
  id: string;
  channelId: string | null;
  channelSnapshot?: { name?: string; channelId?: string } | null;
  channelDisplayName?: string;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
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
  messagingWindow?: MessagingWindowStatus;
  channel?: {
    id: string;
    name: string;
    type: string;
    evolutionInstanceId?: string | null;
    config?: { provider?: string; phoneNumberId?: string; token?: string };
  } | null;
  inBot?: boolean;
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
    fromBot?: boolean;
    buttons?: Array<{ text?: string; title?: string; description?: string }>;
    interactiveType?: string;
    satisfactionSurveyPrompt?: boolean;
    satisfactionSurveyResponse?: boolean;
    score?: number;
    variant?: string;
    source?: string;
    taskNotification?: TaskNotificationData;
    noteNotification?: NoteNotificationData;
    sendError?: {
      message?: string;
      code?: string | number | null;
      at?: string;
    };
    editedAt?: string;
    editedVia?: string;
  };
}

/** Normaliza o payload de GET /api/conversations/:id para o formato da lista. */
function conversationFromDetailApi(raw: Record<string, unknown>): Conversation {
  const msgs = Array.isArray(raw.messages) ? (raw.messages as unknown[]) : [];
  const lastRow = msgs.length > 0 ? (msgs[msgs.length - 1] as Record<string, unknown>) : null;
  const lastMsg = lastRow ? String(lastRow.content ?? '').slice(0, 500) : '';
  const ch = raw.channel as Record<string, unknown> | null | undefined;
  return {
    id: String(raw.id),
    channelId: String(raw.channelId ?? ''),
    assignedToId: (raw.assignedToId as string | null | undefined) ?? null,
    assignedTo: (raw.assignedTo as Conversation['assignedTo']) ?? null,
    contact: raw.contact as Conversation['contact'],
    lastMessage: lastMsg,
    status: String(raw.status ?? ''),
    unreadCount: typeof raw.unreadCount === 'number' ? raw.unreadCount : 0,
    lastCustomerMessageAt: raw.lastCustomerMessageAt as string | undefined,
    lastAgentMessageAt: raw.lastAgentMessageAt as string | undefined,
    messagingWindow: raw.messagingWindow as MessagingWindowStatus | undefined,
    channelSnapshot: raw.channelSnapshot as Conversation['channelSnapshot'],
    channelDisplayName: raw.channelDisplayName as string | undefined,
    channel: ch
      ? {
          id: String(ch.id),
          name: String(ch.name ?? ''),
          type: String(ch.type ?? 'WHATSAPP'),
          evolutionInstanceId: (ch.evolutionInstanceId as string | null | undefined) ?? null,
          config: ch.config as NonNullable<Conversation['channel']>['config'],
        }
      : null,
    inBot: raw.inBot as boolean | undefined,
  };
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'OPEN', label: 'Abertos' },
  { value: 'WAITING', label: 'Aguardando atendimento' },
  { value: 'CLOSED', label: 'Fechadas' },
  { value: 'ARCHIVED', label: 'Arquivadas' },
  { value: 'BOT', label: 'Bot' },
];
const PRIMARY_STATUS_FILTER_VALUES = new Set(['ALL', 'OPEN', 'CLOSED']);

export default function Conversations() {
  // Base da API (mesma usada pelo axios)
  const apiBase = (api.defaults.baseURL || '').replace(/\/$/, '') || getPublicApiOrigin();
  const confirm = useConfirm();

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkOpenedRef = useRef<string | null>(null);
  const deepLinkInFlightRef = useRef<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [contactThreads, setContactThreads] = useState<ContactThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingSatisfactionSurvey, setSendingSatisfactionSurvey] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [pendingTemplate, setPendingTemplate] = useState<{ name: string; language: string } | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [windowTick, setWindowTick] = useState(() => Date.now());
  const [contactPresence, setContactPresence] = useState<'composing' | 'recording' | null>(null);
  const contactPresenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showMoreStatusFilters, setShowMoreStatusFilters] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSectorStep, setTransferSectorStep] = useState<
    | null
    | { id: string; name: string; color?: string }
  >(null);
  const [transferSectorUsers, setTransferSectorUsers] = useState<
    Array<{ id: string; name: string; email: string; isActive: boolean; isPaused?: boolean; role?: string }>
  >([]);
  const [loadingTransferSectorUsers, setLoadingTransferSectorUsers] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loadingNewConversation, setLoadingNewConversation] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [audioState, setAudioState] = useState<
    Record<string, { playing: boolean; currentTime: number; duration: number }>
  >({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [videoState, setVideoState] = useState<
    Record<string, { playing: boolean; currentTime: number; duration: number }>
  >({});
  const [previewMedia, setPreviewMedia] = useState<{
    type: 'IMAGE' | 'VIDEO';
    src: string;
    messageId?: string;
  } | null>(null);
  const [openMediaMenuId, setOpenMediaMenuId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Lista rolável do painel de mensagens (preserva scroll em atualizações silenciosas). */
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  // Mantém sempre o ID da conversa selecionada mais recente para usar dentro dos handlers do socket
  const currentConversationIdRef = useRef<string | null>(null);
  /** Evita offset errado na paginação (closure desatualizado) e descarta respostas após trocar de conversa */
  const messagesRef = useRef<Message[]>([]);
  /** Após mudar `messages`, ajusta scroll sem “pulo” (estilo WhatsApp: cola no fim só se já estava no fim). */
  const pendingScrollAfterMessagesRef = useRef<
    null | { type: 'stickBottom' } | { type: 'preserveBottomGap'; gapPx: number }
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const moreStatusFiltersRef = useRef<HTMLDivElement>(null);
  const statusFilterRef = useRef<string>('ALL');
  const fetchConversationsRef = useRef<(filterOverride?: string) => Promise<void>>(async () => {});
  const conversationsRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  /** Mensagens novas enquanto o usuário não está no fim do scroll (seta + contador). */
  const [newMessagesBelowCount, setNewMessagesBelowCount] = useState(0);
  const MESSAGES_PAGE_SIZE = 50;
  const BOT_ACTIVE_BLOCK_MESSAGE =
    'Para interagir com o cliente, desative o bot desta conversa primeiro.';
  const primaryStatusFilters = STATUS_FILTER_OPTIONS.filter((opt) =>
    PRIMARY_STATUS_FILTER_VALUES.has(opt.value),
  );
  const secondaryStatusFilters = STATUS_FILTER_OPTIONS.filter(
    (opt) => !PRIMARY_STATUS_FILTER_VALUES.has(opt.value),
  );

  const ensureBotDisabledForManualInteraction = () => {
    if (!selectedConversation) return false;
    if (selectedConversation.inBot) {
      alert(BOT_ACTIVE_BLOCK_MESSAGE);
      return false;
    }
    return true;
  };

  const getActiveMessagingWindow = (): MessagingWindowStatus | null => {
    if (!selectedConversation) return null;
    return resolveConversationMessagingWindow(
      {
        ...selectedConversation,
        channel: selectedConversation.channel ?? undefined,
      },
      windowTick,
    );
  };

  const getMessagingWindowBlockReason = (hasPendingTemplate = false): string | null => {
    const mw = getActiveMessagingWindow();
    if (!mw) return null;
    return getSendBlockedReason(mw, hasPendingTemplate);
  };

  // Atualizar o ref sempre que a conversa selecionada mudar
  useEffect(() => {
    currentConversationIdRef.current = selectedConversation?.id || null;
  }, [selectedConversation]);

  useEffect(() => {
    setSendError(null);
    setContactPresence(null);
    if (contactPresenceTimeoutRef.current) {
      clearTimeout(contactPresenceTimeoutRef.current);
      contactPresenceTimeoutRef.current = null;
    }
  }, [selectedConversation?.id]);

  const fetchContactThreads = useCallback(async (contactId: string) => {
    try {
      const response = await api.get(`/api/contacts/${contactId}/conversations`);
      setContactThreads(response.data?.conversations || []);
    } catch {
      setContactThreads([]);
    }
  }, []);

  useEffect(() => {
    if (selectedConversation?.contact?.id) {
      fetchContactThreads(selectedConversation.contact.id);
    } else {
      setContactThreads([]);
    }
  }, [selectedConversation?.contact?.id, fetchContactThreads]);

  const contactThreadTabs = useMemo(() => {
    const seen = new Set<string>();
    const tabs: ContactThread[] = [];
    for (const thread of contactThreads) {
      const key = thread.channelId || thread.channelSnapshot?.channelId || thread.id;
      if (seen.has(key)) continue;
      seen.add(key);
      tabs.push(thread);
    }
    return tabs;
  }, [contactThreads]);

  useEffect(() => {
    if (!selectedConversation) return undefined;
    const timer = window.setInterval(() => setWindowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [selectedConversation?.id]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        showMoreStatusFilters &&
        moreStatusFiltersRef.current &&
        !moreStatusFiltersRef.current.contains(event.target as Node)
      ) {
        setShowMoreStatusFilters(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMoreStatusFilters]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Manter filtro atual em um ref para uso em handlers de socket
  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

  useEffect(() => {
    if (!showTransferModal) {
      setTransferSectorStep(null);
      setTransferSectorUsers([]);
      setLoadingTransferSectorUsers(false);
    }
  }, [showTransferModal]);

  const queueConversationsRefresh = useCallback((delayMs = 300, filterOverride?: string) => {
    if (conversationsRefreshTimeoutRef.current) {
      clearTimeout(conversationsRefreshTimeoutRef.current);
    }
    conversationsRefreshTimeoutRef.current = setTimeout(() => {
      conversationsRefreshTimeoutRef.current = null;
      void fetchConversationsRef.current(filterOverride);
    }, delayMs);
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchChannels();
    fetchSectors();

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
    const socket: Socket = io(getPublicApiOrigin(), {
      transports: ['websocket', 'polling'],
      auth: {
        token: localStorage.getItem('token') || '',
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Conectado ao Socket.IO');
      const activeConversationId = currentConversationIdRef.current;
      if (activeConversationId) {
        socket.emit('subscribe_conversation', activeConversationId);
      }
    });

    socket.on('new_message', async (data: { conversationId: string; messageId?: string }) => {
      console.log('📨 Nova mensagem recebida via Socket.IO:', data);
      const currentId = currentConversationIdRef.current;

      // Se a mensagem é da conversa atualmente selecionada, anexar só a nova linha (evita recarregar lista e “pulo” de scroll)
      if (currentId && data.conversationId === currentId) {
        try {
          if (data.messageId) {
            const msgRes = await api.get<Message>(`/api/messages/${data.messageId}`, {
              params: { conversationId: currentId },
            });
            const newMsg = msgRes.data;
            const el = messagesScrollRef.current;
            if (el) {
              const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
              pendingScrollAfterMessagesRef.current =
                gap < 120 ? { type: 'stickBottom' } : { type: 'preserveBottomGap', gapPx: gap };
              if (gap >= 120) {
                setNewMessagesBelowCount((n) => n + 1);
              }
            } else {
              pendingScrollAfterMessagesRef.current = { type: 'stickBottom' };
            }
            setShouldScrollToBottom(false);
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
              );
            });
          } else {
            const elAway = messagesScrollRef.current;
            const away =
              elAway && elAway.scrollHeight - elAway.scrollTop - elAway.clientHeight >= 120;
            await fetchMessages(currentId, { reset: true, silent: true });
            if (away) setNewMessagesBelowCount((n) => n + 1);
          }
        } catch (e) {
          console.warn('📨 Falha ao anexar mensagem via API, refazendo lista:', e);
          const elAway = messagesScrollRef.current;
          const away =
            elAway && elAway.scrollHeight - elAway.scrollTop - elAway.clientHeight >= 120;
          await fetchMessages(currentId, { reset: true, silent: true });
          if (away) setNewMessagesBelowCount((n) => n + 1);
        }
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
      
      // Atualizar lista de conversas com debounce para evitar tempestade de requests.
      queueConversationsRefresh(250);
    });

    socket.on('conversation_updated', async () => {
      console.log('🔄 Conversa atualizada via Socket.IO');
      queueConversationsRefresh(250);
    });

    socket.on(
      'message_status',
      (data: { conversationId: string; messageId: string; status: string }) => {
        const currentId = currentConversationIdRef.current;
        if (!currentId || data.conversationId !== currentId) return;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId ? { ...msg, status: data.status } : msg,
          ),
        );
      },
    );

    socket.on(
      'message_updated',
      (data: { conversationId: string; messageId: string; content: string }) => {
        const currentId = currentConversationIdRef.current;
        if (!currentId || data.conversationId !== currentId) return;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId ? { ...msg, content: data.content } : msg,
          ),
        );
      },
    );

    socket.on(
      'contact_presence',
      (data: {
        conversationId: string;
        state: 'composing' | 'recording' | 'available' | 'unavailable' | 'paused' | null;
      }) => {
        const currentId = currentConversationIdRef.current;
        if (!currentId || data.conversationId !== currentId) return;

        if (contactPresenceTimeoutRef.current) {
          clearTimeout(contactPresenceTimeoutRef.current);
          contactPresenceTimeoutRef.current = null;
        }

        if (data.state === 'composing' || data.state === 'recording') {
          setContactPresence(data.state);
          contactPresenceTimeoutRef.current = setTimeout(() => {
            setContactPresence(null);
            contactPresenceTimeoutRef.current = null;
          }, 25_000);
        } else {
          setContactPresence(null);
        }
      },
    );

    socket.on('disconnect', () => {
      console.log('❌ Desconectado do Socket.IO');
    });

    // Limpar conexão ao desmontar componente
    return () => {
      socket.disconnect();
      window.removeEventListener('selectConversation', handleSelectConversation);
      if (conversationsRefreshTimeoutRef.current) {
        clearTimeout(conversationsRefreshTimeoutRef.current);
        conversationsRefreshTimeoutRef.current = null;
      }
    };
  }, [queueConversationsRefresh]);

  useEffect(() => {
    const socket = socketRef.current;
    const conversationId = selectedConversation?.id;
    if (!socket || !conversationId) return;

    socket.emit('subscribe_conversation', conversationId);
    if (selectedConversation.channelId) {
      socket.emit('subscribe_channel', selectedConversation.channelId);
    }

    return () => {
      socket.emit('unsubscribe_conversation', conversationId);
      if (selectedConversation.channelId) {
        socket.emit('unsubscribe_channel', selectedConversation.channelId);
      }
    };
  }, [selectedConversation?.id, selectedConversation?.channelId]);

  // Evolution: inscrever presença inbound (cliente → CRM) ao abrir e renovar periodicamente
  useEffect(() => {
    const conversationId = selectedConversation?.id;
    const phone = selectedConversation?.contact?.phone;
    const evolutionInstanceId = selectedConversation?.channel?.evolutionInstanceId;
    if (!conversationId || !phone || !evolutionInstanceId) return;

    const subscribeInboundPresence = () => {
      api.post(`/api/conversations/${conversationId}/presence-subscribe`).catch(() => {
        // falha silenciosa — presença é best-effort
      });
    };

    subscribeInboundPresence();
    const renewInboundPresence = setInterval(subscribeInboundPresence, 30_000);
    return () => clearInterval(renewInboundPresence);
  }, [
    selectedConversation?.id,
    selectedConversation?.contact?.phone,
    selectedConversation?.channel?.evolutionInstanceId,
  ]);

  // Buscar usuário atual para poder assumir conversas do bot
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/api/auth/me');
        setCurrentUser(response.data);
      } catch (error) {
        console.error('Erro ao buscar usuário atual:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  useLayoutEffect(() => {
    const pending = pendingScrollAfterMessagesRef.current;
    if (pending === null) return;
    pendingScrollAfterMessagesRef.current = null;
    const el = messagesScrollRef.current;
    if (!el) return;
    if (pending.type === 'stickBottom') {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    } else {
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - pending.gapPx);
    }
  }, [messages]);

  useEffect(() => {
    // Scroll suave só quando abrimos conversa / enviamos (não em atualização silenciosa por socket)
    if (shouldScrollToBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldScrollToBottom]);

  useEffect(() => {
    // Carregar mensagens quando uma conversa for selecionada
    if (selectedConversation) {
      setNewMessagesBelowCount(0);
      setHasMoreMessages(true);
      setShouldScrollToBottom(true);
      fetchMessages(selectedConversation.id, { reset: true });
    }
  }, [selectedConversation]);

  const handleMessagesPaneScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (gap < 120) {
      setNewMessagesBelowCount(0);
    }
  }, []);

  const scrollChatToLatest = useCallback(() => {
    setNewMessagesBelowCount(0);
    pendingScrollAfterMessagesRef.current = null;
    setShouldScrollToBottom(false);
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    // Recarregar conversas quando o filtro mudar
    fetchConversations(statusFilter);
  }, [statusFilter]);

  const fetchConversations = async (filterOverride?: string) => {
    try {
      const effectiveFilter = filterOverride ?? statusFilterRef.current;
      const params = new URLSearchParams();
      if (effectiveFilter === 'BOT') {
        params.append('inBot', 'true');
      } else if (effectiveFilter !== 'ALL') {
        params.append('status', effectiveFilter);
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

  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  }, [fetchConversations]);

  // Abrir conversa a partir de /conversations?c=... (ex.: link no dashboard) — mesmo layout da área de conversas
  useEffect(() => {
    const id = searchParams.get('c') || searchParams.get('conversation');
    if (!id) {
      deepLinkOpenedRef.current = null;
      return;
    }
    if (loading) return;
    if (deepLinkOpenedRef.current === id) return;
    if (deepLinkInFlightRef.current === id) return;
    deepLinkInFlightRef.current = id;

    let cancelled = false;

    (async () => {
      try {
        let conv = conversations.find((c) => c.id === id);
        if (!conv) {
          const { data } = await api.get(`/api/conversations/${id}`);
          if (cancelled) return;
          conv = conversationFromDetailApi(data);
          setConversations((prev) => (prev.some((c) => c.id === conv!.id) ? prev : [conv!, ...prev]));
        }
        if (cancelled || !conv) return;

        deepLinkOpenedRef.current = id;
        setSelectedConversation(conv);
        setNewMessagesBelowCount(0);
        setHasMoreMessages(true);
        setShouldScrollToBottom(true);

        if (conv.unreadCount > 0) {
          try {
            await api.put(`/api/messages/conversation/${conv.id}/read`);
            setConversations((prev) =>
              prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
            );
          } catch (e) {
            console.error('[Conversations] Erro ao marcar como lida (deep link):', e);
          }
        }

        setSearchParams({}, { replace: true });
      } catch (e) {
        console.error('[Conversations] Deep link inválido ou sem permissão:', e);
        if (!cancelled) setSearchParams({}, { replace: true });
        deepLinkOpenedRef.current = null;
      } finally {
        deepLinkInFlightRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, conversations, searchParams, setSearchParams]);

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      setChannels(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    }
  };

  const fetchSectors = async () => {
    try {
      const response = await api.get('/api/sectors');
      setSectors(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const handleStartNewConversation = async () => {
    if (!phoneNumber.trim()) {
      alert('Digite um número de telefone');
      return;
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
      alert('Número de telefone inválido. Digite pelo menos 10 dígitos.');
      return;
    }

    setLoadingNewConversation(true);

    try {
      const channel = channels.length > 0 ? channels[0] : null;
      if (!channel) {
        alert('Nenhum canal disponível. Configure um canal primeiro.');
        setLoadingNewConversation(false);
        return;
      }

      const contactsResponse = await api.get(
        `/api/contacts?search=${encodeURIComponent(normalizedPhone)}`,
      );
      const contacts = contactsResponse.data?.contacts || contactsResponse.data || [];
      let contact = contacts.find(
        (c: { phone?: string }) => normalizePhone(c.phone) === normalizedPhone,
      );

      if (!contact) {
        const newContactResponse = await api.post('/api/contacts', {
          name: `Contato ${normalizedPhone}`,
          phone: normalizedPhone,
          channelId: channel.id,
        });
        contact = newContactResponse.data;
      }

      const threadsResponse = await api.get(`/api/contacts/${contact.id}/conversations`);
      const threads: ContactThread[] = threadsResponse.data?.conversations || [];
      let conversation =
        threads.find(
          (t) =>
            t.channelId === channel.id &&
            (t.status === 'OPEN' || t.status === 'WAITING'),
        ) || null;

      if (!conversation) {
        const newConversationResponse = await api.post('/api/conversations', {
          channelId: channel.id,
          contactId: contact.id,
        });
        conversation = newConversationResponse.data;
      }

      // Recarregar lista de conversas
      await fetchConversations();

      if (!conversation) return;

      setTimeout(() => {
        const foundConversation = conversations.find((c) => c.id === conversation!.id) || conversation;
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

  const fetchMessages = async (
    conversationId: string,
    options?: { reset?: boolean; silent?: boolean },
  ) => {
    const reset = options?.reset ?? false;
    const silent = options?.silent ?? false;

    if (reset && !silent) {
      setLoadingMessages(true);
    } else if (!reset) {
      setLoadingMoreMessages(true);
    }

    try {
      const currentCount = reset ? 0 : messagesRef.current.length;

      const response = await api.get(`/api/messages/conversation/${conversationId}`, {
        params: {
          limit: MESSAGES_PAGE_SIZE,
          offset: currentCount,
        },
      });

      if (currentConversationIdRef.current !== conversationId) {
        return;
      }

      const messagesData = response.data || [];
      // Backend retorna em ordem decrescente; inverter para mostrar antigas primeiro (cópia para não mutar a resposta)
      const newMessages = [...messagesData].reverse();

      if (reset) {
        if (silent) {
          const el = messagesScrollRef.current;
          if (el) {
            const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
            pendingScrollAfterMessagesRef.current =
              gap < 120 ? { type: 'stickBottom' } : { type: 'preserveBottomGap', gapPx: gap };
          } else {
            pendingScrollAfterMessagesRef.current = { type: 'stickBottom' };
          }
          setShouldScrollToBottom(false);
        } else {
          pendingScrollAfterMessagesRef.current = null;
          setShouldScrollToBottom(true);
        }
        setMessages(newMessages);
      } else {
        if (newMessages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const mergedOlder = newMessages.filter((m) => !existingIds.has(m.id));
            return mergedOlder.length > 0 ? [...mergedOlder, ...prev] : prev;
          });
        }
        setShouldScrollToBottom(false);
      }

      if (messagesData.length < MESSAGES_PAGE_SIZE) {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      if (reset && !silent) {
        setLoadingMessages(false);
      } else if (!reset) {
        setLoadingMoreMessages(false);
      }
    }
  };

  const appendMessageToChat = useCallback((newMsg: Message) => {
    const el = messagesScrollRef.current;
    if (el) {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      pendingScrollAfterMessagesRef.current =
        gap < 120 ? { type: 'stickBottom' } : { type: 'preserveBottomGap', gapPx: gap };
    } else {
      pendingScrollAfterMessagesRef.current = { type: 'stickBottom' };
    }
    setShouldScrollToBottom(false);
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, []);

  const handleConversationClick = async (conversation: Conversation) => {
    const isSameConversation = selectedConversation?.id === conversation.id;
    setSelectedConversation(conversation);
    setNewMessagesBelowCount(0);

    // Se clicou na conversa já aberta, o useEffect de selectedConversation pode não disparar.
    // Nesse caso, recarrega silenciosamente sem limpar a lista para evitar falso "Nenhuma mensagem".
    if (isSameConversation) {
      setHasMoreMessages(true);
      await fetchMessages(conversation.id, { reset: true, silent: true });
    }
    
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

  const handleSendMessage = async (
    e: React.FormEvent,
    mediaUrl?: string,
    messageType?: string,
    fileName?: string,
    caption?: string,
  ) => {
    e.preventDefault();
    if (!selectedConversation || sending) return;
    if (!ensureBotDisabledForManualInteraction()) return;

    const windowBlockReason = getMessagingWindowBlockReason(!!pendingTemplate);
    if (windowBlockReason && !pendingTemplate) {
      setSendError(windowBlockReason);
      return;
    }

    // Se há um template pendente e não estamos enviando mídia, envia como template
    if (
      pendingTemplate &&
      !mediaUrl &&
      selectedConversation.channel?.type === 'WHATSAPP'
    ) {
      try {
        setSending(true);
        setSendError(null);
        const response = await api.post('/api/whatsapp/templates/send', {
          conversationId: selectedConversation.id,
          templateName: pendingTemplate.name,
          language: pendingTemplate.language,
          body: messageInput.trim(),
        });

        setPendingTemplate(null);
        setMessageInput('');
        setShowEmojiPicker(false);
        if (response.status === 201 && response.data?.id) {
          appendMessageToChat(response.data as Message);
        }
        queueConversationsRefresh(250);
      } catch (error: any) {
        console.error('Erro ao enviar template WhatsApp:', error);
        setSendError(
          error.response?.data?.error ||
            'Erro ao enviar template WhatsApp. Verifique se o template está aprovado e o canal está correto.',
        );
      } finally {
        setSending(false);
      }
      return;
    }

    // Fluxo normal de mensagem de texto/mídia
    if (!messageInput.trim() && !mediaUrl) return;

    stopEvolutionPresence();
    setSending(true);
    setSendError(null);
    const trimmedContent = messageInput.trim();
    setMessageInput('');
    setShowEmojiPicker(false);
    setPendingTemplate(null);
    try {
      const response = await api.post('/api/messages', {
        conversationId: selectedConversation.id,
        content: trimmedContent || caption || '',
        type: messageType || 'TEXT',
        mediaUrl,
        fileName,
        caption: trimmedContent || caption,
      });

      if (response.status === 201 && response.data?.id) {
        appendMessageToChat(response.data as Message);
        if ((response.data.status || '').toUpperCase() === 'FAILED') {
          const failedMsg =
            response.data.metadata?.sendError?.message ||
            'Não foi possível entregar a mensagem pelo WhatsApp.';
          setSendError(failedMsg);
        }
      }
      queueConversationsRefresh(250);
    } catch (error: any) {
      if (!mediaUrl) {
        setMessageInput(trimmedContent);
      }
      console.error('Erro ao enviar mensagem:', error);
      const apiData = error.response?.data;
      setSendError(
        apiData?.error ||
          apiData?.details ||
          error.message ||
          'Erro ao enviar mensagem. Tente novamente.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleQuickReplySelect = (quickReply: any) => {
    // Se for um template WhatsApp, apenas preencher o input e marcar template pendente
    if (
      quickReply.isTemplate &&
      quickReply.templateName &&
      selectedConversation &&
      selectedConversation.channel?.type === 'WHATSAPP'
    ) {
      const language = quickReply.templateLanguage || 'pt_BR';
      setPendingTemplate({
        name: quickReply.templateName,
        language,
      });
      setMessageInput(quickReply.previewContent || quickReply.content);
      setShowQuickReplies(false);
      return;
    }

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
    if (!ensureBotDisabledForManualInteraction()) {
      e.target.value = '';
      return;
    }

    const uploadBlockReason = getMessagingWindowBlockReason(false);
    if (uploadBlockReason) {
      setSendError(uploadBlockReason);
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    setSendError(null);
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
      const sendResponse = await api.post('/api/messages', {
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
      if (sendResponse.status === 201 && sendResponse.data?.id) {
        appendMessageToChat(sendResponse.data as Message);
        if ((sendResponse.data.status || '').toUpperCase() === 'FAILED') {
          setSendError(
            sendResponse.data.metadata?.sendError?.message ||
              'Não foi possível enviar o arquivo pelo WhatsApp.',
          );
        }
      }
      queueConversationsRefresh(250);
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      setSendError(
        error.response?.data?.error ||
          error.message ||
          'Erro ao fazer upload do arquivo. Tente novamente.',
      );
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const voiceRecorder = useVoiceRecorder({
    onError: (message) => setSendError(message),
    onSend: async (audioFile, { mimeType }) => {
      if (!selectedConversation) {
        throw new Error('Nenhuma conversa selecionada');
      }
      if (selectedConversation.inBot) {
        throw new Error(BOT_ACTIVE_BLOCK_MESSAGE);
      }
      const audioBlockReason = getMessagingWindowBlockReason(false);
      if (audioBlockReason) {
        setSendError(audioBlockReason);
        throw new Error(audioBlockReason);
      }
      setSendError(null);
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', audioFile);
        const uploadResponse = await api.post('/api/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const { url, mimetype } = uploadResponse.data;
        const audioResponse = await api.post('/api/messages', {
          conversationId: selectedConversation.id,
          content: '',
          type: 'AUDIO',
          mediaUrl: url,
          fileName: 'audio.ogg',
          caption: 'Áudio',
          mimetype: mimetype || mimeType,
        });
        if (audioResponse.status === 201 && audioResponse.data?.id) {
          appendMessageToChat(audioResponse.data as Message);
          if ((audioResponse.data.status || '').toUpperCase() === 'FAILED') {
            setSendError(
              audioResponse.data.metadata?.sendError?.message ||
                'Não foi possível enviar o áudio pelo WhatsApp.',
            );
          }
        }
        queueConversationsRefresh(250);
      } finally {
        setUploadingFile(false);
      }
    },
  });

  const handleStartVoiceRecording = () => {
    if (!ensureBotDisabledForManualInteraction()) return;
    const blockReason = getMessagingWindowBlockReason(false);
    if (blockReason) {
      setSendError(blockReason);
      return;
    }
    setSendError(null);
    void voiceRecorder.start();
  };

  useEffect(() => {
    voiceRecorder.cancelAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset ao trocar conversa
  }, [selectedConversation?.id]);

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

  // Fechar menu de mídia ao clicar fora em qualquer lugar da página
  useEffect(() => {
    const handleClick = () => {
      setOpenMediaMenuId(null);
    };
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

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

  const getDeliveryCheckClass = (status?: string) => {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'FAILED') {
      return 'text-red-400';
    }
    if (normalized === 'DELIVERED' || normalized === 'READ') {
      return 'text-sky-400';
    }
    return 'text-on-surface-variant/70';
  };

  const formatAudioTime = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return '0:00';
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownloadMedia = async (message: Message) => {
    try {
      // Sempre baixar via backend para que ele trate autenticação / tokens da Meta
      const endpoint =
        message.type === 'AUDIO'
          ? `/api/media/download/${message.id}` // converte para MP3 quando possível
          : `/api/media/${message.id}`;
      const response = await api.get(endpoint, {
        responseType: 'blob',
      });

      const contentType = response.headers['content-type'];
      const blob = new Blob([response.data], { type: contentType || undefined });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;

      let filename =
        message.metadata?.fileName || message.content || (message.type === 'AUDIO' ? 'audio' : 'arquivo');

      if (message.type === 'AUDIO') {
        // Garantir extensão .mp3 para download de áudio
        filename = filename.replace(/\.[^/.]+$/, '');
        filename += '.mp3';
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Liberar URL em memória
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao iniciar download da mídia:', error);
      alert('Não foi possível baixar este arquivo. Tente novamente.');
    }
  };

  const getPreviewSrc = (message: Message) => resolveMessageMediaPreviewUrl(message);

  const getTaskNotificationData = (message: Message): TaskNotificationData | null => {
    const metadataTask = message.metadata?.taskNotification;
    if (metadataTask?.taskId) return metadataTask;
    if (
      message.metadata?.fromBot === true &&
      typeof message.content === 'string' &&
      (message.content.startsWith('⏰ Chegou a hora de realizar uma tarefa deste negócio.') ||
        message.content.startsWith('🤖 Tarefa criada pelo bot deste negócio.'))
    ) {
      const titleMatch = message.content.match(/• Tarefa:\s*(.+)/);
      const detailsMatch = message.content.match(/• Detalhes:\s*(.+)/);
      return {
        taskId: `legacy-${message.id}`,
        title: titleMatch?.[1]?.trim() || 'Tarefa',
        description: detailsMatch?.[1]?.trim() || '',
      };
    }
    return null;
  };

  const getNoteNotificationData = (message: Message): NoteNotificationData | null => {
    const metadataNote = message.metadata?.noteNotification;
    if (metadataNote?.note) return metadataNote;
    if (
      message.metadata?.fromBot === true &&
      typeof message.content === 'string' &&
      message.content.startsWith('📝 Nota adicionada pelo bot')
    ) {
      const noteText = message.content.replace(/^📝 Nota adicionada pelo bot\s*/u, '').trim();
      return { note: noteText || 'Nota sem conteúdo' };
    }
    return null;
  };

  const handleSaveTaskResult = async (taskId: string, result: string) => {
    try {
      if (!taskId || taskId.startsWith('legacy-')) {
        throw new Error('Esta tarefa é antiga. Abra o negócio para atualizar.');
      }
      await api.put(`/api/pipelines/tasks/${taskId}`, { result });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.metadata?.taskNotification?.taskId === taskId
            ? {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  taskNotification: {
                    ...msg.metadata.taskNotification,
                    description: result,
                  },
                },
              }
            : msg,
        ),
      );
    } catch (error: any) {
      alert(error?.response?.data?.error || error?.message || 'Erro ao salvar resultado.');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      if (!taskId || taskId.startsWith('legacy-')) {
        throw new Error('Esta tarefa é antiga. Abra o negócio para atualizar.');
      }
      await api.put(`/api/pipelines/tasks/${taskId}`, { status: 'DONE' });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.metadata?.taskNotification?.taskId === taskId
            ? {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  taskNotification: {
                    ...msg.metadata.taskNotification,
                    status: 'DONE',
                  },
                },
              }
            : msg,
        ),
      );
    } catch (error: any) {
      alert(error?.response?.data?.error || error?.message || 'Erro ao concluir tarefa.');
    }
  };

  const activeMessagingWindow = getActiveMessagingWindow();
  const messagingWindowBlockReason = getMessagingWindowBlockReason(!!pendingTemplate);
  const isMessagingInputLocked = !!messagingWindowBlockReason;

  const { stopPresence: stopEvolutionPresence } = useEvolutionOutboundPresence({
    conversationId: selectedConversation?.id,
    evolutionInstanceId: selectedConversation?.channel?.evolutionInstanceId,
    enabled:
      !!selectedConversation?.channel?.evolutionInstanceId &&
      !selectedConversation?.inBot &&
      !isMessagingInputLocked,
    messageInput,
    recording: voiceRecorder.isRecordingLive,
  });

  if (loading) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-background font-body text-on-surface">
        <p className="text-sm text-on-surface-variant">Carregando conversas...</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden bg-background font-body text-on-surface">
      {/* Modal de preview de mídia (imagem/vídeo em tela cheia) */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setPreviewMedia(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewMedia(null)}
            className="absolute right-4 top-4 cursor-pointer border-none bg-transparent text-lg text-on-surface"
          >
            Fechar ✕
          </button>

          <div
            className="relative flex max-h-[85vh] w-[min(92vw,720px)] max-w-full items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {previewMedia.type === 'IMAGE' ? (
              <img
                src={previewMedia.src}
                alt="Pré-visualização"
                className="max-h-[85vh] max-w-full rounded-lg object-contain"
                onError={(e) => {
                  const imgEl = e.currentTarget;
                  const resilientUrl = previewMedia.messageId
                    ? `${apiBase}/api/media/${previewMedia.messageId}`
                    : null;

                  // 1ª falha: tenta rota resiliente por messageId.
                  if (
                    resilientUrl &&
                    imgEl.dataset.previewFallbackTried !== '1' &&
                    imgEl.src !== resilientUrl
                  ) {
                    imgEl.dataset.previewFallbackTried = '1';
                    imgEl.src = resilientUrl;
                    return;
                  }

                  // Falha final: placeholder visual.
                  imgEl.src =
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="420" height="280"%3E%3Crect fill="%23131716" width="420" height="280"/%3E%3Ctext fill="%23B8C7C0" font-family="sans-serif" font-size="15" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagem n%C3%A3o dispon%C3%ADvel%3C/text%3E%3C/svg%3E';
                }}
              />
            ) : (
              <video
                src={previewMedia.src}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full rounded-lg bg-black object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* Sidebar Esquerda - Lista de Conversas */}
      <div className="flex w-[min(100%,20rem)] shrink-0 flex-col overflow-hidden border-r border-primary/10 bg-surface-container">
        <div className="border-b border-primary/10 bg-surface-container-high px-4 py-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-headline text-lg font-bold tracking-tight text-primary">Conversas</h2>
            <button
              type="button"
              onClick={() => setShowNewConversationModal(true)}
              className="active-gradient-emerald flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-on-primary shadow-emerald-send transition hover:brightness-110"
              title="Iniciar nova conversa"
            >
              <span className="material-symbols-outlined text-base">add_call</span>
              Nova
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {primaryStatusFilters.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-emerald-900/40 text-primary ring-1 ring-primary/20'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="relative" ref={moreStatusFiltersRef}>
              <button
                type="button"
                onClick={() => setShowMoreStatusFilters((prev) => !prev)}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  secondaryStatusFilters.some((opt) => opt.value === statusFilter)
                    ? 'bg-emerald-900/40 text-primary ring-1 ring-primary/20'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
                title="Mais filtros"
              >
                ...
              </button>
              {showMoreStatusFilters && (
                <div className="absolute right-0 z-30 mt-2 min-w-[220px] rounded-xl border border-primary/15 bg-surface-container-high p-1 shadow-forest-glow backdrop-blur-xl">
                  {secondaryStatusFilters.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(opt.value);
                        setShowMoreStatusFilters(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        statusFilter === opt.value
                          ? 'bg-emerald-900/40 text-primary'
                          : 'text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="conv-no-scrollbar flex-1 overflow-y-auto py-2">
          {conversations.filter(conv => 
            !!conv.lastMessage || !!conv.lastCustomerMessageAt || !!conv.lastAgentMessageAt
          ).length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-on-surface-variant">
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <img
                          src={getContactAvatar(conv.contact, 32)}
                          alt={conv.contact.name}
                          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-primary/15"
                        />
                        <h3 className="truncate font-headline text-sm font-bold text-primary-fixed-dim">
                          {conv.contact.name}
                        </h3>
                      </div>
                      <p className="mb-1 truncate text-xs text-primary/80">
                        {getConversationChannelLabel(conv)} • {conv.contact.phone || 'Sem telefone'}
                      </p>
                      <p className="mb-1 truncate text-[11px] text-primary-fixed-dim">
                        Responsável: {conv.assignedTo?.name || 'Aguardando atendimento'}
                      </p>
                      {conv.lastMessage && (
                        <p className="mb-2 truncate text-xs text-outline">
                          {conv.lastMessage}
                        </p>
                      )}
                      <div className="text-[10px] uppercase tracking-wider text-primary/65">
                        {conv.messagingWindow?.applies && !conv.messagingWindow.isOpen && (
                          <div className="mb-0.5 font-bold text-on-error-container">
                            Janela 24h encerrada
                          </div>
                        )}
                        {conv.lastCustomerMessageAt && (
                          <div><span className="text-primary-fixed-dim">Cliente:</span> {getTimeAgo(conv.lastCustomerMessageAt)}</div>
                        )}
                        {conv.lastAgentMessageAt && (
                          <div><span className="text-primary-fixed-dim">Você:</span> {getTimeAgo(conv.lastAgentMessageAt)}</div>
                        )}
                      </div>
                    </div>
                    <div className="ml-1 flex flex-col items-end gap-2">
                      <span className="whitespace-nowrap rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold text-on-secondary-container">
                        {conv.status === 'OPEN'
                          ? 'Aberta'
                          : conv.status === 'WAITING'
                          ? 'Aguardando atendimento'
                          : conv.status === 'CLOSED'
                          ? 'Fechada'
                          : conv.status === 'ARCHIVED'
                          ? 'Arquivada'
                          : conv.status}
                      </span>
                    </div>
                  </div>
                </ConversationCard>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Área Direita - Chat + painel */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-dim">
        {selectedConversation ? (
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Header do Chat */}
            <div className="flex items-center justify-between gap-3 border-b border-primary/10 bg-surface/60 px-5 py-4 backdrop-blur-xl">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-container-highest ring-2 ring-primary/15">
                  <img
                    src={getContactAvatar(selectedConversation.contact, 48)}
                    alt={selectedConversation.contact.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = getAvatarUrl(selectedConversation.contact.name, 48);
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="font-headline text-base font-bold text-primary-fixed-dim">
                      {selectedConversation.contact.name}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        selectedConversation.status === 'OPEN'
                          ? 'bg-primary-container text-on-secondary-container'
                          : selectedConversation.status === 'WAITING'
                          ? 'bg-secondary-container/80 text-on-secondary-container'
                          : selectedConversation.status === 'CLOSED'
                          ? 'bg-surface-container-highest text-on-surface-variant'
                          : 'bg-surface-variant text-on-surface-variant'
                      }`}
                    >
                      {selectedConversation.status === 'OPEN'
                        ? 'Aberta'
                        : selectedConversation.status === 'WAITING'
                        ? 'Aguardando atendimento'
                        : selectedConversation.status === 'CLOSED'
                        ? 'Fechada'
                        : 'Arquivada'}
                    </span>
                  </div>
                  <p className="mt-0 text-xs text-primary/80">
                    {getConversationChannelLabel(selectedConversation)} •{' '}
                    {selectedConversation.contact?.phone || 'Sem telefone'}
                  </p>
                  {contactThreadTabs.length > 1 && (
                    <motion.div className="mt-2 flex flex-wrap gap-1.5">
                      {contactThreadTabs.map((thread: ContactThread) => {
                        const isActive = thread.id === selectedConversation.id;
                        const statusLabel =
                          thread.status === 'OPEN'
                            ? 'Aberta'
                            : thread.status === 'WAITING'
                            ? 'Aguardando'
                            : thread.status === 'CLOSED'
                            ? 'Fechada'
                            : 'Arquivada';
                        const provider =
                          thread.channel?.config?.provider ||
                          thread.channelSnapshot?.provider;
                        const providerTag =
                          provider === 'evolution_go'
                            ? 'GO'
                            : provider === 'evolution'
                              ? 'Evo'
                              : null;
                        return (
                          <button
                            key={thread.id}
                            type="button"
                            disabled={thread.accessible === false}
                            title={
                              thread.accessible === false
                                ? 'Sem permissão para este setor/canal'
                                : undefined
                            }
                            onClick={async () => {
                              if (thread.id === selectedConversation.id) return;
                              const convResp = await api.get(`/api/conversations/${thread.id}`);
                              handleConversationClick(
                                conversationFromDetailApi(convResp.data as Record<string, unknown>),
                              );
                            }}
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                              isActive
                                ? 'border-primary bg-primary-container text-on-secondary-container'
                                : thread.accessible === false
                                  ? 'cursor-not-allowed border-outline/30 bg-surface-container-low text-on-surface-variant/50'
                                  : 'border-primary/20 bg-surface-container text-on-surface-variant hover:border-primary/40'
                            }`}
                          >
                            {getConversationChannelLabel(thread)}
                            {providerTag ? ` (${providerTag})` : ''} · {statusLabel}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                  {contactPresence && (
                    <p className="mt-0.5 text-xs italic text-primary-fixed-dim">
                      {contactPresence === 'recording'
                        ? 'Gravando áudio…'
                        : 'Digitando…'}
                    </p>
                  )}
                  {activeMessagingWindow?.applies && (
                    <motion.div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          activeMessagingWindow.isOpen
                            ? 'bg-primary-container/80 text-on-secondary-container'
                            : 'bg-error-container/90 text-on-error-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {activeMessagingWindow.isOpen ? 'schedule' : 'lock'}
                        </span>
                        {activeMessagingWindow.isOpen
                          ? `Janela 24h · ${formatMessagingWindowRemaining(activeMessagingWindow.remainingMs)}`
                          : 'Janela 24h encerrada'}
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
              <div className="ml-2 flex shrink-0 flex-wrap items-center justify-end gap-2">
                {/* Ícone de bot/integração vs humano */}
                {selectedConversation && (
                  <button
                    type="button"
                    disabled={!currentUser}
                    onClick={async () => {
                      if (!selectedConversation || !currentUser) return;
                      try {
                        if (selectedConversation.inBot) {
                          // Bot/integração -> humano assume
                          await api.post(
                            `/api/conversations/${selectedConversation.id}/assign`,
                            { userId: currentUser.id },
                          );
                        } else {
                          // Humano -> voltar para bot (reativar sessão do bot na conversa)
                          await api.post(`/api/conversations/${selectedConversation.id}/activate-bot`);
                        }

                        // Buscar conversa atualizada (inclui campo inBot calculado no backend)
                        const convResp = await api.get(
                          `/api/conversations/${selectedConversation.id}`,
                        );
                        setSelectedConversation(convResp.data as any);
                        await fetchConversations(statusFilterRef.current);
                      } catch (error: any) {
                        console.error('Erro ao alternar bot/humano na conversa:', error);
                        alert(
                          error.response?.data?.error ||
                            'Erro ao alternar entre bot e humano nesta conversa',
                        );
                      }
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(63,73,69,0.2)] text-base ${
                      selectedConversation.inBot
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-highest text-on-surface'
                    } ${currentUser ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
                    title={
                      selectedConversation.inBot
                        ? 'Bot/integração ativo - clique para assumir atendimento'
                        : 'Atendimento humano - clique para devolver ao bot/integração'
                    }
                  >
                    🤖
                  </button>
                )}

                {selectedConversation.status === 'CLOSED' || selectedConversation.status === 'ARCHIVED' ? (
                  <button
                    type="button"
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
                    className="active-gradient-emerald rounded-lg px-3 py-2 text-xs font-bold text-on-primary shadow-emerald-send"
                    title="Abrir conversa"
                  >
                    Abrir
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: 'Fechar conversa',
                        message: 'Tem certeza que deseja fechar esta conversa?',
                        confirmText: 'Fechar',
                        cancelText: 'Cancelar',
                      });
                      if (!confirmed) return;
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
                    className="rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-highest px-3 py-2 text-xs font-bold text-on-surface-variant transition hover:bg-surface-variant"
                    title="Fechar conversa"
                  >
                    Fechar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowTransferModal(true)}
                  className="rounded-lg border border-primary/25 bg-transparent px-3 py-2 text-xs font-bold text-primary transition hover:bg-emerald-900/20"
                  title="Transferir conversa"
                >
                  Transferir
                </button>
                <button
                  type="button"
                  disabled={
                    sendingSatisfactionSurvey ||
                    !selectedConversation.channelId ||
                    selectedConversation.status === 'CLOSED' ||
                    selectedConversation.status === 'ARCHIVED'
                  }
                  onClick={async () => {
                    if (!selectedConversation?.channelId) return;
                    setSendingSatisfactionSurvey(true);
                    try {
                      const { data } = await api.post<{ message: Message }>(
                        `/api/conversations/${selectedConversation.id}/satisfaction-survey`,
                      );
                      if (data?.message) {
                        setMessages((prev) => [...prev, data.message]);
                      }
                    } catch (error: any) {
                      alert(error.response?.data?.error || 'Erro ao enviar pesquisa de satisfação');
                    } finally {
                      setSendingSatisfactionSurvey(false);
                    }
                  }}
                  className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Enviar pesquisa de 1 a 5 estrelas ao cliente (WhatsApp)"
                >
                  {sendingSatisfactionSurvey ? 'Enviando…' : 'Pesquisa'}
                </button>
              </div>
              <span className="hidden rounded-md bg-surface-container-highest px-2 py-1 text-[11px] text-on-surface-variant sm:inline">
                {selectedConversation.status}
              </span>
              {currentUser && currentUser.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedConversation) return;
                    const confirmed = await confirm({
                      title: 'Excluir conversa',
                      message:
                        'Tem certeza que deseja excluir definitivamente esta conversa? Esta ação não pode ser desfeita.',
                      confirmText: 'Excluir',
                      cancelText: 'Cancelar',
                    });
                    if (!confirmed) {
                      return;
                    }
                    try {
                      await api.delete(`/api/conversations/${selectedConversation.id}`);
                      setConversations((prev) =>
                        prev.filter((conv) => conv.id !== selectedConversation.id),
                      );
                      setSelectedConversation(null);
                      setMessages([]);
                    } catch (error: any) {
                      console.error('Erro ao excluir conversa:', error);
                      alert(error.response?.data?.error || 'Erro ao excluir conversa');
                    }
                  }}
                  className="rounded-lg bg-error-container px-2.5 py-1.5 text-[11px] font-bold text-on-error-container"
                  title="Excluir conversa (apenas administradores)"
                >
                  Excluir
                </button>
              )}
            </div>

            {/* Área de Mensagens — flex-col + min-h-0 para o scroll interno funcionar (filho flex-1 encolhe) */}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
              ref={messagesScrollRef}
              onScroll={handleMessagesPaneScroll}
              className="conv-no-scrollbar flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden bg-surface-container-lowest/70 p-5"
            >
              {loadingMessages ? (
                <div className="py-10 text-center text-sm text-on-surface-variant">
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="py-10 text-center text-on-surface-variant">
                  <p className="text-sm">Nenhuma mensagem ainda.</p>
                  <p className="mt-2 text-xs text-primary/70">
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
                  {/* Paginação: carregar mensagens mais antigas */}
                  {hasMoreMessages && !loadingMessages && !loadingMoreMessages && (
                    <div className="mb-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedConversation) {
                            fetchMessages(selectedConversation.id, { reset: false });
                          }
                        }}
                        className="cursor-pointer rounded-full border border-[rgba(63,73,69,0.2)] bg-surface-container-highest px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-variant"
                      >
                        Carregar mensagens anteriores
                      </button>
                    </div>
                  )}
                  {loadingMoreMessages && (
                    <div className="mb-2 text-center text-xs text-on-surface-variant">
                      Carregando mensagens anteriores...
                    </div>
                  )}

                  {messages.map((message, index) => {
                    const messageDate = new Date(message.createdAt);
                    const dateLabel = messageDate.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });

                    let showDateDivider = false;
                    if (index === 0) {
                      showDateDivider = true;
                    } else {
                      const prev = messages[index - 1];
                      const prevDate = new Date(prev.createdAt);
                      const prevLabel = prevDate.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });
                      if (prevLabel !== dateLabel) {
                        showDateDivider = true;
                      }
                    }
                    const isBotMessage = message.metadata?.fromBot === true;
                    const taskData = getTaskNotificationData(message);
                    const noteData = getNoteNotificationData(message);
                    const isTaskNotification =
                      isBotMessage && taskData !== null;
                    const isNoteNotification = isBotMessage && noteData !== null;
                    const isFromCustomer = !isBotMessage && message.userId === null;
                    const isOwnMessage =
                      message.userId !== null || (isBotMessage && !isTaskNotification && !isNoteNotification);
                    const contactName = selectedConversation?.contact.name || '';
                    const contactAvatar = selectedConversation
                      ? getContactAvatar(selectedConversation.contact)
                      : getAvatarUrl('Contato', 40);
                    
                    return (
                      <div key={message.id}>
                        {showDateDivider && (
                          <div className="relative my-3 text-center text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                            <span className="rounded-full border border-primary/10 bg-emerald-950/25 px-4 py-1">
                              {dateLabel}
                            </span>
                          </div>
                        )}

                      <motion.div
                        variants={{
                          hidden: { opacity: 0, y: 10, scale: 0.95 },
                          visible: { opacity: 1, y: 0, scale: 1 },
                        }}
                        transition={{ 
                          duration: 0.2,
                          type: "spring",
                          stiffness: 200
                        }}
                        className={`mb-1 flex w-full min-w-0 max-w-full items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                      >
                      {/* Avatar do cliente (só aparece em mensagens do cliente) */}
                      {isFromCustomer && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-highest ring-1 ring-primary/15">
                          <img
                            src={contactAvatar}
                            alt={contactName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              // Se falhar, usar SVG inline
                              const target = e.target as HTMLImageElement;
                              target.src = contactAvatar;
                            }}
                          />
                        </div>
                      )}
                      
                      <motion.div
                        className={`relative min-w-0 ${isTaskNotification ? 'w-full max-w-full' : 'max-w-[min(70%,36rem)]'} rounded-xl px-0 py-0 ${
                          isTaskNotification
                            ? 'rounded-lg bg-surface-container-highest p-3 text-on-surface'
                            : 'bg-transparent text-on-surface'
                        }`}
                        whileHover={{ scale: 1.0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isFromCustomer && (
                          <div className="mb-1 text-xs font-semibold text-on-surface-variant">
                            {contactName}
                          </div>
                        )}
                        
                        {/* Exibir mídia se houver */}
                        {['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(message.type) && message.id && (
                          <div style={{ marginBottom: '8px' }}>
                            {message.type === 'IMAGE' && (
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img
                                  src={`${apiBase}/api/media/${message.id}`}
                                  alt={message.content || 'Imagem'}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '300px',
                                    borderRadius: '8px',
                                    objectFit: 'contain',
                                    display: 'block',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => {
                                    setPreviewMedia({
                                      type: 'IMAGE',
                                      src: getPreviewSrc(message),
                                      messageId: message.id,
                                    });
                                  }}
                                  onLoad={() => {
                                    console.log('✅ Imagem carregada com sucesso:', message.id);
                                  }}
                                  onError={(e) => {
                                    console.error('❌ Erro ao carregar imagem:', message.id, e);
                                    const imgEl = e.target as HTMLImageElement;
                                    // Evitar loop infinito: se já tentamos fallback uma vez, mostra placeholder e sai
                                    if (imgEl.dataset.fallbackTried === '1') {
                                      imgEl.onerror = null;
                                      imgEl.src =
                                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagem não disponível%3C/text%3E%3C/svg%3E';
                                      return;
                                    }

                                    // Marcar que o fallback já foi tentado
                                    imgEl.dataset.fallbackTried = '1';

                                    // Fallback: tentar URL direta do metadata se disponível
                                    if (
                                      message.metadata?.mediaUrl &&
                                      isDirectlyRenderableMediaUrl(
                                        message.metadata.mediaUrl,
                                        message.metadata,
                                      )
                                    ) {
                                      imgEl.src = resolveMediaMetadataUrl(message.metadata.mediaUrl);
                                    } else {
                                      imgEl.src =
                                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagem não disponível%3C/text%3E%3C/svg%3E';
                                    }
                                  }}
                                />
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 6,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMediaMenuId((prev) =>
                                        prev === message.id ? null : message.id
                                      );
                                    }}
                                    style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: '999px',
                                      border: 'none',
                                      backgroundColor: 'rgba(0,0,0,0.6)',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: '16px',
                                    }}
                                    title="Mais opções"
                                  >
                                    ⋮
                                  </button>
                                  {openMediaMenuId === message.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 py-1.5 shadow-forest-glow backdrop-blur-xl"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDownloadMedia(message);
                                          setOpenMediaMenuId(null);
                                        }}
                                        className="w-full cursor-pointer border-none bg-transparent px-3.5 py-1.5 text-left text-sm text-on-surface hover:bg-emerald-900/20"
                                      >
                                        Baixar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {message.type === 'VIDEO' && (
                              <div
                                style={{
                                  position: 'relative',
                                  display: 'inline-block',
                                  maxWidth: '100%',
                                  maxHeight: '320px',
                                  borderRadius: '12px',
                                  overflow: 'hidden',
                                  backgroundColor: '#000',
                                }}
                              >
                                <video
                                  src={`${apiBase}/api/media/${message.id}`}
                                  controls={false}
                                  style={{
                                    width: '100%',
                                    maxHeight: '320px',
                                    display: 'block',
                                    objectFit: 'cover',
                                  }}
                                  preload="metadata"
                                  crossOrigin="anonymous"
                                  ref={(el) => {
                                    videoRefs.current[message.id] = el;
                                  }}
                                  onLoadedMetadata={(ev) => {
                                    const el = ev.currentTarget;
                                    console.log('✅ Vídeo carregado com sucesso:', message.id);
                                    setVideoState((prev) => ({
                                      ...prev,
                                      [message.id]: {
                                        playing: false,
                                        currentTime: 0,
                                        duration: el.duration || prev[message.id]?.duration || 0,
                                      },
                                    }));
                                  }}
                                  onTimeUpdate={(ev) => {
                                    const el = ev.currentTarget;
                                    setVideoState((prev) => ({
                                      ...prev,
                                      [message.id]: {
                                        playing: !el.paused,
                                        currentTime: el.currentTime,
                                        duration: el.duration || prev[message.id]?.duration || 0,
                                      },
                                    }));
                                  }}
                                  onPause={(ev) => {
                                    const el = ev.currentTarget;
                                    setVideoState((prev) => ({
                                      ...prev,
                                      [message.id]: {
                                        playing: false,
                                        currentTime: el.currentTime,
                                        duration: el.duration || prev[message.id]?.duration || 0,
                                      },
                                    }));
                                  }}
                                  onError={(e) => {
                                    console.error('❌ Erro ao carregar vídeo:', message.id, e);
                                    const videoEl = e.target as HTMLVideoElement;
                                    // Fallback: tentar URL direta do metadata se disponível
                                    if (
                                      message.metadata?.mediaUrl &&
                                      isDirectlyRenderableMediaUrl(
                                        message.metadata.mediaUrl,
                                        message.metadata,
                                      )
                                    ) {
                                      videoEl.src = resolveMediaMetadataUrl(message.metadata.mediaUrl);
                                    }
                                  }}
                                />

                                {/* Botão play/pause central, estilo WhatsApp */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const videoEl = videoRefs.current[message.id];
                                    if (!videoEl) return;

                                    // Pausar outros vídeos
                                    Object.entries(videoRefs.current).forEach(([id, el]) => {
                                      if (el && !el.paused && id !== message.id) {
                                        el.pause();
                                      }
                                    });

                                    if (videoEl.paused) {
                                      videoEl
                                        .play()
                                        .then(() => {
                                          setVideoState((prev) => ({
                                            ...prev,
                                            [message.id]: {
                                              playing: true,
                                              currentTime: prev[message.id]?.currentTime || 0,
                                              duration: prev[message.id]?.duration || videoEl.duration || 0,
                                            },
                                          }));
                                        })
                                        .catch((err) => {
                                          console.error('Erro ao reproduzir vídeo:', err);
                                        });
                                    } else {
                                      videoEl.pause();
                                    }
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 52,
                                    height: 52,
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: 'rgba(0,0,0,0.6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    fontSize: '22px',
                                  }}
                                >
                                  {videoState[message.id]?.playing ? '⏸' : '▶'}
                                </button>

                                {/* Indicador de progresso e tempo no rodapé do vídeo */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    padding: '6px 10px',
                                    background:
                                      'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))',
                                    color: '#fff',
                                    fontSize: '12px',
                                  }}
                                >
                                  <div
                                    style={{
                                      height: '3px',
                                      borderRadius: '999px',
                                      backgroundColor: 'rgba(255,255,255,0.3)',
                                      overflow: 'hidden',
                                      marginBottom: '4px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: '100%',
                                        width: `${
                                          videoState[message.id]?.duration
                                            ? Math.min(
                                                100,
                                                (videoState[message.id].currentTime /
                                                  videoState[message.id].duration) *
                                                  100,
                                              )
                                            : 0
                                        }%`,
                                        backgroundColor: '#25D366',
                                        transition: 'width 0.15s linear',
                                      }}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      opacity: 0.9,
                                    }}
                                  >
                                    <span>
                                      {formatAudioTime(
                                        videoState[message.id]?.currentTime || 0,
                                      )}
                                    </span>
                                    <span>
                                      {formatAudioTime(
                                        videoState[message.id]?.duration || 0,
                                      )}
                                    </span>
                                  </div>
                                </div>

                                {/* Botão de menu (três pontinhos) para ações adicionais */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 6,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMediaMenuId((prev) =>
                                        prev === message.id ? null : message.id,
                                      );
                                    }}
                                    style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: '999px',
                                      border: 'none',
                                      backgroundColor: 'rgba(0,0,0,0.6)',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: '16px',
                                    }}
                                    title="Mais opções"
                                  >
                                    ⋮
                                  </button>
                                  {openMediaMenuId === message.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 py-1.5 shadow-forest-glow backdrop-blur-xl"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDownloadMedia(message);
                                          setOpenMediaMenuId(null);
                                        }}
                                        className="w-full cursor-pointer border-none bg-transparent px-3.5 py-1.5 text-left text-sm text-on-surface hover:bg-emerald-900/20"
                                      >
                                        Baixar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {message.type === 'AUDIO' && (
                              <div
                                className={`flex min-w-[260px] items-center gap-3 rounded-full border border-[rgba(63,73,69,0.2)] px-3 py-2.5 ${
                                  isOwnMessage ? 'bg-emerald-950/35' : 'bg-surface-container-highest'
                                }`}
                              >
                                {/* Botão play/pause customizado, estilo WhatsApp */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const audioEl = audioRefs.current[message.id];
                                    if (!audioEl) return;

                                    // Pausar outros áudios
                                    Object.entries(audioRefs.current).forEach(([id, el]) => {
                                      if (el && !el.paused && id !== message.id) {
                                        el.pause();
                                      }
                                    });

                                    if (audioEl.paused) {
                                      audioEl
                                        .play()
                                        .then(() => {
                                          setAudioState((prev) => ({
                                            ...prev,
                                            [message.id]: {
                                              playing: true,
                                              currentTime: prev[message.id]?.currentTime || 0,
                                              duration: prev[message.id]?.duration || audioEl.duration || 0,
                                            },
                                          }));
                                        })
                                        .catch((err) => {
                                          console.error('Erro ao reproduzir áudio:', err);
                                        });
                                    } else {
                                      audioEl.pause();
                                      setAudioState((prev) => ({
                                        ...prev,
                                        [message.id]: {
                                          playing: false,
                                          currentTime: prev[message.id]?.currentTime || audioEl.currentTime || 0,
                                          duration: prev[message.id]?.duration || audioEl.duration || 0,
                                        },
                                      }));
                                    }
                                  }}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#25D366',
                                    color: 'white',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                                  }}
                                >
                                  {audioState[message.id]?.playing ? '⏸' : '▶'}
                                </button>

                                {/* Barra de progresso simples + duração */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      height: '4px',
                                      borderRadius: '999px',
                                      backgroundColor: isOwnMessage ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.08)',
                                      overflow: 'hidden',
                                      marginBottom: '6px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: '100%',
                                        width: `${
                                          audioState[message.id]?.duration
                                            ? Math.min(
                                                100,
                                                (audioState[message.id].currentTime /
                                                  audioState[message.id].duration) *
                                                  100,
                                              )
                                            : 0
                                        }%`,
                                        backgroundColor: '#25D366',
                                        transition: 'width 0.15s linear',
                                      }}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '12px',
                                      opacity: 0.8,
                                    }}
                                  >
                                    <span>{formatAudioTime(audioState[message.id]?.currentTime || 0)}</span>
                                    <span>{formatAudioTime(audioState[message.id]?.duration || 0)}</span>
                                  </div>
                                </div>

                                {/* Áudio real (nativo), mas oculto; usado como engine do player */}
                                <audio
                                  src={`${apiBase}/api/media/${message.id}`}
                                  controls={false}
                                  style={{ display: 'none' }}
                                  preload="metadata"
                                  crossOrigin="anonymous"
                                  ref={(el) => {
                                    audioRefs.current[message.id] = el;
                                  }}
                                  onError={(e) => {
                                    console.error('❌ Erro ao carregar áudio via /api/media/:id:', message.id, e);
                                    const audioEl = e.target as HTMLAudioElement;
                                    // Fallback: tentar URL direta do metadata
                                    if (
                                      message.metadata?.mediaUrl &&
                                      isDirectlyRenderableMediaUrl(
                                        message.metadata.mediaUrl,
                                        message.metadata,
                                      )
                                    ) {
                                      audioEl.src = resolveMediaMetadataUrl(message.metadata.mediaUrl);
                                    }
                                  }}
                                  onLoadedMetadata={(ev) => {
                                    const el = ev.currentTarget;
                                    console.log('✅ Áudio carregado com sucesso:', message.id);
                                    setAudioState((prev) => ({
                                      ...prev,
                                      [message.id]: {
                                        playing: false,
                                        currentTime: 0,
                                        duration: el.duration || prev[message.id]?.duration || 0,
                                      },
                                    }));
                                  }}
                                  onTimeUpdate={(ev) => {
                                    const el = ev.currentTarget;
                                    setAudioState((prev) => ({
                                      ...prev,
                                      [message.id]: {
                                        playing: !el.paused,
                                        currentTime: el.currentTime,
                                        duration: el.duration || prev[message.id]?.duration || 0,
                                      },
                                    }));
                                  }}
                                  onPause={(ev) => {
                                    const el = ev.currentTarget;
                                    setAudioState((prev) => ({
                                      ...prev,
                                      [message.id]: {
                                        playing: false,
                                        currentTime: el.currentTime,
                                        duration: el.duration || prev[message.id]?.duration || 0,
                                      },
                                    }));
                                  }}
                                />

                                {/* Menu de três pontinhos para ações (baixar, responder) */}
                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMediaMenuId((prev) =>
                                        prev === message.id ? null : message.id,
                                      );
                                    }}
                                    style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: '999px',
                                      border: 'none',
                                      backgroundColor: 'rgba(0,0,0,0.6)',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: '16px',
                                    }}
                                    title="Mais opções"
                                  >
                                    ⋮
                                  </button>
                                  {openMediaMenuId === message.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 py-1.5 shadow-forest-glow backdrop-blur-xl"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDownloadMedia(message);
                                          setOpenMediaMenuId(null);
                                        }}
                                        className="w-full cursor-pointer border-none bg-transparent px-3.5 py-1.5 text-left text-sm text-on-surface hover:bg-emerald-900/20"
                                      >
                                        Baixar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {message.type === 'DOCUMENT' && (
                              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-emerald-950/30 p-3">
                                <span className="text-2xl">📄</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-on-surface">
                                    {message.metadata?.fileName || 'Documento'}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadMedia(message)}
                                    className={`mt-1 cursor-pointer rounded-full px-2 py-1 text-xs font-bold ${
                                      isOwnMessage
                                        ? 'active-gradient-emerald text-on-primary'
                                        : 'border border-[rgba(63,73,69,0.2)] bg-surface-container-highest text-on-surface'
                                    }`}
                                  >
                                    Baixar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Exibir texto apenas para mensagens de texto.
                            Para mídias (imagem, vídeo, áudio, documento) não mostramos mais o "título"/arquivo abaixo. */}
                        {taskData && message.type === 'TEXT' ? (
                          <TaskNotificationCard
                            task={taskData}
                            onSaveResult={handleSaveTaskResult}
                            onComplete={handleCompleteTask}
                          />
                        ) : noteData && message.type === 'TEXT' ? (
                          <NoteNotificationCard note={noteData} />
                        ) : (
                        message.content && message.type === 'TEXT' && (
                          <div
                            className={`inline-block max-w-full whitespace-pre-wrap break-words px-3 py-2 text-sm leading-relaxed ${
                              isOwnMessage
                                ? 'active-gradient-emerald rounded-2xl rounded-br-none text-on-primary shadow-emerald-send'
                                : 'rounded-2xl rounded-bl-none border border-primary/5 bg-surface-container-highest text-on-surface'
                            }`}
                          >
                            {message.metadata?.satisfactionSurveyResponse &&
                            typeof message.metadata?.score === 'number' ? (
                              <div className="space-y-1">
                                <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                                  Pesquisa de satisfação
                                </div>
                                <div className="text-2xl leading-none tracking-tight">
                                  {'⭐'.repeat(
                                    Math.min(5, Math.max(1, Number(message.metadata.score))),
                                  )}
                                </div>
                                <div className="text-xs opacity-90">
                                  Nota {message.metadata.score} de 5
                                </div>
                              </div>
                            ) : message.metadata?.satisfactionSurveyPrompt ? (
                              <div className="space-y-1">
                                <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
                                  Pesquisa de satisfação
                                </div>
                                {message.user?.name && (
                                  <div className="text-xs font-semibold leading-tight text-black">
                                    {message.user.name}
                                  </div>
                                )}
                                <p>{message.content}</p>
                                {message.metadata?.variant === 'interactive_list' && (
                                  <p className="text-xs opacity-80">
                                    No WhatsApp do cliente: botão &quot;Dar nota&quot; e lista de 1 a 5
                                    estrelas.
                                  </p>
                                )}
                                {message.metadata?.variant === 'text_prompt' && (
                                  <p className="text-xs opacity-80">
                                    No Evolution: o cliente responde só com o número 1 a 5.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {message.user?.name && (
                                  <div className="text-xs font-semibold leading-tight text-black">
                                    {message.user.name}
                                  </div>
                                )}
                                <div>
                                  {message.content}
                                  {message.metadata?.editedAt && (
                                    <span className="ml-1 text-[10px] opacity-70">(editada)</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {Array.isArray(message.metadata?.buttons) &&
                              message.metadata!.buttons!.length > 0 && (
                                <div className="mt-2 space-y-1.5">
                                  {message.metadata!.buttons!.map((btn, btnIndex) => (
                                    <div
                                      key={`${message.id}-btn-${btnIndex}`}
                                      className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                                        isOwnMessage
                                          ? 'border-emerald-300/35 bg-emerald-900/25 text-emerald-100'
                                          : 'border-[rgba(63,73,69,0.45)] bg-surface-container text-on-surface-variant'
                                      }`}
                                    >
                                      {btn?.text || btn?.title || `Opção ${btnIndex + 1}`}
                                      {btn?.description ? (
                                        <div className="mt-0.5 text-[10px] opacity-80">{btn.description}</div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        ))}

                        <div
                          className={`mt-1.5 flex items-center gap-1 text-[10px] text-on-surface-variant ${
                            isOwnMessage ? 'justify-end text-right' : 'text-left'
                          }`}
                        >
                          <span>{formatTime(message.createdAt)}</span>
                          {message.userId && (
                            <span
                              title={
                                (message.status || '').toUpperCase() === 'FAILED'
                                  ? message.metadata?.sendError?.message || 'Falha no envio'
                                  : (message.status || '').toUpperCase() === 'DELIVERED' ||
                                      (message.status || '').toUpperCase() === 'READ'
                                    ? 'Entregue'
                                    : 'Enviado'
                              }
                              className={`text-xs leading-none ${getDeliveryCheckClass(message.status)}`}
                            >
                              {(message.status || '').toUpperCase() === 'FAILED' ? '✗' : '✓'}
                            </span>
                          )}
                        </div>
                        {isOwnMessage &&
                          (message.status || '').toUpperCase() === 'FAILED' &&
                          message.metadata?.sendError?.message && (
                            <p className="mt-1 text-[10px] text-red-400/90">
                              {message.metadata.sendError.message}
                            </p>
                          )}
                      </motion.div>
                      
                      {/* Avatar do agente (só aparece em mensagens do agente) */}
                      {isOwnMessage && message.user && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-highest ring-1 ring-primary/15">
                          <img
                            src={getAvatarUrl(message.user.name)}
                            alt={message.user.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = getAvatarUrl(message.user!.name);
                            }}
                          />
                        </div>
                        )}
                      </motion.div>
                      </div>
                    );
                })}
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {newMessagesBelowCount > 0 && (
              <button
                type="button"
                onClick={scrollChatToLatest}
                className="absolute bottom-4 right-5 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-surface-container-highest/95 text-primary shadow-lg backdrop-blur-md transition hover:bg-emerald-950/50 hover:shadow-emerald-glow"
                title={`${newMessagesBelowCount} nova(s) mensagem(ns) — ir ao fim`}
                aria-label={`Ir às mensagens novas (${newMessagesBelowCount})`}
              >
                <span className="material-symbols-outlined text-2xl">keyboard_arrow_down</span>
                <span className="absolute -right-1 -top-1 flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary">
                  {newMessagesBelowCount > 99 ? '99+' : newMessagesBelowCount}
                </span>
              </button>
            )}
            </div>

            {/* Input de Mensagem */}
            <div className="relative border-t border-primary/10 bg-surface-container-low/60 px-5 py-4 backdrop-blur-md">
              {pendingTemplate && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary-container/30 px-3 py-2 text-xs text-on-secondary-container">
                  <span className="material-symbols-outlined text-base">campaign</span>
                  <span>
                    Enviando template <strong>{pendingTemplate.name}</strong> — preencha o texto e
                    confirme o envio.
                  </span>
                </div>
              )}
              {messagingWindowBlockReason && !pendingTemplate && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2 text-xs text-on-error-container">
                  <span className="material-symbols-outlined shrink-0 text-base">info</span>
                  <div>
                    <p>{messagingWindowBlockReason}</p>
                    <button
                      type="button"
                      onClick={() => setShowQuickReplies(true)}
                      className="mt-1 font-semibold underline hover:no-underline"
                    >
                      Abrir respostas rápidas / templates
                    </button>
                  </div>
                </div>
              )}
              {sendError && (
                <motion.div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/35 bg-red-950/35 px-3 py-2 text-xs text-red-200">
                  <span className="material-symbols-outlined shrink-0 text-base">error</span>
                  <div className="min-w-0 flex-1">
                    <p>{sendError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSendError(null)}
                    className="shrink-0 text-red-300/80 hover:text-red-100"
                    aria-label="Fechar aviso"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </motion.div>
              )}
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute bottom-20 left-5 z-[1000]">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width={350}
                    height={400}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}

              {(voiceRecorder.isRecordingSession || voiceRecorder.preview) && (
                <motion.div
                  className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-surface-container-low px-3 py-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {voiceRecorder.isRecordingSession ? (
                    <>
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${voiceRecorder.isPaused ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`}
                        aria-hidden
                      />
                      <span className="text-xs font-semibold text-on-surface">
                        {voiceRecorder.isPaused ? 'Gravação pausada' : 'Gravando'} · {voiceRecorder.formatElapsed()}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <IconButton
                          type="button"
                          onClick={() => voiceRecorder.cancelAll()}
                          icon={<span className="material-symbols-outlined text-lg">close</span>}
                          tooltip="Cancelar gravação"
                          className="!h-8 !w-8 !border-0 !bg-transparent"
                        />
                        {voiceRecorder.supportsPause && (
                          <IconButton
                            type="button"
                            onClick={() =>
                              voiceRecorder.isPaused ? voiceRecorder.resume() : voiceRecorder.pause()
                            }
                            icon={
                              <span className="material-symbols-outlined text-lg">
                                {voiceRecorder.isPaused ? 'play_arrow' : 'pause'}
                              </span>
                            }
                            tooltip={voiceRecorder.isPaused ? 'Retomar gravação' : 'Pausar gravação'}
                            className="!h-8 !w-8 !border-0 !bg-transparent"
                          />
                        )}
                        <IconButton
                          type="button"
                          onClick={() => voiceRecorder.finish()}
                          icon={<span className="material-symbols-outlined text-lg text-primary">check</span>}
                          tooltip="Concluir e ouvir antes de enviar"
                          className="!h-8 !w-8 !border-0 !bg-transparent"
                        />
                      </div>
                    </>
                  ) : voiceRecorder.preview ? (
                    <>
                      <IconButton
                        type="button"
                        onClick={() => voiceRecorder.togglePreviewPlayback()}
                        icon={
                          <span className="material-symbols-outlined text-xl text-primary">
                            {voiceRecorder.previewPlaying ? 'pause' : 'play_arrow'}
                          </span>
                        }
                        tooltip={voiceRecorder.previewPlaying ? 'Pausar reprodução' : 'Ouvir gravação'}
                        className="!h-9 !w-9 !border-primary/30 !bg-primary-container/40"
                      />
                      <span className="text-xs font-semibold text-on-surface">Áudio pronto — ouça antes de enviar</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => voiceRecorder.discardPreview()}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-on-surface-variant hover:bg-surface-variant"
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          onClick={() => void voiceRecorder.sendPreview()}
                          disabled={voiceRecorder.sending || uploadingFile}
                          className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-on-primary disabled:opacity-50"
                        >
                          {voiceRecorder.sending ? 'Enviando…' : 'Enviar áudio'}
                        </button>
                      </div>
                    </>
                  ) : null}
                </motion.div>
              )}

              <motion.form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (voiceRecorder.isRecordingSession) {
                    voiceRecorder.finish();
                    return;
                  }
                  if (voiceRecorder.preview) {
                    void voiceRecorder.sendPreview();
                    return;
                  }
                  handleSendMessage(e);
                }}
                className="flex gap-2 items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Botão Respostas Rápidas */}
                <IconButton
                  type="button"
                  onClick={() => setShowQuickReplies(true)}
                  icon={<span className="material-symbols-outlined text-xl text-primary-fixed-dim">bolt</span>}
                  tooltip="Respostas rápidas"
                  className="!border !border-[rgba(63,73,69,0.2)] !bg-transparent !text-primary-fixed-dim hover:!bg-emerald-900/25 focus:!ring-primary/30"
                />

                {/* Botão Emoji */}
                <IconButton
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  icon={<span className="text-2xl">😊</span>}
                  tooltip="Emojis"
                  className="!border !border-[rgba(63,73,69,0.2)] !bg-transparent hover:!bg-emerald-900/25 focus:!ring-primary/30"
                />

                {/* Botão Upload */}
                <IconButton
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || sending || isMessagingInputLocked}
                  icon={<span className="material-symbols-outlined text-xl text-primary-fixed-dim">attach_file</span>}
                  tooltip={
                    isMessagingInputLocked
                      ? 'Envio bloqueado — use um template aprovado'
                      : 'Enviar arquivo'
                  }
                  className="!border !border-[rgba(63,73,69,0.2)] !bg-transparent !text-primary-fixed-dim hover:!bg-emerald-900/25 focus:!ring-primary/30"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />

                {/* Botão Gravar Áudio */}
                {!voiceRecorder.isRecordingSession && !voiceRecorder.preview ? (
                  <IconButton
                    type="button"
                    onClick={handleStartVoiceRecording}
                    disabled={sending || uploadingFile || voiceRecorder.sending || isMessagingInputLocked}
                    icon={<span className="material-symbols-outlined text-xl text-primary-fixed-dim">mic</span>}
                    tooltip={
                      isMessagingInputLocked
                        ? 'Envio bloqueado — use um template aprovado'
                        : 'Gravar áudio'
                    }
                    className="!border !border-[rgba(63,73,69,0.2)] !bg-transparent !text-primary-fixed-dim hover:!bg-emerald-900/25 focus:!ring-primary/30"
                  />
                ) : voiceRecorder.isRecordingSession ? (
                  <motion.button
                    type="button"
                    onClick={() => voiceRecorder.finish()}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white"
                    title="Concluir gravação e ouvir"
                    animate={{ scale: voiceRecorder.isPaused ? 1 : [1, 1.1, 1] }}
                    transition={{
                      duration: 1,
                      repeat: voiceRecorder.isPaused ? 0 : Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <span className="material-symbols-outlined text-xl">stop</span>
                  </motion.button>
                ) : null}

                <motion.input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    voiceRecorder.isRecordingSession
                      ? voiceRecorder.isPaused
                        ? 'Gravação pausada...'
                        : 'Gravando áudio...'
                      : voiceRecorder.preview
                        ? 'Ouça o áudio acima e clique em Enviar áudio'
                        : uploadingFile
                          ? 'Enviando arquivo...'
                          : pendingTemplate
                            ? 'Texto do template...'
                            : isMessagingInputLocked
                              ? 'Janela 24h encerrada — use template'
                              : 'Digite sua mensagem...'
                  }
                  disabled={
                    voiceRecorder.isRecordingSession ||
                    !!voiceRecorder.preview ||
                    uploadingFile ||
                    (isMessagingInputLocked && !pendingTemplate)
                  }
                  className="min-w-0 flex-1 rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/30 disabled:opacity-60"
                  whileFocus={{ scale: 1.01 }}
                />

                <motion.button
                  type="submit"
                  disabled={
                    (!messageInput.trim() &&
                      !voiceRecorder.isRecordingSession &&
                      !voiceRecorder.preview &&
                      !uploadingFile) ||
                    sending ||
                    uploadingFile ||
                    voiceRecorder.sending ||
                    (isMessagingInputLocked && !pendingTemplate)
                  }
                  className="flex min-w-[3rem] shrink-0 items-center justify-center rounded-xl px-3 py-2.5 text-on-primary shadow-emerald-send transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 active-gradient-emerald hover:brightness-110"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {sending || uploadingFile ? (
                    <span className="max-w-[4.5rem] truncate text-center text-[11px] font-bold leading-tight">
                      Enviando…
                    </span>
                  ) : voiceRecorder.isRecordingSession ? (
                    <span className="max-w-[4.5rem] truncate text-center text-[11px] font-bold leading-tight">
                      {voiceRecorder.isPaused ? 'Pausado' : 'Gravando…'}
                    </span>
                  ) : voiceRecorder.preview ? (
                    <span className="max-w-[4.5rem] truncate text-center text-[11px] font-bold leading-tight">
                      Enviar
                    </span>
                  ) : (
                    <span
                      className="material-symbols-outlined text-[22px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      send
                    </span>
                  )}
                </motion.button>
              </motion.form>
            </div>
          </div>

            <aside className="conv-no-scrollbar hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-primary/10 bg-surface-container-low lg:flex">
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <div className="relative mb-4 h-24 w-24 rounded-full border-4 border-primary/15 p-0.5 shadow-forest-glow">
                  <img
                    src={getContactAvatar(selectedConversation.contact, 96)}
                    alt={selectedConversation.contact.name}
                    className="h-full w-full rounded-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = getAvatarUrl(selectedConversation.contact.name, 96);
                    }}
                  />
                  <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-4 border-surface-container-low bg-primary" aria-hidden />
                </div>
                <h3 className="font-headline text-lg font-bold text-on-surface">
                  {selectedConversation.contact.name}
                </h3>
                <p className="mb-6 text-xs font-semibold text-primary/70">
                  {getConversationChannelLabel(selectedConversation)} • {selectedConversation.contact.phone || '—'}
                </p>
                <div className="w-full space-y-5 text-left">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary/50">Contato</p>
                    <div className="flex items-center gap-2 text-sm text-on-surface">
                      <span className="material-symbols-outlined text-base text-primary-fixed-dim">call</span>
                      <span>{selectedConversation.contact.phone || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary/50">Segmentação</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-primary/20 bg-primary-container px-3 py-1 text-[10px] font-bold text-on-secondary-container">
                        {selectedConversation.status}
                      </span>
                      <span className="rounded-full border border-[rgba(63,73,69,0.2)] bg-surface-container-highest px-3 py-1 text-[10px] font-bold text-on-surface-variant">
                        {selectedConversation.channel?.type || 'CANAL'}
                      </span>
                      {selectedConversation.inBot && (
                        <span className="rounded-full border border-primary/20 bg-emerald-950/40 px-3 py-1 text-[10px] font-bold text-primary">
                          BOT ATIVO
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-primary/10 pt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary/50">Ações rápidas</p>
                    <button
                      type="button"
                      onClick={() => setShowTransferModal(true)}
                      className="group flex w-full items-center justify-between rounded-xl border border-[rgba(63,73,69,0.2)] bg-emerald-950/20 p-3 text-left text-sm text-on-surface transition hover:bg-emerald-900/25"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary-fixed-dim">swap_horiz</span>
                        Transferir conversa
                      </span>
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-on-surface-variant">
            <div className="max-w-sm text-center">
              <span className="material-symbols-outlined mb-3 text-4xl text-primary/40">forum</span>
              <p className="font-headline text-lg font-bold text-primary-fixed-dim">Selecione uma conversa</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Escolha uma conversa na lista para visualizar mensagens e responder.
              </p>
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
        channelId={selectedConversation?.channelId ?? undefined}
      />

      {/* Modal de Transferência: setor (fila) ou usuário específico do setor */}
      {showTransferModal && selectedConversation && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="w-[90%] max-w-lg rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 p-6 shadow-forest-glow backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-headline mb-2 text-lg font-bold text-on-surface">Transferir conversa</h2>
            <p className="mb-4 text-sm text-on-surface-variant">
              {transferSectorStep
                ? `Setor: ${transferSectorStep.name}. Envie para a fila do setor ou escolha um atendente.`
                : 'Escolha o setor. Depois você pode deixar na fila do setor ou atribuir a alguém do setor.'}
            </p>

            {transferSectorStep && (
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTransferSectorStep(null);
                    setTransferSectorUsers([]);
                  }}
                  className="rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-variant"
                >
                  ← Outro setor
                </button>
              </div>
            )}

            <div className="max-h-[min(52vh,360px)] overflow-y-auto rounded-md bg-surface-container-lowest/80 p-2.5">
              {!transferSectorStep ? (
                sectors.length === 0 ? (
                  <p className="py-5 text-center text-sm text-on-surface-variant">Carregando setores...</p>
                ) : (
                  sectors.map((sector: any) => (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={async () => {
                        setTransferSectorStep({
                          id: sector.id,
                          name: sector.name,
                          color: sector.color,
                        });
                        setLoadingTransferSectorUsers(true);
                        setTransferSectorUsers([]);
                        try {
                          const res = await api.get(`/api/sectors/${sector.id}/users`);
                          setTransferSectorUsers(res.data || []);
                        } catch (error: any) {
                          alert(error.response?.data?.error || 'Erro ao carregar usuários do setor');
                          setTransferSectorStep(null);
                        } finally {
                          setLoadingTransferSectorUsers(false);
                        }
                      }}
                      className="mb-2 flex w-full cursor-pointer items-center justify-between rounded-md border border-[rgba(63,73,69,0.2)] p-3 text-left transition-colors hover:bg-emerald-900/20"
                      style={{
                        backgroundColor: `${sector.color || '#10b981'}18`,
                      }}
                    >
                      <span className="text-sm font-semibold text-on-surface">{sector.name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold text-on-primary"
                        style={{ backgroundColor: sector.color || '#10b981' }}
                      >
                        Setor
                      </span>
                    </button>
                  ))
                )
              ) : loadingTransferSectorUsers ? (
                <p className="py-6 text-center text-sm text-on-surface-variant">Carregando atendentes...</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/api/conversations/${selectedConversation.id}/transfer-sector`, {
                          sectorId: transferSectorStep.id,
                          autoAssign: false,
                        });
                        alert(`Conversa na fila do setor ${transferSectorStep.name} (sem atendente fixo).`);
                        setShowTransferModal(false);
                        await fetchConversations(statusFilterRef.current);
                        const convResp = await api.get(`/api/conversations/${selectedConversation.id}`);
                        setSelectedConversation(convResp.data as any);
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'Erro ao transferir conversa');
                      }
                    }}
                    className="mb-3 w-full rounded-lg border-2 border-primary/40 bg-primary/10 p-3 text-left transition hover:bg-primary/15"
                  >
                    <div className="text-sm font-bold text-on-surface">Aguardando atendimento do setor</div>
                    <div className="mt-0.5 text-xs text-on-surface-variant">
                      Conversa fica no setor sem atribuir a ninguém (distribuição pode pegar depois).
                    </div>
                  </button>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                    Ou atendente específico
                  </p>
                  {transferSectorUsers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-on-surface-variant">
                      Nenhum usuário vinculado a este setor.
                    </p>
                  ) : (
                    transferSectorUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        disabled={!u.isActive}
                        onClick={async () => {
                          if (!u.isActive) return;
                          try {
                            await api.post(`/api/conversations/${selectedConversation.id}/transfer-sector`, {
                              sectorId: transferSectorStep.id,
                              userId: u.id,
                            });
                            alert(`Conversa transferida para ${u.name} (${transferSectorStep.name}).`);
                            setShowTransferModal(false);
                            await fetchConversations(statusFilterRef.current);
                            const convResp = await api.get(`/api/conversations/${selectedConversation.id}`);
                            setSelectedConversation(convResp.data as any);
                          } catch (error: any) {
                            alert(error.response?.data?.error || 'Erro ao transferir conversa');
                          }
                        }}
                        className={`mb-2 flex w-full items-center justify-between rounded-md border border-[rgba(63,73,69,0.2)] p-3 text-left transition-colors ${
                          u.isActive
                            ? 'cursor-pointer hover:bg-emerald-900/20'
                            : 'cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-on-surface">{u.name}</div>
                          <div className="text-xs text-on-surface-variant">{u.email}</div>
                          {u.isPaused ? (
                            <span className="mt-1 inline-block text-[10px] text-amber-600">Em pausa</span>
                          ) : null}
                        </div>
                        {!u.isActive ? (
                          <span className="text-[10px] font-bold text-on-surface-variant">Inativo</span>
                        ) : (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                            Atendente
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-highest px-5 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-variant"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Conversa */}
      {showNewConversationModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (!loadingNewConversation) {
              setShowNewConversationModal(false);
              setPhoneNumber('');
            }
          }}
        >
          <div
            className="w-[90%] max-w-md rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 p-8 shadow-forest-glow backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-headline mb-5 text-xl font-bold text-on-surface">
              Iniciar nova conversa
            </h3>

            <div className="mb-5 flex min-h-[52px] items-center justify-center rounded-lg bg-surface-container-lowest px-4 py-5 text-center font-mono text-2xl font-semibold tracking-widest text-on-surface">
              {phoneNumber || 'Digite o número...'}
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === '⌫') {
                      handleBackspace();
                    } else {
                      handleNumberKeyPress(key);
                    }
                  }}
                  disabled={loadingNewConversation}
                  className={`rounded-lg border-2 p-5 text-xl font-semibold transition ${
                    key === '⌫'
                      ? 'border-error-container bg-error-container text-on-error'
                      : key === '+'
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-[rgba(63,73,69,0.2)] bg-surface-container-low text-on-surface hover:bg-emerald-900/15'
                  } ${loadingNewConversation ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:scale-95'}`}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleClear}
                disabled={loadingNewConversation || !phoneNumber}
                className="flex-1 min-w-[5rem] rounded-lg bg-surface-container-highest px-3 py-3 text-sm font-medium text-on-surface ring-1 ring-[rgba(63,73,69,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={handleStartNewConversation}
                disabled={loadingNewConversation || !phoneNumber || phoneNumber.replace(/\D/g, '').length < 10}
                className="min-w-[8rem] flex-[2] rounded-lg px-3 py-3 text-sm font-bold text-on-primary active-gradient-emerald shadow-emerald-send disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {loadingNewConversation ? '⏳ Iniciando...' : '✅ Iniciar conversa'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewConversationModal(false);
                  setPhoneNumber('');
                }}
                disabled={loadingNewConversation}
                className="rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
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
