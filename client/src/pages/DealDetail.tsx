import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import QuickRepliesModal from '../components/QuickRepliesModal';
import CustomFieldsManager from '../components/CustomFieldsManager';

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

interface Message {
  id: string;
  content: string;
  type: string;
  status: string;
  createdAt: string;
  metadata?: {
    mediaUrl?: string;
    fileName?: string;
    mimetype?: string;
    mediaMetadata?: any;
  };
  user?: {
    id: string;
    name: string;
  };
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('principal');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  // Estados para campos personalizados do pipeline
  const [pipelineCustomFields, setPipelineCustomFields] = useState<any[]>([]);
  
  // Estados para edição de campos comerciais fixos
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldEditValue, setFieldEditValue] = useState('');
  
  // Estados para usuários
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; isActive?: boolean }>>([]);
  const [updatingAssignedUser, setUpdatingAssignedUser] = useState(false);
  
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
    }
  }, [id]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users?includeInactive=true');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (deal?.conversation?.id) {
      fetchConversation(deal.conversation.id);
    } else if (deal) {
      createOrGetConversation();
    }
  }, [deal]);

  useEffect(() => {
    if (conversation?.id) {
      fetchMessages(conversation.id);

      // Conectar ao Socket.IO
      const socket: Socket = io('http://localhost:3007', {
        transports: ['websocket', 'polling'],
      });

      socket.on('new_message', async (data: { conversationId: string }) => {
        if (data.conversationId === conversation.id) {
          await fetchMessages(conversation.id);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [conversation]);

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
      const channelId = dealContact.channelId || deal.contact.channelId;
      
      if (!channelId) {
        alert('Nenhum canal disponível para criar contato');
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
            channelIdentifier: `${cleanPhone}@s.whatsapp.net`,
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

        const newConvResponse = await api.post('/api/conversations', {
          channelId: contact.channelId,
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

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await api.get(`/api/messages/conversation/${conversationId}`);
      setMessages((response.data || []).reverse());
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
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
      await fetchMessages(conversation.id);
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

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Seu navegador não suporta gravação de áudio. Use Chrome, Firefox ou Edge.');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (mediaError: any) {
        alert('Erro ao acessar o microfone. Verifique permissões e tente novamente.');
        console.error('Erro ao acessar microfone:', mediaError);
        return;
      }

      if (!window.MediaRecorder) {
        alert('Seu navegador não suporta gravação de áudio. Use Chrome, Firefox ou Edge atualizado.');
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      let recorder: MediaRecorder;
      const mimeTypes = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
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
          if (audioBlob.size === 0) {
            alert('O áudio gravado está vazio. Tente novamente.');
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          let extension = 'ogg';
          if (selectedMimeType.includes('ogg')) extension = 'ogg';
          else if (selectedMimeType.includes('webm')) extension = 'webm';

          const audioFile = new File([audioBlob], `audio.${extension}`, {
            type: selectedMimeType || 'audio/ogg;codecs=opus',
          });

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

            const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
            await handleSendMessage(fakeEvent, url, 'AUDIO', `audio.${extension}`, 'Áudio', mimetype);
          } catch (error: any) {
            console.error('Erro ao enviar áudio:', error);
            alert('Erro ao enviar áudio. Tente novamente.');
          } finally {
            setUploadingFile(false);
          }
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error: any) {
      console.error('Erro inesperado ao iniciar gravação:', error);
      alert('Erro inesperado ao iniciar gravação. Tente novamente.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
    }
  };

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

  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }

  if (!deal) {
    return <div style={{ padding: '20px' }}>Negócio não encontrado</div>;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Sidebar Esquerda - Informações do Lead */}
      <div
        style={{
          width: '400px',
          backgroundColor: '#0f766e',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
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

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                fontSize: '11px',
              }}
            >
              {deal.stage.name}
            </span>
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
          {['principal', 'configuracao', 'forecast'].map((tab) => (
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
              {tab === 'principal' ? 'Principal' : tab === 'configuracao' ? 'Configuração' : 'Forecast'}
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

          {activeTab === 'forecast' && <div style={{ opacity: 0.8 }}>Previsão de fechamento</div>}
        </div>
      </div>

      {/* Área Direita - Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
        {/* Header do Chat */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
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
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
              }}
            >
              {deal.contact.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: '600', fontSize: '16px' }}>{deal.contact.name}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {deal.contact.phone || 'Sem telefone'}
            </div>
          </div>
        </div>

        {/* Mensagens */}
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
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <p>Nenhuma mensagem ainda.</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                Envie uma mensagem para começar a conversa.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwnMessage = !!message.user;
              return (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      backgroundColor: isOwnMessage ? '#3b82f6' : '#f3f4f6',
                      color: isOwnMessage ? 'white' : '#1f2937',
                    }}
                  >
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
                            onError={(e) => {
                              const imgEl = e.target as HTMLImageElement;
                              if (message.metadata?.mediaUrl) {
                                imgEl.src = message.metadata.mediaUrl.startsWith('http') 
                                  ? message.metadata.mediaUrl 
                                  : `http://localhost:3007${message.metadata.mediaUrl}`;
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
                            onError={(e) => {
                              const videoEl = e.target as HTMLVideoElement;
                              if (message.metadata?.mediaUrl) {
                                videoEl.src = message.metadata.mediaUrl.startsWith('http') 
                                  ? message.metadata.mediaUrl 
                                  : `http://localhost:3007${message.metadata.mediaUrl}`;
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
                              src={`http://localhost:3007/api/media/${message.id}`}
                              controls
                              style={{ 
                                width: '220px',
                                height: '32px',
                                flex: 1,
                              }}
                              preload="metadata"
                              onError={(e) => {
                                const audioEl = e.target as HTMLAudioElement;
                                if (message.metadata?.mediaUrl) {
                                  audioEl.src = message.metadata.mediaUrl.startsWith('http') 
                                    ? message.metadata.mediaUrl 
                                    : `http://localhost:3007${message.metadata.mediaUrl}`;
                                }
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
                    
                    {/* Exibir conteúdo/caption */}
                    {message.content && (
                      <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {message.content}
                      </p>
                    )}
                    <span
                      style={{
                        fontSize: '11px',
                        opacity: 0.7,
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de mensagem e ações (igual ao chat principal) */}
        {conversation && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: 'white',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '20px',
                }}
              >
                😀
              </button>
              <button
                type="button"
                onClick={() => setShowQuickReplies(true)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '20px',
                }}
                title="Respostas rápidas"
              >
                ⚡
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '20px',
                }}
                title="Enviar arquivo"
              >
                📎
              </button>
              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={uploadingFile}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: uploadingFile ? 'not-allowed' : 'pointer',
                    fontSize: '20px',
                    color: uploadingFile ? '#9ca3af' : '#ef4444',
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
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '20px',
                    color: '#ef4444',
                    animation: 'pulse 1s infinite',
                  }}
                  title="Parar gravação"
                >
                  ⏹
                </button>
              )}
            </div>

            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                style={{
                  position: 'absolute',
                  bottom: '90px',
                  left: '20px',
                  zIndex: 2000,
                }}
              >
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}

            <form
              onSubmit={(e) => handleSendMessage(e)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={recording ? 'Gravando áudio...' : uploadingFile ? 'Enviando arquivo...' : 'Digite sua mensagem...'}
                disabled={recording || uploadingFile}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  opacity: recording || uploadingFile ? 0.6 : 1,
                }}
              />
              <button
                type="submit"
                disabled={(!messageInput.trim() && !recording && !uploadingFile) || sending || uploadingFile}
                style={{
                  padding: '10px 20px',
                  backgroundColor: (messageInput.trim() || recording) && !sending && !uploadingFile ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (messageInput.trim() || recording) && !sending && !uploadingFile ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                {sending ? 'Enviando...' : uploadingFile ? 'Enviando...' : recording ? 'Gravando...' : 'Enviar'}
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
    </div>
  );
}

