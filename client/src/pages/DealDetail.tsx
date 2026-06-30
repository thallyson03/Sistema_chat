import React, { useCallback, useEffect, useLayoutEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { createAuthenticatedSocket } from '../utils/socket';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { getPublicApiOrigin, getMessageMediaUrl, resolveMediaMetadataUrl, isDirectlyRenderableMediaUrl } from '../config/publicUrl';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import QuickRepliesModal from '../components/QuickRepliesModal';
import CustomFieldsManager from '../components/CustomFieldsManager';
import { useConfirm } from '../components/ui/ConfirmProvider';
import TaskNotificationCard, {
  TaskNotificationData,
} from '../components/chat/TaskNotificationCard';
import NoteNotificationCard, {
  NoteNotificationData,
} from '../components/chat/NoteNotificationCard';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

interface Deal {
  id: string;
  name: string;
  value?: number;
  currency: string;
  status: 'OPEN' | 'WON' | 'LOST' | 'ABANDONED';
  probability: number;
  customFields?: Record<string, any>;
  createdAt?: string;
  contact: {
    id: string;
    name: string;
    channelId?: string;
    phone?: string;
    email?: string;
    profilePicture?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  conversation?: {
    id: string;
    status: string;
    tags?: Array<{
      tagId: string;
      tag: {
        id: string;
        name: string;
        color?: string;
      };
    }>;
  };
  stage: {
    id: string;
    name: string;
    color: string;
    probability: number;
  };
  pipeline: {
    id: string;
    name: string;
    color: string;
    stages?: Array<{
      id: string;
      name: string;
      order: number;
      color: string;
      probability: number;
      isActive?: boolean;
    }>;
  };
  activities?: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    createdAt: string;
    user?: {
      name: string;
    };
  }>;
}

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
    order: number;
    color: string;
    probability: number;
    isActive?: boolean;
  }>;
}

interface DealStatistics {
  activeDays: number;
  source: {
    label: string;
    createdAt: string;
  };
  tasks: {
    completed: number;
    overdue: number;
  };
  notes: number;
  activeConversations: number;
}

/** Paleta alinhada ao design system (dashboard / pipelines) */
const dealNeon = {
  text: 'text-[#4ade80]',
  textMuted: 'text-[#86efac]',
  panel: 'bg-[#141816] border-[#252b28]',
  card: 'bg-[#1a1f1c] border-[#2a322c]',
};

interface Message {
  id: string;
  content: string;
  type: string;
  status: string;
  userId?: string | null;
  createdAt: string;
  metadata?: {
    mediaUrl?: string;
    fileName?: string;
    mimetype?: string;
    mediaMetadata?: any;
    fromBot?: boolean;
    source?: string;
    taskNotification?: TaskNotificationData;
    noteNotification?: NoteNotificationData;
  };
  user?: {
    id: string;
    name: string;
  };
}

export default function DealDetail() {
  const confirmModal = useConfirm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('principal');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const pendingScrollAfterMessagesRef = useRef<
    null | { type: 'stickBottom' } | { type: 'preserveBottomGap'; gapPx: number }
  >(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [openMediaMenuId, setOpenMediaMenuId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [newMessagesBelowCount, setNewMessagesBelowCount] = useState(0);
  const MESSAGES_PAGE_SIZE = 50;
  const messagesRef = useRef<Message[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [audioState, setAudioState] = useState<
    Record<string, { playing: boolean; currentTime: number; duration: number }>
  >({});
  const [taskNotification, setTaskNotification] = useState<Message | null>(null);
  
  // Estados para campos personalizados do pipeline
  const [pipelineCustomFields, setPipelineCustomFields] = useState<any[]>([]);
  
  // Estados para edição de campos comerciais fixos
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldEditValue, setFieldEditValue] = useState('');
  
  // Estados para usuários
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; isActive?: boolean }>>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [updatingAssignedUser, setUpdatingAssignedUser] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSectorStep, setTransferSectorStep] = useState<
    null | { id: string; name: string; color?: string }
  >(null);
  const [transferSectorUsers, setTransferSectorUsers] = useState<any[]>([]);
  const [loadingTransferUsers, setLoadingTransferUsers] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [pipelineOptions, setPipelineOptions] = useState<PipelineOption[]>([]);
  const [showPipelinePicker, setShowPipelinePicker] = useState(false);
  const [pickerPipelineId, setPickerPipelineId] = useState('');
  const [pickerStageId, setPickerStageId] = useState('');
  const [movingDeal, setMovingDeal] = useState(false);
  const pipelinePickerRef = useRef<HTMLDivElement>(null);
  const [dealStatistics, setDealStatistics] = useState<DealStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Campos comerciais fixos
  const fixedCommercialFields = [
    { key: 'empresa', label: 'Empresa', type: 'text' },
    { key: 'tel_comercial', label: 'Tel. comercial', type: 'tel' },
    { key: 'email_comercial', label: 'E-mail comercial', type: 'email' },
    { key: 'posicao', label: 'Posição', type: 'text' },
  ];

  useEffect(() => {
    if (id) {
      fetchDeal();
      fetchUsers();
      fetchSectors();
      fetchPipelineOptions();
    }
  }, [id]);

  useEffect(() => {
    if (!showPipelinePicker) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (pipelinePickerRef.current && !pipelinePickerRef.current.contains(event.target as Node)) {
        setShowPipelinePicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showPipelinePicker]);

  useEffect(() => {
    if (activeTab === 'estatisticas' && id) {
      fetchDealStatistics();
    }
  }, [activeTab, id]);

  useEffect(() => {
    if (!showTransferModal) {
      setTransferSectorStep(null);
      setTransferSectorUsers([]);
      setLoadingTransferUsers(false);
    }
  }, [showTransferModal]);

  // Buscar usuário atual (para controle de permissões, como exclusão de conversa)
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

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users?includeInactive=true');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
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
    if (shouldScrollToBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldScrollToBottom]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = conversation?.id || null;
  }, [conversation?.id]);

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
    if (deal?.conversation?.id) {
      fetchConversation(deal.conversation.id);
    } else if (deal) {
      createOrGetConversation();
    }
  }, [deal]);

  useEffect(() => {
    if (conversation?.id) {
      setNewMessagesBelowCount(0);
      fetchMessages(conversation.id, { reset: true });

      // Conectar ao Socket.IO
      const socket: Socket = createAuthenticatedSocket();

      socket.on('connect', () => {
        socket.emit('subscribe_conversation', conversation.id);
        if (conversation.channelId) {
          socket.emit('subscribe_channel', conversation.channelId);
        }
      });

      socket.on('new_message', async (data: { conversationId: string; messageId?: string }) => {
        if (data.conversationId !== conversation.id) return;
        try {
          if (data.messageId) {
            const msgRes = await api.get<Message>(`/api/messages/${data.messageId}`, {
              params: { conversationId: conversation.id },
            });
            const newMsg = msgRes.data;
            const isTaskNotificationMessage =
              newMsg?.metadata?.fromBot === true &&
              (newMsg?.metadata?.taskNotification?.taskId ||
                (typeof newMsg?.content === 'string' &&
                  (newMsg.content.startsWith('⏰ Chegou a hora de realizar uma tarefa deste negócio.') ||
                    newMsg.content.startsWith('🤖 Tarefa criada pelo bot deste negócio.'))));
            if (isTaskNotificationMessage) {
              setTaskNotification(newMsg);
            }
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
            await fetchMessages(conversation.id, { reset: true, silent: true });
            if (away) setNewMessagesBelowCount((n) => n + 1);
          }
        } catch {
          const elAway = messagesScrollRef.current;
          const away =
            elAway && elAway.scrollHeight - elAway.scrollTop - elAway.clientHeight >= 120;
          await fetchMessages(conversation.id, { reset: true, silent: true });
          if (away) setNewMessagesBelowCount((n) => n + 1);
        }
      });

      return () => {
        socket.emit('unsubscribe_conversation', conversation.id);
        if (conversation.channelId) {
          socket.emit('unsubscribe_channel', conversation.channelId);
        }
        socket.disconnect();
      };
    }
  }, [conversation]);

  const fetchPipelineOptions = async () => {
    try {
      const response = await api.get<PipelineOption[]>('/api/pipelines');
      setPipelineOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar pipelines:', error);
    }
  };

  const fetchDealStatistics = async () => {
    if (!id) return;
    try {
      setStatsLoading(true);
      const response = await api.get<DealStatistics>(`/api/pipelines/deals/${id}/statistics`);
      setDealStatistics(response.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setDealStatistics(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleMoveDeal = async () => {
    if (!deal || !pickerStageId) return;
    if (pickerPipelineId === deal.pipeline.id && pickerStageId === deal.stage.id) {
      setShowPipelinePicker(false);
      return;
    }

    try {
      setMovingDeal(true);
      const payload: { stageId: string; pipelineId?: string } = { stageId: pickerStageId };
      if (pickerPipelineId && pickerPipelineId !== deal.pipeline.id) {
        payload.pipelineId = pickerPipelineId;
      }
      const response = await api.put(`/api/pipelines/deals/${deal.id}/move`, payload);
      setDeal((prev) => (prev ? { ...prev, ...response.data } : response.data));
      setShowPipelinePicker(false);
      if (response.data?.pipeline?.id) {
        await fetchPipelineCustomFields(response.data.pipeline.id);
      }
    } catch (error: any) {
      alert(error?.response?.data?.error || error?.message || 'Erro ao mover negócio');
    } finally {
      setMovingDeal(false);
    }
  };

  const openPipelinePicker = () => {
    if (!deal) return;
    setPickerPipelineId(deal.pipeline.id);
    setPickerStageId(deal.stage.id);
    setShowPipelinePicker((prev) => !prev);
  };

  const pickerStages = pipelineOptions
    .find((p) => p.id === pickerPipelineId)
    ?.stages?.filter((s) => s.isActive !== false)
    .sort((a, b) => a.order - b.order) || [];

  const fetchDeal = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/pipelines/deals/${id}`);
      setDeal(response.data);
      
      // Buscar campos personalizados do pipeline
      if (response.data?.pipeline?.id) {
        await fetchPipelineCustomFields(response.data.pipeline.id);
      }
    } catch (error: any) {
      console.error('Erro ao carregar deal:', error);
      alert('Erro ao carregar negócio');
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineCustomFields = async (pipelineId: string) => {
    try {
      const response = await api.get(`/api/pipelines/${pipelineId}/custom-fields`);
      setPipelineCustomFields(response.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar campos personalizados:', error);
    }
  };

  const handleUpdateCommercialField = async (fieldKey: string, value: string) => {
    if (!deal) return;
    
    try {
      // Se for um campo customizado, usar o ID diretamente
      // Se for um campo comercial fixo, usar a chave diretamente
      const keyToUpdate = fieldKey.startsWith('custom_') 
        ? fieldKey.replace('custom_', '') 
        : fieldKey;
      
      const updatedCustomFields = {
        ...(deal.customFields || {}),
        [keyToUpdate]: value || null,
      };
      
      await api.put(`/api/pipelines/deals/${deal.id}`, {
        customFields: updatedCustomFields,
      });
      
      // Atualizar deal local
      setDeal({
        ...deal,
        customFields: updatedCustomFields,
      });
      
      setEditingField(null);
      setFieldEditValue('');
    } catch (error: any) {
      console.error('Erro ao atualizar campo comercial:', error);
      alert('Erro ao atualizar campo');
    }
  };

  const handleStartEdit = (fieldKey: string) => {
    // Se for um campo customizado, extrair o ID do campo
    if (fieldKey.startsWith('custom_')) {
      const customFieldId = fieldKey.replace('custom_', '');
      const currentValue = deal?.customFields?.[customFieldId] || '';
      setFieldEditValue(String(currentValue));
      setEditingField(fieldKey);
    } else {
      // Campo comercial fixo
      const currentValue = deal?.customFields?.[fieldKey] || '';
      setFieldEditValue(String(currentValue));
      setEditingField(fieldKey);
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setFieldEditValue('');
  };

  const handleStartConversationFromPhone = async (phone: string) => {
    if (!phone || !deal) {
      console.log('❌ [handleStartConversationFromPhone] Parâmetros inválidos:', { phone, deal: !!deal });
      return;
    }
    
    console.log('🚀 [handleStartConversationFromPhone] Iniciando processo para telefone:', phone);
    
    try {
      // Limpar o telefone (remover caracteres não numéricos, exceto +)
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      
      console.log('📞 [handleStartConversationFromPhone] Telefone limpo:', cleanPhone);
      
      if (!cleanPhone) {
        alert('Número de telefone inválido');
        return;
      }

      // Se for o telefone do contato principal do deal, usar a conversa existente ou criar
      if (deal.contact.phone && deal.contact.phone.replace(/[^\d+]/g, '') === cleanPhone) {
        // Usar o contato do deal - abrir no chat do pipeline
        if (deal.conversation?.id) {
          // Se já tem conversa, abrir no chat do pipeline
          await fetchConversation(deal.conversation.id);
        } else {
          // Criar conversa para o contato do deal
          await createOrGetConversation();
        }
        return;
      }

      // Para outros telefones (ex: tel_comercial), buscar ou criar contato, conversa e deal
      // Primeiro, buscar o contato do deal para pegar o channelId
      const contactResponse = await api.get(`/api/contacts/${deal.contact.id}`);
      const dealContact = contactResponse.data;
      const channelId =
        dealContact.channelIdentities?.[0]?.channelId ||
        (deal.conversation as { channelId?: string } | undefined)?.channelId ||
        null;

      if (!channelId) {
        alert('Nenhum canal disponível para este contato. Vincule um canal antes de iniciar conversa.');
        return;
      }

      // Buscar todas as conversas para encontrar uma existente com este telefone
      const allConversationsResponse = await api.get('/api/conversations');
      const allConversations = allConversationsResponse.data?.conversations || allConversationsResponse.data || [];
      
      // Tentar encontrar conversa existente pelo telefone
      const existingConversation = allConversations.find((conv: any) => 
        conv.contact?.phone && conv.contact.phone.replace(/[^\d+]/g, '') === cleanPhone
      );

      let targetContact = null;
      let targetConversation = null;
      let targetDeal = null;

      if (existingConversation) {
        targetContact = existingConversation.contact;
        targetConversation = existingConversation;
        
        // Buscar se existe deal para este contato
        const dealsResponse = await api.get(`/api/pipelines/deals?contactId=${targetContact.id}`);
        const deals = Array.isArray(dealsResponse.data) 
          ? dealsResponse.data 
          : (dealsResponse.data?.deals || []);
        
        if (deals.length > 0) {
          // Encontrou deal existente, navegar para ele
          targetDeal = deals[0];
          navigate(`/pipelines/deals/${targetDeal.id}`);
          return;
        }
        
        // Se encontrou conversa mas não tem deal, criar novo deal automaticamente
        // Continuar o fluxo abaixo para criar o deal
      }

      // Criar contato, conversa e deal se não existirem
      // Criar ou buscar contato
      if (!targetContact) {
        try {
          const newContactResponse = await api.post('/api/contacts', {
            name: `Contato ${cleanPhone}`,
            phone: cleanPhone,
            channelId: channelId,
          });
          targetContact = newContactResponse.data;
        } catch (contactError: any) {
          // Se erro ao criar contato, pode ser que já exista, tentar buscar
          console.error('Erro ao criar contato, tentando buscar:', contactError);
          // Continuar mesmo com erro, vamos tentar criar conversa
        }
      }

      // Criar ou buscar conversa
      if (!targetConversation) {
        console.log('💬 [handleStartConversationFromPhone] Criando nova conversa...');
        try {
          if (!targetContact) {
            // Se não conseguiu criar contato, não pode criar conversa
            throw new Error('Não foi possível criar contato');
          }
          const newConversationResponse = await api.post('/api/conversations', {
            channelId: channelId,
            contactId: targetContact.id,
          });
          targetConversation = newConversationResponse.data;
          console.log('✅ [handleStartConversationFromPhone] Conversa criada:', targetConversation.id);
        } catch (convError: any) {
          console.error('❌ [handleStartConversationFromPhone] Erro ao criar conversa:', {
            error: convError.message,
            response: convError.response?.data,
            status: convError.response?.status,
          });
          // Se erro, pode ser que já exista, buscar novamente
          console.log('🔍 [handleStartConversationFromPhone] Buscando conversa existente...');
          const allConversationsResponse = await api.get('/api/conversations');
          const allConversations = allConversationsResponse.data?.conversations || allConversationsResponse.data || [];
          targetConversation = allConversations.find((conv: any) => 
            conv.contact?.phone && conv.contact.phone.replace(/[^\d+]/g, '') === cleanPhone
          );
          
          if (!targetConversation && targetContact) {
            // Se ainda não encontrou, tentar buscar conversas do contato
            const contactConversationsResponse = await api.get(`/api/conversations?contactId=${targetContact.id}`);
            const contactConversations = contactConversationsResponse.data?.conversations || contactConversationsResponse.data || [];
            targetConversation = contactConversations[0] || null;
          }
          
          if (targetConversation) {
            console.log('✅ [handleStartConversationFromPhone] Conversa encontrada:', targetConversation.id);
          }
        }
      } else {
        console.log('✅ [handleStartConversationFromPhone] Conversa já existe:', targetConversation.id);
      }

      // Se não conseguiu criar/buscar contato ou conversa, mostrar erro
      if (!targetContact || !targetConversation) {
        console.error('❌ [handleStartConversationFromPhone] Falha crítica:', {
          hasContact: !!targetContact,
          hasConversation: !!targetConversation,
        });
        alert('Não foi possível criar ou encontrar contato e conversa. Tente novamente.');
        return;
      }
      
      console.log('✅ [handleStartConversationFromPhone] Contato e conversa prontos:', {
        contactId: targetContact.id,
        conversationId: targetConversation.id,
      });

      // Verificar se já existe deal para este contato NO MESMO PIPELINE (verificação final antes de criar)
      console.log('🔍 [handleStartConversationFromPhone] Verificando deals existentes para contato no pipeline atual:', {
        contactId: targetContact.id,
        pipelineId: deal.pipeline.id,
      });
      try {
        // Buscar deals do contato E do pipeline atual
        const existingDealsResponse = await api.get(`/api/pipelines/deals?contactId=${targetContact.id}&pipelineId=${deal.pipeline.id}`);
        const existingDeals = Array.isArray(existingDealsResponse.data) 
          ? existingDealsResponse.data 
          : (existingDealsResponse.data?.deals || []);
        
        console.log('📊 [handleStartConversationFromPhone] Deals existentes encontrados no pipeline atual:', existingDeals.length);
        
        if (existingDeals.length > 0) {
          // Já existe deal para este contato no mesmo pipeline, navegar para ele
          targetDeal = existingDeals[0];
          console.log('✅ [handleStartConversationFromPhone] Deal existente encontrado no pipeline atual, navegando para:', targetDeal.id);
          navigate(`/pipelines/deals/${targetDeal.id}`);
          return;
        }
        
        console.log('ℹ️ [handleStartConversationFromPhone] Nenhum deal existente encontrado no pipeline atual, criando novo...');
      } catch (dealCheckError: any) {
        console.error('❌ [handleStartConversationFromPhone] Erro ao verificar deals existentes:', {
          error: dealCheckError.message,
          response: dealCheckError.response?.data,
          status: dealCheckError.response?.status,
        });
        // Continuar para criar novo deal mesmo com erro
        console.log('⚠️ [handleStartConversationFromPhone] Continuando para criar novo deal apesar do erro...');
      }

      // Buscar pipeline atual e primeira stage
      const pipelineResponse = await api.get(`/api/pipelines/${deal.pipeline.id}`);
      const currentPipeline = pipelineResponse.data;
      
      // Encontrar primeira stage ativa (menor order)
      const activeStages = currentPipeline.stages?.filter((s: any) => s.isActive) || [];
      const firstStage = activeStages.length > 0
        ? activeStages.reduce((min: any, stage: any) => 
            stage.order < min.order ? stage : min
          )
        : currentPipeline.stages?.[0];

      if (!firstStage) {
        alert('Pipeline não possui stages configuradas');
        return;
      }

      // Verificar se já existe deal para esta conversa (evitar duplicata)
      let dealForConversation = null;
      if (targetConversation.id) {
        try {
          const dealsForConvResponse = await api.get(`/api/pipelines/deals`);
          const allDeals = Array.isArray(dealsForConvResponse.data) 
            ? dealsForConvResponse.data 
            : (dealsForConvResponse.data?.deals || []);
          dealForConversation = allDeals.find((d: any) => d.conversationId === targetConversation.id);
        } catch (e) {
          // Ignorar erro
        }
      }

      // Criar novo deal no mesmo pipeline
      console.log('📝 [handleStartConversationFromPhone] Criando novo deal:', {
        pipelineId: deal.pipeline.id,
        stageId: firstStage.id,
        contactId: targetContact.id,
        conversationId: dealForConversation ? undefined : targetConversation.id,
        name: targetContact.name || `Negócio ${cleanPhone}`,
      });

      try {
        const newDealResponse = await api.post('/api/pipelines/deals', {
          pipelineId: deal.pipeline.id,
          stageId: firstStage.id,
          contactId: targetContact.id,
          conversationId: dealForConversation ? undefined : targetConversation.id,
          name: targetContact.name || `Negócio ${cleanPhone}`,
        });
        targetDeal = newDealResponse.data;

        console.log('✅ [handleStartConversationFromPhone] Deal criado com sucesso:', targetDeal.id);

        // Navegar para o novo deal
        navigate(`/pipelines/deals/${targetDeal.id}`);
      } catch (dealError: any) {
        console.error('❌ [handleStartConversationFromPhone] Erro ao criar deal:', {
          error: dealError.message,
          response: dealError.response?.data,
          status: dealError.response?.status,
        });
        
        // Se erro ao criar deal, pode ser que já exista para a conversa
        if (dealError.response?.data?.error?.includes('já existe')) {
          console.log('⚠️ [handleStartConversationFromPhone] Deal já existe, buscando...');
          // Tentar buscar o deal existente
          try {
            const dealsResponse = await api.get(`/api/pipelines/deals?contactId=${targetContact.id}`);
            const deals = Array.isArray(dealsResponse.data) 
              ? dealsResponse.data 
              : (dealsResponse.data?.deals || []);
            console.log('🔍 [handleStartConversationFromPhone] Deals encontrados:', deals.length);
            if (deals.length > 0) {
              console.log('✅ [handleStartConversationFromPhone] Navegando para deal existente:', deals[0].id);
              navigate(`/pipelines/deals/${deals[0].id}`);
              return;
            }
          } catch (e) {
            console.error('❌ [handleStartConversationFromPhone] Erro ao buscar deals:', e);
          }
        }
        alert(dealError.response?.data?.error || 'Erro ao criar novo card. Tente novamente.');
      }
    } catch (error: any) {
      console.error('Erro ao iniciar conversa:', error);
      alert(error.response?.data?.error || 'Erro ao iniciar conversa');
    }
  };

  const handleUpdateAssignedUser = async (userId: string | null) => {
    if (!deal) return;
    
    try {
      setUpdatingAssignedUser(true);
      await api.put(`/api/pipelines/deals/${deal.id}`, {
        assignedToId: userId || null,
      });
      
      // Atualizar deal local
      const updatedAssignedTo = userId 
        ? users.find(u => u.id === userId) || null
        : null;
      
      setDeal({
        ...deal,
        assignedTo: updatedAssignedTo ? {
          id: updatedAssignedTo.id,
          name: updatedAssignedTo.name,
          email: updatedAssignedTo.email,
        } : undefined,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar usuário responsável:', error);
      alert('Erro ao atualizar usuário responsável');
    } finally {
      setUpdatingAssignedUser(false);
    }
  };

  const handleAddTagToDeal = async () => {
    if (!deal || !newTagName.trim() || savingTag) return;
    try {
      setSavingTag(true);
      const response = await api.post(`/api/pipelines/deals/${deal.id}/tags`, {
        name: newTagName.trim(),
      });
      setDeal(response.data);
      setNewTagName('');
    } catch (error: any) {
      console.error('Erro ao adicionar tag no lead:', error);
      alert(error.response?.data?.error || 'Erro ao adicionar tag');
    } finally {
      setSavingTag(false);
    }
  };

  const handleRemoveTagFromDeal = async (tagId: string) => {
    if (!deal || savingTag) return;
    try {
      setSavingTag(true);
      const response = await api.delete(`/api/pipelines/deals/${deal.id}/tags/${tagId}`);
      setDeal(response.data);
    } catch (error: any) {
      console.error('Erro ao remover tag do lead:', error);
      alert(error.response?.data?.error || 'Erro ao remover tag');
    } finally {
      setSavingTag(false);
    }
  };

  const createOrGetConversation = async () => {
    if (!deal) return;

    try {
      const response = await api.get(`/api/conversations?contactId=${deal.contact.id}`);
      const conversations = response.data.conversations || response.data || [];

      if (conversations.length > 0) {
        const existingConv = conversations[0];
        setConversation(existingConv);
        await api.put(`/api/pipelines/deals/${deal.id}`, {
          conversationId: existingConv.id,
        });
      } else {
        const contactResponse = await api.get(`/api/contacts/${deal.contact.id}`);
        const contact = contactResponse.data;
        const channelId =
          contact.channelIdentities?.[0]?.channelId ||
          (deal.conversation as { channelId?: string } | undefined)?.channelId;

        if (!channelId) {
          console.error('Contato sem canal vinculado para abrir conversa');
          return;
        }

        const newConvResponse = await api.post('/api/conversations', {
          channelId,
          contactId: deal.contact.id,
        });

        setConversation(newConvResponse.data);
        await api.put(`/api/pipelines/deals/${deal.id}`, {
          conversationId: newConvResponse.data.id,
        });
      }
    } catch (error: any) {
      console.error('Erro ao criar/buscar conversa:', error);
    }
  };

  const fetchConversation = async (conversationId: string) => {
    try {
      const response = await api.get(`/api/conversations/${conversationId}`);
      setConversation(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar conversa:', error);
    }
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

      if (activeConversationIdRef.current !== conversationId) {
        return;
      }

      const messagesData = response.data || [];
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
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      if (reset && !silent) {
        setLoadingMessages(false);
      } else if (!reset) {
        setLoadingMoreMessages(false);
      }
    }
  };

  const handleSendMessage = async (
    e: React.FormEvent,
    mediaUrl?: string,
    messageType?: string,
    fileName?: string,
    caption?: string,
    mimetype?: string
  ) => {
    e.preventDefault();
    if ((!messageInput.trim() && !mediaUrl) || sending || !conversation) return;

    setSending(true);
    try {
      await api.post('/api/messages', {
        conversationId: conversation.id,
        content: messageInput.trim() || caption || '',
        type: messageType || 'TEXT',
        mediaUrl,
        fileName,
        caption: messageInput.trim() || caption,
        mimetype, // Passar mimetype para o backend usar no envio (especialmente para áudio base64)
      });

      setMessageInput('');
      setShowEmojiPicker(false);
      await fetchMessages(conversation.id, { reset: true });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      alert(error.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleQuickReplySelect = (quickReply: any) => {
    if (!conversation) return;

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
      setMessageInput(quickReply.previewContent || quickReply.content);
      setShowQuickReplies(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;

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

      let messageType = 'DOCUMENT';
      if (mimetype.startsWith('image/')) {
        messageType = 'IMAGE';
      } else if (mimetype.startsWith('video/')) {
        messageType = 'VIDEO';
      } else if (mimetype.startsWith('audio/')) {
        messageType = 'AUDIO';
      }

      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      await handleSendMessage(fakeEvent, url, messageType, file.name, messageInput.trim() || file.name, mimetype);
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do arquivo. Tente novamente.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadMedia = async (message: Message) => {
    try {
      const endpoint =
        message.type === 'AUDIO'
          ? `/api/media/download/${message.id}`
          : `/api/media/${message.id}`;
      const response = await api.get(endpoint, {
        responseType: 'blob',
      });

      const rawContentType = response.headers['content-type'];
      const contentType =
        typeof rawContentType === 'string'
          ? rawContentType
          : Array.isArray(rawContentType)
            ? rawContentType[0]
            : undefined;
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;

      let filename =
        message.metadata?.fileName ||
        message.content ||
        (message.type === 'AUDIO' ? 'audio' : 'arquivo');

      if (message.type === 'AUDIO') {
        filename = filename.replace(/\.[^/.]+$/, '');
        filename += '.mp3';
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao iniciar download da mídia:', error);
      alert('Não foi possível baixar este arquivo. Tente novamente.');
    }
  };

  const voiceRecorder = useVoiceRecorder({
    onSend: async (audioFile, { extension, mimeType }) => {
      if (!conversation) {
        throw new Error('Nenhuma conversa ativa');
      }
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', audioFile);
        const uploadResponse = await api.post('/api/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const { url, mimetype } = uploadResponse.data;
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        await handleSendMessage(
          fakeEvent,
          url,
          'AUDIO',
          `audio.${extension}`,
          'Áudio',
          mimetype || mimeType,
        );
      } finally {
        setUploadingFile(false);
      }
    },
  });

  useEffect(() => {
    voiceRecorder.cancelAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset ao trocar conversa
  }, [conversation?.id]);

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Hoje ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Ontem ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getAvatarUrl = (name: string, size = 40) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Contato')}&background=1f2937&color=ffffff&size=${size}`;

  const getContactAvatar = (contact: { name: string; profilePicture?: string }, size = 40) => {
    if (contact?.profilePicture && contact.profilePicture.trim() !== '') {
      return contact.profilePicture;
    }
    return getAvatarUrl(contact?.name || 'Contato', size);
  };

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
      if (!taskId) return;
      if (taskId.startsWith('legacy-')) {
        const legacyMessage = messages.find((m) => `legacy-${m.id}` === taskId);
        const title =
          legacyMessage?.metadata?.taskNotification?.title ||
          legacyMessage?.content.match(/• Tarefa:\s*(.+)/)?.[1]?.trim();
        if (!deal?.id || !title) {
          throw new Error('Não foi possível identificar a tarefa antiga.');
        }
        const response = await api.put(`/api/pipelines/deals/${deal.id}/tasks/by-title`, { title, result });
        const resolvedTask = response.data;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === legacyMessage?.id
              ? {
                  ...msg,
                  metadata: {
                    ...msg.metadata,
                    taskNotification: {
                      taskId: resolvedTask.id,
                      dealId: deal.id,
                      title: resolvedTask.title,
                      description: result,
                      dueDate: resolvedTask.dueDate,
                      status: resolvedTask.status,
                    },
                  },
                }
              : msg,
          ),
        );
        return;
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
      if (!taskId) return;
      if (taskId.startsWith('legacy-')) {
        const legacyMessage = messages.find((m) => `legacy-${m.id}` === taskId);
        const title =
          legacyMessage?.metadata?.taskNotification?.title ||
          legacyMessage?.content.match(/• Tarefa:\s*(.+)/)?.[1]?.trim();
        if (!deal?.id || !title) {
          throw new Error('Não foi possível identificar a tarefa antiga.');
        }
        const response = await api.put(`/api/pipelines/deals/${deal.id}/tasks/by-title`, {
          title,
          status: 'DONE',
        });
        const resolvedTask = response.data;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === legacyMessage?.id
              ? {
                  ...msg,
                  metadata: {
                    ...msg.metadata,
                    taskNotification: {
                      taskId: resolvedTask.id,
                      dealId: deal.id,
                      title: resolvedTask.title,
                      description: resolvedTask.description || '',
                      dueDate: resolvedTask.dueDate,
                      status: 'DONE',
                    },
                  },
                }
              : msg,
          ),
        );
        return;
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

  if (loading) {
    return <div className="p-5 text-on-surface-variant">Carregando...</div>;
  }

  if (!deal) {
    return <div className="p-5 text-on-surface-variant">Negócio não encontrado</div>;
  }

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden bg-surface font-body text-on-surface">
      {/* Sidebar Esquerda - Informações do Lead */}
      <div
        style={{
          width: '400px',
          backgroundColor: '#1a1c1a',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          borderRight: '1px solid rgba(63, 73, 69, 0.35)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <button
              onClick={() => navigate('/pipelines')}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                marginRight: '10px',
              }}
            >
              ←
            </button>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{deal.contact.name}</h2>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '18px',
                marginLeft: 'auto',
              }}
            >
              ⋮
            </button>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>#{deal.id.slice(-8)}</span>
          </div>

          <div ref={pipelinePickerRef} style={{ position: 'relative', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={openPipelinePicker}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '10px',
                      opacity: 0.65,
                      marginBottom: '1px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {deal.pipeline.name}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {deal.stage.name}
                  </div>
                </div>
                <span style={{ fontSize: '10px', opacity: 0.7, flexShrink: 0 }}>▼</span>
              </div>
            </button>

            {showPipelinePicker && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '6px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: '#242824',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
                  zIndex: 30,
                }}
              >
                <label style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                  Pipeline
                </label>
                <select
                  value={pickerPipelineId}
                  onChange={(e) => {
                    const nextPipelineId = e.target.value;
                    setPickerPipelineId(nextPipelineId);
                    const nextPipeline = pipelineOptions.find((p) => p.id === nextPipelineId);
                    const firstStage = (nextPipeline?.stages || [])
                      .filter((s) => s.isActive !== false)
                      .sort((a, b) => a.order - b.order)[0];
                    setPickerStageId(firstStage?.id || '');
                  }}
                  style={{
                    width: '100%',
                    marginBottom: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontSize: '13px',
                  }}
                >
                  {pipelineOptions.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id} style={{ color: '#111' }}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>

                <label style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                  Etapa (coluna)
                </label>
                <select
                  value={pickerStageId}
                  onChange={(e) => setPickerStageId(e.target.value)}
                  style={{
                    width: '100%',
                    marginBottom: '12px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontSize: '13px',
                  }}
                >
                  {pickerStages.map((stage) => (
                    <option key={stage.id} value={stage.id} style={{ color: '#111' }}>
                      {stage.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleMoveDeal}
                  disabled={movingDeal || !pickerStageId}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#22c55e',
                    color: '#052e16',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: movingDeal || !pickerStageId ? 'not-allowed' : 'pointer',
                    opacity: movingDeal || !pickerStageId ? 0.6 : 1,
                  }}
                >
                  {movingDeal ? 'Movendo...' : 'Mover negócio'}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                fontSize: '11px',
              }}
            >
              {deal.probability}% probabilidade
            </span>
          </div>

          {deal.assignedTo && (
            <div style={{ marginBottom: '8px', fontSize: '13px' }}>
              <strong>Responsável:</strong> {deal.assignedTo.name}
            </div>
          )}
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0 20px' }}>
          {['principal', 'estatisticas', 'configuracao'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.7)',
                borderBottom: activeTab === tab ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontSize: '13px',
                fontWeight: activeTab === tab ? '600' : '400',
              }}
            >
              {tab === 'principal' ? 'Principal' : tab === 'estatisticas' ? 'Estatísticas' : 'Configuração'}
            </button>
          ))}
        </div>

        {/* Conteúdo das Abas */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
          {activeTab === 'principal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                  Usuário responsável
                </label>
                <select
                  value={deal.assignedTo?.id || ''}
                  onChange={(e) => handleUpdateAssignedUser(e.target.value || null)}
                  disabled={updatingAssignedUser}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '14px',
                    cursor: updatingAssignedUser ? 'not-allowed' : 'pointer',
                    opacity: updatingAssignedUser ? 0.6 : 1,
                  }}
                >
                  <option value="" style={{ color: '#000' }}>Não atribuído</option>
                  {users
                    .filter(user => user.isActive !== false)
                    .map((user) => (
                      <option key={user.id} value={user.id} style={{ color: '#000' }}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '6px' }}>
                  Tags do lead
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {(deal.conversation?.tags || []).map((item) => (
                    <span
                      key={item.tag.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '999px',
                        backgroundColor: item.tag.color || 'rgba(255,255,255,0.2)',
                        color: 'white',
                        fontSize: '12px',
                      }}
                    >
                      {item.tag.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveTagFromDeal(item.tag.id)}
                        disabled={savingTag}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'white',
                          cursor: savingTag ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          opacity: 0.9,
                          padding: 0,
                          lineHeight: 1,
                        }}
                        title="Remover tag"
                      >
                        x
                      </button>
                    </span>
                  ))}
                  {(deal.conversation?.tags || []).length === 0 && (
                    <span style={{ fontSize: '12px', opacity: 0.65, fontStyle: 'italic' }}>
                      Sem tags
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTagToDeal();
                      }
                    }}
                    placeholder="Criar tag manual"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      fontSize: '13px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTagToDeal}
                    disabled={savingTag || !newTagName.trim()}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: savingTag || !newTagName.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      opacity: savingTag || !newTagName.trim() ? 0.6 : 1,
                    }}
                  >
                    + Tag
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                  Venda
                </label>
                <div style={{ fontSize: '14px' }}>
                  {deal.value ? formatCurrency(deal.value, deal.currency) : 'R$0'}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                  Telefone
                </label>
                {deal.contact.phone ? (
                  <div 
                    onClick={() => handleStartConversationFromPhone(deal.contact.phone!)}
                    style={{ 
                      fontSize: '14px',
                      color: '#3b82f6',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      display: 'inline-block',
                    }}
                    title="Clique para iniciar conversa"
                  >
                    {deal.contact.phone}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px' }}>N/A</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                  E-mail
                </label>
                <div style={{ fontSize: '14px' }}>{deal.contact.email || 'N/A'}</div>
              </div>

              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                  Etapa
                </label>
                <div style={{ fontSize: '14px' }}>{deal.stage.name}</div>
              </div>

              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                  Pipeline
                </label>
                <div style={{ fontSize: '14px' }}>{deal.pipeline.name}</div>
              </div>

              {/* Campos personalizados do pipeline */}
              {pipelineCustomFields.map((field) => {
                // Buscar o valor do campo nos customFields do deal
                // O valor pode estar armazenado pelo ID do campo ou pelo nome
                const fieldValue = deal.customFields?.[field.id] || deal.customFields?.[field.name] || null;
                const isEditing = editingField === `custom_${field.id}`;
                
                return (
                  <div key={field.id}>
                    <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                      {field.name}
                      {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                    </label>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type={field.type === 'NUMBER' ? 'number' : field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : field.type === 'DATE' ? 'date' : 'text'}
                          value={fieldEditValue}
                          onChange={(e) => setFieldEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateCommercialField(field.id, fieldEditValue);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            fontSize: '14px',
                          }}
                        />
                        <button
                          onClick={() => handleUpdateCommercialField(field.id, fieldEditValue)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '14px', flex: 1 }}>
                          {fieldValue !== null && fieldValue !== undefined && fieldValue !== '' 
                            ? String(fieldValue) 
                            : <span style={{ opacity: 0.6, fontStyle: 'italic' }}>...</span>}
                        </div>
                        <button
                          onClick={() => handleStartEdit(`custom_${field.id}`)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.3)',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: 0,
                          }}
                          title="Adicionar ou editar"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Separador visual para campos comerciais */}
              {fixedCommercialFields.length > 0 && (
                <div style={{ marginTop: '24px', marginBottom: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '600', opacity: 0.9, marginBottom: '12px', color: 'white' }}>
                    Informações Comerciais
                  </h4>
                </div>
              )}

              {/* Campos comerciais fixos */}
              {fixedCommercialFields.map((field) => {
                const fieldValue = deal.customFields?.[field.key] || null;
                const isEditing = editingField === field.key;
                
                return (
                  <div key={field.key}>
                    <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>
                      {field.label}
                    </label>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type={field.type}
                          value={fieldEditValue}
                          onChange={(e) => setFieldEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateCommercialField(field.key, fieldEditValue);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            fontSize: '14px',
                          }}
                        />
                        <button
                          onClick={() => handleUpdateCommercialField(field.key, fieldEditValue)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '14px', flex: 1 }}>
                          {fieldValue ? (
                            field.type === 'tel' ? (
                              <div 
                                onClick={() => handleStartConversationFromPhone(fieldValue)}
                                style={{ 
                                  color: '#3b82f6', 
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  display: 'inline-block',
                                }}
                                title="Clique para iniciar conversa"
                              >
                                {fieldValue}
                              </div>
                            ) : field.type === 'email' ? (
                              <a 
                                href={`mailto:${fieldValue}`}
                                style={{ color: 'white', textDecoration: 'underline' }}
                              >
                                {fieldValue}
                              </a>
                            ) : (
                              fieldValue
                            )
                          ) : (
                            <span style={{ opacity: 0.6, fontStyle: 'italic' }}>...</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleStartEdit(field.key)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.3)',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: 0,
                          }}
                          title="Adicionar ou editar"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'estatisticas' && (
            <div className="flex flex-col gap-4">
              {statsLoading ? (
                <div className={`animate-pulse rounded-xl border p-6 ${dealNeon.card}`}>
                  <div className="mx-auto h-16 w-24 rounded-lg bg-[#252b28]" />
                  <div className="mt-4 space-y-3">
                    <div className="h-10 rounded-lg bg-[#252b28]" />
                    <div className="h-10 rounded-lg bg-[#252b28]" />
                    <div className="h-10 rounded-lg bg-[#252b28]" />
                  </div>
                </div>
              ) : dealStatistics ? (
                <>
                  <div className={`rounded-xl border px-4 py-3 text-xs text-[#9ca3a0] ${dealNeon.card}`}>
                    <span className="font-semibold uppercase tracking-wide text-[#8b9490]">Fonte</span>
                    <p className="mt-1 text-[#e8ece9]">
                      {dealStatistics.source.label}
                      <span className="text-[#6b7280]">
                        {' '}
                        / {new Date(dealStatistics.source.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </p>
                  </div>

                  <div
                    className={`rounded-xl border px-4 py-6 text-center ${dealNeon.card}`}
                    style={{ background: 'linear-gradient(180deg, #1e2420 0%, #161916 100%)' }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9490]">
                      Dias ativos
                    </p>
                    <p className={`mt-2 font-headline text-5xl font-bold tabular-nums ${dealNeon.text}`}>
                      {dealStatistics.activeDays}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {[
                      {
                        label: 'Tarefas finalizadas / vencidas',
                        value: (
                          <span className="tabular-nums">
                            <span className={dealNeon.textMuted}>{dealStatistics.tasks.completed}</span>
                            <span className="text-[#6b7280]">/</span>
                            <span
                              className={
                                dealStatistics.tasks.overdue > 0 ? 'text-red-400' : 'text-[#e8ece9]'
                              }
                            >
                              {dealStatistics.tasks.overdue}
                            </span>
                          </span>
                        ),
                      },
                      {
                        label: 'Notas',
                        value: (
                          <span className="font-semibold tabular-nums text-white">
                            {dealStatistics.notes}
                          </span>
                        ),
                      },
                      {
                        label: 'Bate-papo com o cliente',
                        value: (
                          <span className={`font-semibold tabular-nums ${dealNeon.text}`}>
                            {dealStatistics.activeConversations}
                          </span>
                        ),
                        hint: 'Conversas abertas ou em fila (canais/números distintos)',
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${dealNeon.card}`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#b8c4be]">{row.label}</p>
                          {'hint' in row && row.hint ? (
                            <p className="mt-0.5 text-[10px] text-[#6b7280]">{row.hint}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-sm">{row.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={`rounded-xl border px-4 py-8 text-center text-sm text-[#6b7280] ${dealNeon.card}`}>
                  Não foi possível carregar as estatísticas.
                </div>
              )}
            </div>
          )}

          {activeTab === 'configuracao' && deal?.pipeline?.id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Campos comerciais fixos */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                  Campos Fixos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {fixedCommercialFields.map((field) => {
                    const fieldValue = deal.customFields?.[field.key] || null;
                    const isEditing = editingField === field.key;
                    
                    return (
                      <div key={field.key}>
                        <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '4px', color: 'white' }}>
                          {field.label}
                        </label>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type={field.type}
                              value={fieldEditValue}
                              onChange={(e) => setFieldEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateCommercialField(field.key, fieldEditValue);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              autoFocus
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                color: 'white',
                                fontSize: '14px',
                              }}
                            />
                            <button
                              onClick={() => handleUpdateCommercialField(field.key, fieldEditValue)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Salvar
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '14px', color: 'white', flex: 1 }}>
                              {fieldValue ? (
                                field.type === 'tel' || field.type === 'email' ? (
                                  <a 
                                    href={field.type === 'tel' ? `tel:${fieldValue}` : `mailto:${fieldValue}`}
                                    style={{ color: 'white', textDecoration: 'underline' }}
                                  >
                                    {fieldValue}
                                  </a>
                                ) : (
                                  fieldValue
                                )
                              ) : (
                                <span style={{ opacity: 0.6, fontStyle: 'italic' }}>Não preenchido</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleStartEdit(field.key)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>+</span>
                              <span>Editar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Campos personalizados do pipeline */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                  Campos Personalizados
                </h3>
                <CustomFieldsManager pipelineId={deal.pipeline.id} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Área Direita - Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0e100e' }}>
        {/* Header do Chat */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#1a1c1a',
            borderBottom: '1px solid rgba(63, 73, 69, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {deal.contact.profilePicture ? (
              <img
                src={deal.contact.profilePicture}
                alt={deal.contact.name}
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#064e3b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#66dd8b',
                  fontWeight: '600',
                }}
              >
                {deal.contact.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: '600', fontSize: '16px', color: '#e5e7eb' }}>{deal.contact.name}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                {deal.contact.phone || 'Sem telefone'}
              </div>
            </div>
          </div>

          {conversation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div>
                {conversation.status === 'CLOSED' ? (
                  <button
                    onClick={async () => {
                      try {
                        await api.put(`/api/conversations/${conversation.id}`, { status: 'OPEN' });
                        setConversation((prev: any) =>
                          prev ? { ...prev, status: 'OPEN' } : prev,
                        );
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'Erro ao abrir conversa');
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#10b981',
                      color: '#003919',
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
                      const confirmed = await confirmModal({
                        title: 'Fechar conversa',
                        message: 'Tem certeza que deseja fechar esta conversa?',
                        confirmText: 'Fechar',
                        cancelText: 'Cancelar',
                      });
                      if (!confirmed) return;
                      try {
                        await api.put(`/api/conversations/${conversation.id}`, { status: 'CLOSED' });
                        setConversation((prev: any) =>
                          prev ? { ...prev, status: 'CLOSED' } : prev,
                        );
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'Erro ao fechar conversa');
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#2e312e',
                      color: '#e5e7eb',
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
                    backgroundColor: '#10b981',
                    color: '#003919',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    marginRight: '10px',
                    marginLeft: '8px',
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
                  backgroundColor: '#2e312e',
                  color: '#9ca3af',
                  fontSize: '12px',
                }}
              >
                {conversation.status}
              </span>
              {currentUser && currentUser.role === 'ADMIN' && (
                <button
                  onClick={async () => {
                    if (!conversation) return;
                    const confirmed = await confirmModal({
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
                      await api.delete(`/api/conversations/${conversation.id}`);
                      setConversation(null);
                      setMessages([]);
                    } catch (error: any) {
                      console.error('Erro ao excluir conversa:', error);
                      alert(error.response?.data?.error || 'Erro ao excluir conversa');
                    }
                  }}
                  style={{
                    marginLeft: '10px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Excluir conversa (apenas administradores)"
                >
                  Excluir
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mensagens */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
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
                    onClick={() => {
                      if (conversation?.id) {
                        fetchMessages(conversation.id, { reset: false });
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
                const prevLabel = new Date(prev.createdAt).toLocaleDateString('pt-BR', {
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
              const isOwnMessage = !!message.user || (isBotMessage && !isTaskNotification && !isNoteNotification);
              const isMediaMessage = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(message.type);
              const contactName = deal?.contact?.name || '';
              const contactAvatar = deal?.contact
                ? getContactAvatar(deal.contact, 40)
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
                  className={`mb-1 flex w-full min-w-0 max-w-full items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  variants={{
                    hidden: { opacity: 0, y: 10, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{
                    duration: 0.2,
                    type: 'spring',
                    stiffness: 200,
                  }}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                >
                  {isFromCustomer && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-highest ring-1 ring-primary/15">
                      <img
                        src={contactAvatar}
                        alt={contactName}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getAvatarUrl(contactName || 'Contato', 40);
                        }}
                      />
                    </div>
                  )}
                  <div
                    className={`relative min-w-0 ${isTaskNotification ? 'w-full max-w-full' : 'max-w-[min(70%,36rem)]'} rounded-xl ${
                      isMediaMessage
                        ? 'bg-transparent p-0 text-on-surface'
                        : isTaskNotification
                        ? 'rounded-lg bg-surface-container-highest p-3 text-on-surface'
                        : isOwnMessage
                        ? 'bg-primary-container px-3.5 py-2.5 text-on-secondary-container'
                        : 'border border-[rgba(63,73,69,0.2)] bg-surface-container px-3.5 py-2.5 text-on-surface'
                    }`}
                  >
                    {isFromCustomer && (
                      <div className="mb-1 text-xs font-semibold text-on-surface-variant">
                        {contactName}
                      </div>
                    )}
                    {/* Exibir mídia se houver (mesmo estilo de Conversations) */}
                    {['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(message.type) && message.id && (
                      <div style={{ marginBottom: '8px' }}>
                        {message.type === 'IMAGE' && (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img
                              src={getMessageMediaUrl(message.id)}
                              alt={message.content || 'Imagem'}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '300px',
                                borderRadius: '8px',
                                objectFit: 'contain',
                                display: 'block',
                                cursor: 'pointer',
                              }}
                              onError={(e) => {
                                const imgEl = e.target as HTMLImageElement;
                                if (
                                  message.metadata?.mediaUrl &&
                                  isDirectlyRenderableMediaUrl(
                                    message.metadata.mediaUrl,
                                    message.metadata,
                                  )
                                ) {
                                  imgEl.src = resolveMediaMetadataUrl(message.metadata.mediaUrl);
                                }
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMediaMenuId(
                                    openMediaMenuId === message.id ? null : message.id,
                                  );
                                }}
                                style={{
                                  width: 28,
                                  height: 28,
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
                                  style={{
                                    marginTop: 4,
                                    right: 0,
                                    position: 'absolute',
                                    minWidth: '160px',
                                    backgroundColor: '#FFFFFF',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    borderRadius: '8px',
                                    padding: '6px 0',
                                    zIndex: 50,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDownloadMedia(message);
                                      setOpenMediaMenuId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '6px 14px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      fontSize: '13px',
                                      cursor: 'pointer',
                                    }}
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
                              src={getMessageMediaUrl(message.id)}
                              controls
                              style={{
                                maxWidth: '100%',
                                maxHeight: '320px',
                                borderRadius: '8px',
                              }}
                              onError={(e) => {
                                const videoEl = e.target as HTMLVideoElement;
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
                            <div
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMediaMenuId(
                                    openMediaMenuId === message.id ? null : message.id,
                                  );
                                }}
                                style={{
                                  width: 28,
                                  height: 28,
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
                                  style={{
                                    marginTop: 4,
                                    right: 0,
                                    position: 'absolute',
                                    minWidth: '160px',
                                    backgroundColor: '#FFFFFF',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    borderRadius: '8px',
                                    padding: '6px 0',
                                    zIndex: 50,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDownloadMedia(message);
                                      setOpenMediaMenuId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '6px 14px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      fontSize: '13px',
                                      cursor: 'pointer',
                                    }}
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
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 12px',
                              backgroundColor: isOwnMessage ? '#DCF8C6' : '#ffffff',
                              borderRadius: '999px',
                              minWidth: '260px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const audioEl = audioRefs.current[message.id];
                                if (!audioEl) return;

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
                                <span>
                                  {Math.floor(audioState[message.id]?.currentTime || 0) >= 0
                                    ? `${Math.floor(
                                        (audioState[message.id]?.currentTime || 0) / 60,
                                      )}:${String(
                                        Math.floor(audioState[message.id]?.currentTime || 0) % 60,
                                      ).padStart(2, '0')}`
                                    : '0:00'}
                                </span>
                                <span>
                                  {Math.floor(audioState[message.id]?.duration || 0) >= 0
                                    ? `${Math.floor(
                                        (audioState[message.id]?.duration || 0) / 60,
                                      )}:${String(
                                        Math.floor(audioState[message.id]?.duration || 0) % 60,
                                      ).padStart(2, '0')}`
                                    : '0:00'}
                                </span>
                              </div>
                            </div>
                            <audio
                              src={getMessageMediaUrl(message.id)}
                              controls={false}
                              style={{ display: 'none' }}
                              preload="metadata"
                              ref={(el) => {
                                audioRefs.current[message.id] = el;
                              }}
                              onLoadedMetadata={(ev) => {
                                const el = ev.currentTarget;
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
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Exibir documento se houver */}
                    {message.type === 'DOCUMENT' && message.metadata && (
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ fontSize: '24px' }}>📄</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>
                            {message.metadata.fileName || 'Documento'}
                          </div>
                          <a
                            href={
                              message.metadata?.mediaUrl &&
                              isDirectlyRenderableMediaUrl(
                                message.metadata.mediaUrl,
                                message.metadata,
                              )
                                ? resolveMediaMetadataUrl(message.metadata.mediaUrl)
                                : getMessageMediaUrl(message.id)
                            }
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
                    
                    {taskData && message.type === 'TEXT' ? (
                      <TaskNotificationCard
                        task={taskData}
                        onSaveResult={handleSaveTaskResult}
                        onComplete={handleCompleteTask}
                      />
                    ) : noteData && message.type === 'TEXT' ? (
                      <NoteNotificationCard note={noteData} />
                    ) : (
                      message.content && (
                        <div className="space-y-1 whitespace-pre-wrap break-words text-sm">
                          {message.user?.name && (
                            <div className="text-xs font-semibold leading-tight text-black">
                              {message.user.name}
                            </div>
                          )}
                          <p className="m-0">{message.content}</p>
                        </div>
                      )
                    )}
                    <span
                      className="mt-1 block text-[11px] opacity-70"
                    >
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
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
            title={`${newMessagesBelowCount} nova(s) mensagem(ns) — ir ao fim`}
            aria-label={`Ir às mensagens novas (${newMessagesBelowCount})`}
            style={{
              position: 'absolute',
              bottom: 16,
              right: 20,
              zIndex: 20,
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              backgroundColor: 'rgba(30, 40, 35, 0.95)',
              color: '#6ee7b7',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            }}
          >
            ↓
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 20,
                height: 20,
                padding: '0 5px',
                borderRadius: 999,
                backgroundColor: '#10b981',
                color: '#022c22',
                fontSize: 11,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {newMessagesBelowCount > 99 ? '99+' : newMessagesBelowCount}
            </span>
          </button>
        )}
        </div>

        {/* Input de mensagem e ações (igual ao chat principal) */}
        {conversation && (
          <div
            className="relative border-t border-primary/10 bg-surface/85 px-5 py-4 backdrop-blur-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(63,73,69,0.2)] bg-surface-container-highest text-base text-on-surface transition hover:bg-surface-variant"
                title="Emoji"
              >
                😀
              </button>
              <button
                type="button"
                onClick={() => setShowQuickReplies(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(63,73,69,0.2)] bg-surface-container-highest text-base text-on-surface transition hover:bg-surface-variant"
                title="Respostas rápidas"
              >
                ⚡
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(63,73,69,0.2)] bg-surface-container-highest text-base text-on-surface transition hover:bg-surface-variant"
                title="Enviar arquivo"
              >
                📎
              </button>
              {!voiceRecorder.isRecordingSession && !voiceRecorder.preview ? (
                <button
                  type="button"
                  onClick={() => void voiceRecorder.start()}
                  disabled={uploadingFile || voiceRecorder.sending || !conversation}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(63,73,69,0.2)] bg-surface-container-highest text-base transition ${
                    uploadingFile || !conversation
                      ? 'cursor-not-allowed text-on-surface-variant/60'
                      : 'cursor-pointer text-red-300 hover:bg-surface-variant'
                  }`}
                  title="Gravar áudio"
                >
                  🎤
                </button>
              ) : voiceRecorder.isRecordingSession ? (
                <button
                  type="button"
                  onClick={() => voiceRecorder.finish()}
                  className="flex h-9 w-9 animate-pulse items-center justify-center rounded-full border border-red-300/40 bg-red-500/10 text-base text-red-300"
                  title="Concluir e ouvir antes de enviar"
                >
                  ⏹
                </button>
              ) : null}
            </div>

            {(voiceRecorder.isRecordingSession || voiceRecorder.preview) && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container px-3 py-2 text-xs">
                {voiceRecorder.isRecordingSession ? (
                  <>
                    <span className="font-semibold text-on-surface">
                      {voiceRecorder.isPaused ? 'Pausado' : 'Gravando'} · {voiceRecorder.formatElapsed()}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        onClick={() => voiceRecorder.cancelAll()}
                        className="rounded-lg px-2 py-1 hover:bg-surface-variant"
                        title="Cancelar"
                      >
                        ✕
                      </button>
                      {voiceRecorder.supportsPause && (
                        <button
                          type="button"
                          onClick={() =>
                            voiceRecorder.isPaused ? voiceRecorder.resume() : voiceRecorder.pause()
                          }
                          className="rounded-lg px-2 py-1 hover:bg-surface-variant"
                          title={voiceRecorder.isPaused ? 'Retomar' : 'Pausar'}
                        >
                          {voiceRecorder.isPaused ? '▶' : '⏸'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => voiceRecorder.finish()}
                        className="rounded-lg px-2 py-1 font-bold text-primary hover:bg-surface-variant"
                        title="Concluir gravação"
                      >
                        ✓
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => voiceRecorder.togglePreviewPlayback()}
                      className="rounded-lg px-2 py-1 hover:bg-surface-variant"
                      title="Ouvir gravação"
                    >
                      {voiceRecorder.previewPlaying ? '⏸' : '▶'} Ouvir
                    </button>
                    <span className="text-on-surface-variant">Áudio pronto</span>
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        onClick={() => voiceRecorder.discardPreview()}
                        className="rounded-lg px-2 py-1 hover:bg-surface-variant"
                      >
                        Descartar
                      </button>
                      <button
                        type="button"
                        onClick={() => void voiceRecorder.sendPreview()}
                        disabled={voiceRecorder.sending || uploadingFile}
                        className="rounded-lg bg-primary px-3 py-1 font-bold text-on-primary disabled:opacity-50"
                      >
                        Enviar áudio
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                style={{
                  position: 'absolute',
                  bottom: '80px',
                  left: '20px',
                  zIndex: 2000,
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

            <form
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
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={
                  voiceRecorder.isRecordingSession
                    ? voiceRecorder.isPaused
                      ? 'Gravação pausada...'
                      : 'Gravando áudio...'
                    : voiceRecorder.preview
                      ? 'Ouça o áudio acima antes de enviar'
                      : uploadingFile
                        ? 'Enviando arquivo...'
                        : 'Digite sua mensagem...'
                }
                disabled={
                  voiceRecorder.isRecordingSession ||
                  !!voiceRecorder.preview ||
                  uploadingFile
                }
                className={`min-w-0 flex-1 rounded-xl border border-[rgba(63,73,69,0.28)] bg-surface-container px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/40 focus:outline-none ${
                  voiceRecorder.isRecordingSession || voiceRecorder.preview || uploadingFile
                    ? 'opacity-60'
                    : ''
                }`}
              />
              <button
                type="submit"
                disabled={
                  (!messageInput.trim() &&
                    !voiceRecorder.isRecordingSession &&
                    !voiceRecorder.preview &&
                    !uploadingFile) ||
                  sending ||
                  uploadingFile ||
                  voiceRecorder.sending
                }
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  (messageInput.trim() ||
                    voiceRecorder.isRecordingSession ||
                    voiceRecorder.preview) &&
                  !sending &&
                  !uploadingFile &&
                  !voiceRecorder.sending
                    ? 'active-gradient-emerald cursor-pointer text-on-primary shadow-emerald-send hover:brightness-110'
                    : 'cursor-not-allowed bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                {sending || voiceRecorder.sending
                  ? 'Enviando...'
                  : uploadingFile
                    ? 'Enviando...'
                    : voiceRecorder.isRecordingSession
                      ? voiceRecorder.isPaused
                        ? 'Pausado'
                        : 'Gravando...'
                      : voiceRecorder.preview
                        ? 'Enviar áudio'
                        : 'Enviar'}
              </button>
            </form>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <QuickRepliesModal
              isOpen={showQuickReplies}
              onClose={() => setShowQuickReplies(false)}
              onSelect={handleQuickReplySelect}
              contactId={deal.contact.id}
              conversationId={conversation?.id}
            />
          </div>
        )}
      </div>

      {/* Notificação flutuante de tarefa (apenas visual, interna) */}
      {taskNotification && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            maxWidth: '320px',
            backgroundColor: '#1a1c1a',
            border: '1px solid rgba(63, 73, 69, 0.35)',
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 8px 32px rgba(226, 227, 223, 0.08)',
            zIndex: 3000,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#66dd8b' }}>Tarefa de pipeline</span>
            <button
              type="button"
              onClick={() => setTaskNotification(null)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#9ca3af',
              }}
              title="Fechar"
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#e5e7eb', whiteSpace: 'pre-wrap' }}>
            {taskNotification.content}
          </div>
        </div>
      )}

      {/* Modal de transferência: setor (fila) ou usuário do setor */}
      {showTransferModal && conversation && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowTransferModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1c1a',
              border: '1px solid rgba(63, 73, 69, 0.35)',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '12px', color: '#e5e7eb' }}>Transferir conversa</h2>
            <p style={{ color: '#9ca3af', marginBottom: '16px', fontSize: '14px' }}>
              {transferSectorStep
                ? `Setor: ${transferSectorStep.name}. Fila do setor ou atendente específico.`
                : 'Escolha o setor. Depois: fila do setor ou um usuário vinculado a ele.'}
            </p>
            {transferSectorStep && (
              <button
                type="button"
                onClick={() => {
                  setTransferSectorStep(null);
                  setTransferSectorUsers([]);
                }}
                style={{
                  marginBottom: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(63, 73, 69, 0.35)',
                  background: '#2e312e',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ← Outro setor
              </button>
            )}
            <div
              style={{
                maxHeight: 'min(52vh, 360px)',
                overflowY: 'auto',
                border: '1px solid rgba(63, 73, 69, 0.35)',
                borderRadius: '6px',
                padding: '10px',
                backgroundColor: '#121412',
              }}
            >
              {!transferSectorStep ? (
                sectors.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>Carregando setores...</p>
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
                        setLoadingTransferUsers(true);
                        setTransferSectorUsers([]);
                        try {
                          const res = await api.get(`/api/sectors/${sector.id}/users`);
                          setTransferSectorUsers(res.data || []);
                        } catch (error: any) {
                          alert(error.response?.data?.error || 'Erro ao carregar usuários do setor');
                          setTransferSectorStep(null);
                        } finally {
                          setLoadingTransferUsers(false);
                        }
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px',
                        marginBottom: '8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid rgba(63, 73, 69, 0.35)',
                        backgroundColor: `${sector.color || '#10b981'}22`,
                        color: '#e5e7eb',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{sector.name}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Setor</div>
                    </button>
                  ))
                )
              ) : loadingTransferUsers ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>Carregando atendentes...</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/api/conversations/${conversation.id}/transfer-sector`, {
                          sectorId: transferSectorStep.id,
                          autoAssign: false,
                        });
                        alert(`Conversa na fila do setor ${transferSectorStep.name}.`);
                        setShowTransferModal(false);
                        await fetchConversation(conversation.id);
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'Erro ao transferir conversa');
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px',
                      marginBottom: '12px',
                      borderRadius: '6px',
                      border: '2px solid rgba(16, 185, 129, 0.45)',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>Fila do setor</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                      Sem atendente fixo; distribuição pode atribuir depois.
                    </div>
                  </button>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#9ca3af',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Atendente específico
                  </div>
                  {transferSectorUsers.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>
                      Nenhum usuário neste setor.
                    </p>
                  ) : (
                    transferSectorUsers.map((user: any) => (
                      <button
                        key={user.id}
                        type="button"
                        disabled={!user.isActive}
                        onClick={async () => {
                          if (!user.isActive) return;
                          try {
                            await api.post(`/api/conversations/${conversation.id}/transfer-sector`, {
                              sectorId: transferSectorStep.id,
                              userId: user.id,
                            });
                            alert(`Conversa transferida para ${user.name}.`);
                            setShowTransferModal(false);
                            await fetchConversation(conversation.id);
                          } catch (error: any) {
                            alert(error.response?.data?.error || 'Erro ao transferir conversa');
                          }
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px',
                          marginBottom: '8px',
                          borderRadius: '6px',
                          cursor: user.isActive ? 'pointer' : 'not-allowed',
                          opacity: user.isActive ? 1 : 0.5,
                          border: '1px solid rgba(63, 73, 69, 0.35)',
                          backgroundColor: '#1a1c1a',
                          color: '#e5e7eb',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.name}</div>
                        <div style={{ color: '#9ca3af', fontSize: '12px' }}>{user.email}</div>
                        {user.isPaused ? (
                          <span style={{ fontSize: '10px', color: '#fbbf24' }}>Em pausa</span>
                        ) : null}
                        {!user.isActive ? (
                          <span style={{ fontSize: '10px', color: '#9ca3af' }}>Inativo</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid rgba(63, 73, 69, 0.35)',
                  backgroundColor: '#2e312e',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

