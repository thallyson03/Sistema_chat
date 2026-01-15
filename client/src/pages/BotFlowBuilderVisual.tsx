import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  BackgroundVariant,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import api from '../utils/api';

interface Flow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  steps: FlowStep[];
}

interface FlowStep {
  id: string;
  type: string;
  order: number;
  config: any;
  nextStepId?: string;
  response?: Response;
  conditions?: FlowCondition[];
  intent?: {
    id: string;
    name: string;
  };
  position?: { x: number; y: number };
}

interface FlowCondition {
  id: string;
  condition: string;
  operator: string;
  value: string;
  trueStepId?: string;
  falseStepId?: string;
}

interface Response {
  id: string;
  type: string;
  content: string;
  buttons?: any;
  mediaUrl?: string;
}

interface Intent {
  id: string;
  name: string;
  keywords: string[];
}

// Componente de nó customizado para mensagem
const MessageNode = ({ data, selected }: any) => {
  const buttons = data.buttons || [];
  
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#3b82f6',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(59, 130, 246, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #60a5fa' : '2px solid transparent',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#60a5fa' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>💬 Mensagem</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: buttons.length > 0 ? '10px' : '0' }}>
        {data.content ? (data.content.length > 50 ? data.content.substring(0, 50) + '...' : data.content) : 'Nova mensagem'}
      </div>
      {buttons.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {buttons.map((btn: any, idx: number) => (
            <div
              key={idx}
              style={{
                padding: '6px 10px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '5px',
                fontSize: '11px',
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              {btn.text || `Botão ${idx + 1}`}
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#60a5fa' }} />
    </div>
  );
};

// Componente de nó customizado para condição
const ConditionNode = ({ data, selected }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#f59e0b',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(245, 158, 11, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #fbbf24' : '2px solid transparent',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#fbbf24' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🔀 Condição</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '10px' }}>
        {data.condition ? `${data.condition} ${data.operator} ${data.value}` : 'Nova condição'}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <div style={{
          flex: 1,
          padding: '6px',
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: '5px',
          fontSize: '11px',
          textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>
          Sim
        </div>
        <div style={{
          flex: 1,
          padding: '6px',
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: '5px',
          fontSize: '11px',
          textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>
          Não
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" style={{ background: '#10b981', left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ background: '#ef4444', left: '75%' }} />
    </div>
  );
};

// Componente de nó customizado para handoff
const HandoffNode = ({ data }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#ef4444',
        color: 'white',
        borderRadius: '8px',
        minWidth: '150px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#f87171' }} />
      <div style={{ fontWeight: 'bold' }}>👤 Transferir</div>
      <div style={{ fontSize: '12px', opacity: 0.9 }}>Para humano</div>
    </div>
  );
};

// Componente de nó customizado para delay
const DelayNode = ({ data }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#6b7280',
        color: 'white',
        borderRadius: '8px',
        minWidth: '150px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#9ca3af' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>⏱️ Aguardar</div>
      <div style={{ fontSize: '12px', opacity: 0.9 }}>
        {data.delay ? `${data.delay}ms` : 'Tempo'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#9ca3af' }} />
    </div>
  );
};

// Componente de nó customizado para input
const InputNode = ({ data, selected }: any) => {
  const inputType = data.config?.inputType || 'TEXT';
  const icons: Record<string, string> = {
    TEXT: '📝',
    NUMBER: '🔢',
    EMAIL: '📧',
    PHONE: '📱',
    DATE: '📅',
    CHOICE: '☑️',
  };
  
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#10b981',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(16, 185, 129, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #34d399' : '2px solid transparent',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#34d399' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
        {icons[inputType] || '📝'} Input: {inputType}
      </div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.placeholder || 'Aguardando resposta...'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#34d399' }} />
    </div>
  );
};

// Componente de nó customizado para set variable
const SetVariableNode = ({ data, selected }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#8b5cf6',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(139, 92, 246, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #a78bfa' : '2px solid transparent',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#a78bfa' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🔧 Definir Variável</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.variableName ? `{{${data.config.variableName}}}` : 'Nova variável'}
      </div>
      {data.config?.value && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          = {String(data.config.value).length > 30 ? String(data.config.value).substring(0, 30) + '...' : data.config.value}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#a78bfa' }} />
    </div>
  );
};

// Componente de nó customizado para HTTP Request
const HTTPRequestNode = ({ data, selected }: any) => {
  const method = data.config?.method || 'GET';
  const url = data.config?.url || '';
  const response = data.config?.lastResponse;
  const methodColors: Record<string, string> = {
    GET: '#10b981',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    DELETE: '#ef4444',
    PATCH: '#8b5cf6',
  };
  
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: methodColors[method] || '#6b7280',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '350px',
        boxShadow: selected ? `0 4px 12px ${methodColors[method] || '#6b7280'}40` : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'rgba(255,255,255,0.8)' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
        🌐 HTTP {method}
      </div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px', wordBreak: 'break-word' }}>
        {url ? (url.length > 40 ? url.substring(0, 40) + '...' : url) : 'Nova requisição'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic', marginTop: '5px' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      {response && (
        <div style={{ 
          marginTop: '10px', 
          padding: '8px', 
          backgroundColor: 'rgba(0,0,0,0.2)', 
          borderRadius: '5px',
          fontSize: '11px',
          maxHeight: '100px',
          overflow: 'auto',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>📋 Preview:</div>
          <pre style={{ 
            margin: 0, 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}>
            {typeof response === 'object' 
              ? JSON.stringify(response, null, 2).substring(0, 150) + (JSON.stringify(response, null, 2).length > 150 ? '...' : '')
              : String(response).substring(0, 150) + (String(response).length > 150 ? '...' : '')}
          </pre>
        </div>
      )}
      {data.config?.fieldMappings && data.config.fieldMappings.length > 0 && (
        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '5px' }}>
          {data.config.fieldMappings.length} campo(s) mapeado(s)
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: 'rgba(255,255,255,0.8)' }} />
    </div>
  );
};

// Componente de nó customizado para início
const StartNode = ({ data }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#10b981',
        color: 'white',
        borderRadius: '8px',
        minWidth: '150px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        fontWeight: 'bold',
        position: 'relative',
      }}
    >
      🚀 Início
      <Handle type="source" position={Position.Bottom} style={{ background: '#34d399' }} />
    </div>
  );
};

// Componente de nó customizado para fim
const EndNode = ({ data }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#ef4444',
        color: 'white',
        borderRadius: '8px',
        minWidth: '150px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        fontWeight: 'bold',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#f87171' }} />
      🏁 Fim
    </div>
  );
};

// Função para extrair campos de um objeto recursivamente
const extractFieldsFromObject = (obj: any, prefix: string = ''): string[] => {
  const fields: string[] = [];
  
  if (obj === null || obj === undefined) {
    return fields;
  }
  
  if (typeof obj !== 'object') {
    return fields;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object') {
      return extractFieldsFromObject(obj[0], prefix);
    }
    return fields;
  }
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      fields.push(fieldPath);
      
      // Se o valor é um objeto (mas não array), extrair recursivamente
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        fields.push(...extractFieldsFromObject(obj[key], fieldPath));
      } else if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'object') {
        // Para arrays de objetos, adicionar índice [0]
        fields.push(`${fieldPath}[0]`);
        fields.push(...extractFieldsFromObject(obj[key][0], `${fieldPath}[0]`));
      }
    }
  }
  
  return fields;
};

const nodeTypes: NodeTypes = {
  message: MessageNode,
  condition: ConditionNode,
  handoff: HandoffNode,
  delay: DelayNode,
  input: InputNode,
  setVariable: SetVariableNode,
  httpRequest: HTTPRequestNode,
  start: StartNode,
  end: EndNode,
};

export default function BotFlowBuilderVisual() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [stepFormData, setStepFormData] = useState({
    type: 'MESSAGE',
    content: '',
    order: 0,
    intentId: '',
    config: {} as any,
  });
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowFormData, setFlowFormData] = useState({
    name: '',
    description: '',
  });

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (botId) {
      fetchFlows();
      fetchIntents();
    }
  }, [botId]);

  useEffect(() => {
    if (selectedFlow) {
      loadFlowToCanvas(selectedFlow);
    }
  }, [selectedFlow]);

  const fetchFlows = async () => {
    try {
      const response = await api.get(`/api/bots/${botId}/flows`);
      setFlows(response.data || []);
      if (response.data && response.data.length > 0 && !selectedFlow) {
        setSelectedFlow(response.data[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar fluxos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntents = async () => {
    try {
      const response = await api.get(`/api/bots/${botId}/intents`);
      setIntents(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar intents:', error);
    }
  };

  const loadFlowToCanvas = (flow: Flow) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Nó de início
    newNodes.push({
      id: 'start',
      type: 'start',
      position: { x: 250, y: 50 },
      data: { label: 'Início' },
    });

    // Carregar steps como nós
    if (flow.steps && flow.steps.length > 0) {
      flow.steps.forEach((step, index) => {
        const nodeType = step.type === 'MESSAGE' ? 'message' :
                         step.type === 'CONDITION' ? 'condition' :
                         step.type === 'HANDOFF' ? 'handoff' :
                         step.type === 'DELAY' ? 'delay' : 'message';

        const position = step.position || {
          x: 250,
          y: 150 + (index * 150),
        };

        newNodes.push({
          id: step.id,
          type: nodeType,
          position,
          data: {
            label: step.type,
            content: step.response?.content || '',
            condition: step.conditions?.[0]?.condition || '',
            operator: step.conditions?.[0]?.operator || '',
            value: step.conditions?.[0]?.value || '',
            delay: step.config?.delay || '',
            buttons: step.config?.buttons || [],
            stepId: step.id,
          },
        });

        // Criar conexões
        if (index === 0) {
          // Conectar início ao primeiro step
          newEdges.push({
            id: `start-${step.id}`,
            source: 'start',
            target: step.id,
          });
        }

        if (step.nextStepId) {
          newEdges.push({
            id: `${step.id}-${step.nextStepId}`,
            source: step.id,
            target: step.nextStepId,
          });
        }

        // Conexões de condição
        if (step.conditions && step.conditions.length > 0) {
          const condition = step.conditions[0];
          if (condition.trueStepId) {
            newEdges.push({
              id: `${step.id}-true-${condition.trueStepId}`,
              source: step.id,
              target: condition.trueStepId,
              label: 'Sim',
              style: { stroke: '#10b981' },
            });
          }
          if (condition.falseStepId) {
            newEdges.push({
              id: `${step.id}-false-${condition.falseStepId}`,
              source: step.id,
              target: condition.falseStepId,
              label: 'Não',
              style: { stroke: '#ef4444' },
            });
          }
        }
      });

      // Nó de fim
      newNodes.push({
        id: 'end',
        type: 'end',
        position: { x: 250, y: 150 + (flow.steps.length * 150) },
        data: { label: 'Fim' },
      });
    } else {
      // Se não há steps, apenas mostrar início e fim
      newNodes.push({
        id: 'end',
        type: 'end',
        position: { x: 250, y: 200 },
        data: { label: 'Fim' },
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      // Adicionar label baseado no tipo de conexão
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      let label = '';
      let edgeStyle = { stroke: '#3b82f6', strokeWidth: 2 };
      let labelColor = '#3b82f6';
      
      if (sourceNode?.type === 'condition') {
        // Usar o sourceHandle para determinar se é "Sim" ou "Não"
        if (params.sourceHandle === 'true') {
          label = 'Sim';
          edgeStyle = { stroke: '#10b981', strokeWidth: 2 };
          labelColor = '#10b981';
        } else if (params.sourceHandle === 'false') {
          label = 'Não';
          edgeStyle = { stroke: '#ef4444', strokeWidth: 2 };
          labelColor = '#ef4444';
        }
      } else if (sourceNode?.type === 'message' && sourceNode.data.buttons) {
        // Se for uma mensagem com botões, usar o texto do botão
        const buttonIndex = edges.filter(e => e.source === params.source).length;
        if (sourceNode.data.buttons[buttonIndex]) {
          label = sourceNode.data.buttons[buttonIndex].text;
        }
      }
      
      const newEdge = {
        ...params,
        id: `${params.source}-${params.target}-${Date.now()}`,
        label: label,
        style: edgeStyle,
        labelStyle: { 
          fill: labelColor,
          fontWeight: 600,
        },
        labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
      };
      
      setEdges((eds) => [...eds, newEdge]);
    },
    [edges, nodes]
  );

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flowFormData.name) {
      alert('Preencha o nome do fluxo');
      return;
    }

    try {
      const response = await api.post(`/api/bots/${botId}/flows`, {
        name: flowFormData.name,
        description: flowFormData.description || null,
      });
      setFlows([...flows, response.data]);
      setSelectedFlow(response.data);
      setShowFlowModal(false);
      setFlowFormData({ name: '', description: '' });
      alert('Fluxo criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar fluxo:', error);
      alert(error.response?.data?.error || 'Erro ao criar fluxo');
    }
  };

  const handleAddNode = (type: string) => {
    if (!selectedFlow) {
      alert('Selecione um fluxo primeiro');
      return;
    }

    const newNode: Node = {
      id: `step-${Date.now()}`,
      type: type,
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: {
        label: type,
        content: '',
        stepId: `step-${Date.now()}`,
        config: type === 'input' ? { inputType: 'TEXT', placeholder: '', variableName: '' } :
                type === 'setVariable' ? { variableName: '', value: '' } :
                type === 'httpRequest' ? { method: 'GET', url: '', headers: {}, body: '', variableName: 'httpResponse', showResponse: false, fieldMappings: [] } : {},
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  const handleNodeDoubleClick = (event: React.MouseEvent, node: Node) => {
    setEditingNode(node);
    
    // Determinar tipo do step
    const stepType = node.type === 'message' ? 'MESSAGE' :
                     node.type === 'condition' ? 'CONDITION' :
                     node.type === 'handoff' ? 'HANDOFF' :
                     node.type === 'delay' ? 'DELAY' :
                     node.type === 'input' ? 'INPUT' :
                     node.type === 'setVariable' ? 'SET_VARIABLE' :
                     node.type === 'httpRequest' ? 'HTTP_REQUEST' : 'MESSAGE';
    
    // Configurar config baseado no tipo
    let config: any = {};
    if (node.data.delay) {
      config = { delay: node.data.delay };
    } else if (node.data.condition) {
      config = {
        condition: node.data.condition,
        operator: node.data.operator,
        value: node.data.value,
      };
    } else if (node.data.config) {
      config = { ...node.data.config };
      // Garantir que fieldMappings existe para HTTP_REQUEST
      if (stepType === 'HTTP_REQUEST' && !config.fieldMappings) {
        config.fieldMappings = [];
      }
      // Preservar lastResponse se existir
      if (node.data.config.lastResponse) {
        config.lastResponse = node.data.config.lastResponse;
      }
    } else if (stepType === 'HTTP_REQUEST') {
      // Inicializar config padrão para HTTP_REQUEST se não existir
      config = {
        method: 'GET',
        url: '',
        headers: {},
        body: '',
        variableName: 'httpResponse',
        showResponse: false,
        fieldMappings: [],
      };
    }
    
    setStepFormData({
      type: stepType,
      content: node.data.content || '',
      order: 0,
      intentId: '',
      config: config,
      buttons: node.data.buttons || [],
    });
    setShowStepModal(true);
  };

  const handleSaveStep = async () => {
    if (!selectedFlow || !editingNode) return;

    try {
      // Verificar se é edição: stepId existe e não começa com "step-" (que indica ID temporário)
      const stepIdValue = editingNode.data.stepId;
      const isEditing = stepIdValue && !stepIdValue.startsWith('step-');
      let stepId: string;
      let shouldCreateNew = false;

      if (isEditing) {
        // Tentar atualizar step existente
        stepId = stepIdValue;
        try {
          await api.put(`/api/bots/steps/${stepId}`, {
            type: stepFormData.type,
            order: stepFormData.order,
            config: {
              ...stepFormData.config,
              buttons: stepFormData.buttons,
            },
            intentId: stepFormData.intentId || null,
          });
        } catch (updateError: any) {
          // Se o step não existir, criar um novo
          if (updateError.response?.status === 404 || updateError.response?.status === 400) {
            console.warn('Step não encontrado, criando novo:', updateError);
            shouldCreateNew = true;
          } else {
            throw updateError;
          }
        }
      } else {
        shouldCreateNew = true;
      }
      
      if (shouldCreateNew) {
        // Criar novo step
        const stepResponse = await api.post(`/api/bots/flows/${selectedFlow.id}/steps`, {
          type: stepFormData.type,
          order: stepFormData.order,
          config: {
            ...stepFormData.config,
            buttons: stepFormData.buttons,
          },
          intentId: stepFormData.intentId || null,
          responseId: null,
        });
        stepId = stepResponse.data.id;
      }

      // Criar ou atualizar resposta se for tipo MESSAGE
      let responseId = null;
      if (stepFormData.type === 'MESSAGE' && stepFormData.content) {
        try {
          // Verificar se já existe uma resposta para este step
          // Por enquanto, sempre criar nova resposta (pode ser melhorado depois)
          const response = await api.post('/api/bots/responses', {
            type: 'TEXT',
            content: stepFormData.content,
            flowStepId: stepId, // Usar o ID do step
            intentId: null,
          });
          responseId = response.data.id;
          
          // Atualizar o step com o responseId
          await api.put(`/api/bots/steps/${stepId}`, {
            responseId: responseId,
          });
        } catch (responseError: any) {
          console.error('Erro ao criar resposta:', responseError);
          // Continuar mesmo se falhar a criação da resposta
        }
      }

      // Atualizar nó com dados do step
      setNodes((nds) =>
        nds.map((node) =>
          node.id === editingNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: stepFormData.content,
                  condition: stepFormData.config.condition,
                  operator: stepFormData.config.operator,
                  value: stepFormData.config.value,
                  delay: stepFormData.config.delay,
                  buttons: stepFormData.buttons,
                  stepId: stepId,
                },
              }
            : node
        )
      );

      // Recarregar o fluxo para ter os dados atualizados
      const updatedFlowResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
      const updatedFlow = updatedFlowResponse.data;
      loadFlowToCanvas(updatedFlow);

      setShowStepModal(false);
      setEditingNode(null);
      setStepFormData({ type: 'MESSAGE', content: '', order: 0, intentId: '', config: {}, buttons: [] });
      alert('Step salvo com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar step:', error);
      alert(error.response?.data?.error || 'Erro ao salvar step');
    }
  };

  const handleSaveFlow = async () => {
    if (!selectedFlow) {
      alert('Selecione um fluxo primeiro');
      return;
    }

    // Salvar posições dos nós e conexões como steps
    // Isso seria implementado salvando cada nó como um step e as conexões como nextStepId
    alert('Funcionalidade de salvar fluxo completo será implementada');
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button
              onClick={() => navigate('/bots')}
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
            <h2 style={{ margin: 0 }}>Criar Fluxo Visual - Bot {botId}</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select
              value={selectedFlow?.id || ''}
              onChange={(e) => {
                const flow = flows.find(f => f.id === e.target.value);
                setSelectedFlow(flow || null);
              }}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                fontSize: '14px',
              }}
            >
              <option value="">Selecione um fluxo</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowFlowModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              + Novo Fluxo
            </button>
            <button
              onClick={handleSaveFlow}
              disabled={!selectedFlow}
              style={{
                padding: '8px 16px',
                backgroundColor: !selectedFlow ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: !selectedFlow ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              💾 Salvar Fluxo
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '15px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', marginRight: '10px' }}>Adicionar:</span>
          <button
            onClick={() => handleAddNode('message')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            💬 Mensagem
          </button>
          <button
            onClick={() => handleAddNode('condition')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            🔀 Condição
          </button>
          <button
            onClick={() => handleAddNode('handoff')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            👤 Transferir
          </button>
          <button
            onClick={() => handleAddNode('delay')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            ⏱️ Aguardar
          </button>
          <button
            onClick={() => handleAddNode('input')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            📝 Input
          </button>
          <button
            onClick={() => handleAddNode('setVariable')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            🔧 Variável
          </button>
          <button
            onClick={() => handleAddNode('httpRequest')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#06b6d4',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            🌐 HTTP Request
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!selectedFlow ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6b7280',
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '18px', marginBottom: '10px' }}>Nenhum fluxo selecionado</p>
              <p>Crie um novo fluxo ou selecione um existente para começar</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={handleNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
            defaultEdgeOptions={{
              style: { strokeWidth: 2 },
              type: 'smoothstep',
            }}
            snapToGrid={true}
            snapGrid={[20, 20]}
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <MiniMap 
              nodeColor={(node) => {
                if (node.type === 'start') return '#10b981';
                if (node.type === 'end') return '#ef4444';
                if (node.type === 'message') return '#3b82f6';
                if (node.type === 'condition') return '#f59e0b';
                if (node.type === 'handoff') return '#ef4444';
                return '#6b7280';
              }}
            />
          </ReactFlow>
        )}
      </div>

      {/* Modal Criar Fluxo */}
      {showFlowModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowFlowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Novo Fluxo</h2>
            <form onSubmit={handleCreateFlow}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={flowFormData.name}
                  onChange={(e) => setFlowFormData({ ...flowFormData, name: e.target.value })}
                  placeholder="Ex: Fluxo de Vendas"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Descrição
                </label>
                <textarea
                  value={flowFormData.description}
                  onChange={(e) => setFlowFormData({ ...flowFormData, description: e.target.value })}
                  placeholder="Descrição do fluxo..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowFlowModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  Criar Fluxo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Step */}
      {showStepModal && editingNode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setShowStepModal(false);
            setEditingNode(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
              Editar {stepFormData.type || 'Step'}
            </h2>

            {!stepFormData.type && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>
                Erro: Tipo de step não definido. Por favor, feche e tente novamente.
              </div>
            )}

            {stepFormData.type === 'MESSAGE' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Mensagem *
                  </label>
                  <textarea
                    value={stepFormData.content}
                    onChange={(e) => setStepFormData({ ...stepFormData, content: e.target.value })}
                    placeholder="Digite a mensagem que o bot enviará..."
                    rows={4}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Botões de Ação</label>
                    <button
                      type="button"
                      onClick={() => {
                        setStepFormData({
                          ...stepFormData,
                          buttons: [...stepFormData.buttons, { text: '', action: '', nextStepId: '' }],
                        });
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      + Adicionar Botão
                    </button>
                  </div>
                  
                  {stepFormData.buttons.map((button, index) => (
                    <div key={index} style={{ 
                      marginBottom: '10px', 
                      padding: '10px', 
                      backgroundColor: '#f9fafb', 
                      borderRadius: '5px',
                      border: '1px solid #e5e7eb',
                    }}>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                        <input
                          type="text"
                          value={button.text}
                          onChange={(e) => {
                            const newButtons = [...stepFormData.buttons];
                            newButtons[index].text = e.target.value;
                            setStepFormData({ ...stepFormData, buttons: newButtons });
                          }}
                          placeholder="Texto do botão (ex: Sim, Não, Enviar)"
                          style={{
                            flex: 1,
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '5px',
                            fontSize: '13px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newButtons = stepFormData.buttons.filter((_, i) => i !== index);
                            setStepFormData({ ...stepFormData, buttons: newButtons });
                          }}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                        💡 <strong>Como conectar:</strong> Após salvar, arraste uma linha do ponto de conexão (handle) deste nó para o nó destino. 
                        A conexão será rotulada com o texto do botão.
                      </div>
                    </div>
                  ))}
                  
                  {stepFormData.buttons.length === 0 && (
                    <div style={{ 
                      padding: '15px', 
                      backgroundColor: '#fef3c7', 
                      borderRadius: '5px',
                      fontSize: '12px',
                      color: '#92400e',
                    }}>
                      💡 <strong>Dica:</strong> Adicione botões para criar caminhos diferentes. Cada botão pode levar para um nó diferente.
                      <br />
                      <strong>Exemplo:</strong> Botão "Sim" → vai para um nó, Botão "Não" → vai para outro nó.
                    </div>
                  )}
                </div>
              </>
            )}

            {stepFormData.type === 'CONDITION' && (
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Campo</label>
                    <select
                      value={stepFormData.config.condition || 'message.content'}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, condition: e.target.value },
                      })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '5px',
                        fontSize: '12px',
                      }}
                    >
                      <option value="message.content">Conteúdo da Mensagem</option>
                      <option value="context.variable">Variável do Contexto</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Operador</label>
                    <select
                      value={stepFormData.config.operator || 'CONTAINS'}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, operator: e.target.value },
                      })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '5px',
                        fontSize: '12px',
                      }}
                    >
                      <option value="EQUALS">Igual a</option>
                      <option value="CONTAINS">Contém</option>
                      <option value="GREATER_THAN">Maior que</option>
                      <option value="LESS_THAN">Menor que</option>
                      <option value="REGEX">Regex</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Valor</label>
                    <input
                      type="text"
                      value={stepFormData.config.value || ''}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, value: e.target.value },
                      })}
                      placeholder="Ex: preço"
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '5px',
                        fontSize: '12px',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {stepFormData.type === 'DELAY' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Tempo de Espera (ms) *
                </label>
                <input
                  type="number"
                  value={(stepFormData.config && stepFormData.config.delay) || 1000}
                  onChange={(e) => setStepFormData({
                    ...stepFormData,
                    config: { ...stepFormData.config, delay: parseInt(e.target.value) || 1000 },
                  })}
                  min="0"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}

            {stepFormData.type === 'HTTP_REQUEST' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Método HTTP *
                  </label>
                  <select
                    value={(stepFormData.config && stepFormData.config.method) || 'GET'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, method: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    URL *
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.url || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, url: e.target.value },
                    })}
                    placeholder="https://api.exemplo.com/endpoint"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    Você pode usar variáveis: {'{{variavel}}'}
                  </small>
                </div>

                {(stepFormData.config.method === 'POST' || stepFormData.config.method === 'PUT' || stepFormData.config.method === 'PATCH') && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                      Body (JSON)
                    </label>
                    <textarea
                      value={stepFormData.config.body || ''}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, body: e.target.value },
                      })}
                      placeholder='{"key": "value"}'
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '5px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        resize: 'vertical',
                      }}
                    />
                    <small style={{ color: '#6b7280', fontSize: '12px' }}>
                      Você pode usar variáveis: {'{{variavel}}'}
                    </small>
                  </div>
                )}

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Headers (JSON)
                  </label>
                  <textarea
                    value={typeof stepFormData.config.headers === 'string' ? stepFormData.config.headers : JSON.stringify(stepFormData.config.headers || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setStepFormData({
                          ...stepFormData,
                          config: { ...stepFormData.config, headers: parsed },
                        });
                      } catch {
                        // Se não for JSON válido, salvar como string
                        setStepFormData({
                          ...stepFormData,
                          config: { ...stepFormData.config, headers: e.target.value },
                        });
                      }
                    }}
                    placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token"}'
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Variável para Salvar Resposta Completa
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.variableName || 'httpResponse'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, variableName: e.target.value },
                    })}
                    placeholder="httpResponse"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    A resposta completa da API será salva nesta variável (opcional)
                  </small>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                      Mapear Campos para Variáveis
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setStepFormData({
                          ...stepFormData,
                          config: {
                            ...stepFormData.config,
                            fieldMappings: [...(stepFormData.config.fieldMappings || []), { fieldPath: '', variableName: '' }],
                          },
                        });
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      + Adicionar Campo
                    </button>
                  </div>
                  
                  {stepFormData.config.fieldMappings && stepFormData.config.fieldMappings.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {stepFormData.config.fieldMappings.map((mapping: any, index: number) => (
                        <div key={index} style={{ 
                          padding: '10px', 
                          backgroundColor: '#f9fafb', 
                          borderRadius: '5px',
                          border: '1px solid #e5e7eb',
                        }}>
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold' }}>
                                Caminho do Campo
                              </label>
                              <input
                                type="text"
                                value={mapping.fieldPath || ''}
                                onChange={(e) => {
                                  const newMappings = [...(stepFormData.config.fieldMappings || [])];
                                  newMappings[index].fieldPath = e.target.value;
                                  setStepFormData({
                                    ...stepFormData,
                                    config: { ...stepFormData.config, fieldMappings: newMappings },
                                  });
                                }}
                                placeholder="Ex: nome, data.id, items[0].name"
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '5px',
                                  fontSize: '13px',
                                }}
                              />
                              <small style={{ color: '#6b7280', fontSize: '11px' }}>
                                Ex: "nome" para {"{nome: 'João'}"}, "data.id" para {"{data: {id: 123}}"}
                              </small>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold' }}>
                                Nome da Variável
                              </label>
                              <input
                                type="text"
                                value={mapping.variableName || ''}
                                onChange={(e) => {
                                  const newMappings = [...(stepFormData.config.fieldMappings || [])];
                                  newMappings[index].variableName = e.target.value;
                                  setStepFormData({
                                    ...stepFormData,
                                    config: { ...stepFormData.config, fieldMappings: newMappings },
                                  });
                                }}
                                placeholder="Ex: nome, userId"
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '5px',
                                  fontSize: '13px',
                                }}
                              />
                              <small style={{ color: '#6b7280', fontSize: '11px' }}>
                                Use em mensagens: {'{{' + (mapping.variableName || 'variavel') + '}}'}
                              </small>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newMappings = stepFormData.config.fieldMappings.filter((_: any, i: number) => i !== index);
                                setStepFormData({
                                  ...stepFormData,
                                  config: { ...stepFormData.config, fieldMappings: newMappings },
                                });
                              }}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                alignSelf: 'flex-end',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {(!stepFormData.config.fieldMappings || stepFormData.config.fieldMappings.length === 0) && (
                    <div style={{ 
                      padding: '15px', 
                      backgroundColor: '#fef3c7', 
                      borderRadius: '5px',
                      fontSize: '12px',
                      color: '#92400e',
                    }}>
                      💡 <strong>Dica:</strong> Mapeie campos específicos da resposta para variáveis separadas e use-as no bot com a sintaxe de chaves duplas.
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stepFormData.config.showResponse || false}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, showResponse: e.target.checked },
                      })}
                    />
                    <span style={{ fontSize: '14px' }}>Mostrar resposta para o usuário</span>
                  </label>
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    Se marcado, o bot enviará uma mensagem com o resultado da API para o usuário
                  </small>
                </div>

                <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '5px', border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Preview da Resposta</label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!stepFormData.config.url) {
                          alert('Preencha a URL primeiro');
                          return;
                        }
                        try {
                          // Fazer requisição de teste
                          const testResponse = await fetch(stepFormData.config.url, {
                            method: stepFormData.config.method || 'GET',
                            headers: stepFormData.config.headers || {},
                            body: stepFormData.config.body || undefined,
                          });
                          
                          // Ler o body apenas uma vez - sempre ler como texto primeiro
                          const contentType = testResponse.headers.get('content-type') || '';
                          let data: any = null;
                          
                          try {
                            // Sempre ler como texto primeiro (pode ser lido apenas uma vez)
                            const textData = await testResponse.text();
                            
                            // Se o content-type indica JSON, tentar parsear
                            if (contentType.includes('application/json') && textData) {
                              try {
                                data = JSON.parse(textData);
                              } catch (parseError) {
                                // Se falhar ao parsear, usar o texto direto
                                data = textData;
                              }
                            } else {
                              // Se não for JSON, usar o texto direto
                              data = textData || null;
                            }
                          } catch (error) {
                            // Se falhar completamente, data será null
                            data = null;
                            console.error('Erro ao ler resposta:', error);
                          }
                          
                          // Extrair campos disponíveis se for objeto
                          let availableFields: string[] = [];
                          if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                            availableFields = extractFieldsFromObject(data);
                          } else if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                            availableFields = extractFieldsFromObject(data[0]);
                          }
                          
                          // Atualizar preview no form e no nó
                          setStepFormData({
                            ...stepFormData,
                            config: { 
                              ...stepFormData.config, 
                              lastResponse: data,
                              availableFields: availableFields,
                            },
                          });
                          
                          // Atualizar nó visualmente
                          setNodes((nds) =>
                            nds.map((node) =>
                              node.id === editingNode?.id
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      config: { 
                                        ...node.data.config, 
                                        lastResponse: data,
                                        availableFields: availableFields,
                                      },
                                    },
                                  }
                                : node
                            )
                          );
                          
                          alert('Requisição testada com sucesso! Veja o preview abaixo.');
                        } catch (error: any) {
                          alert('Erro ao testar requisição: ' + error.message);
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      🧪 Testar Requisição
                    </button>
                  </div>
                  {stepFormData.config.lastResponse && (
                    <>
                      <div style={{ 
                        marginTop: '10px', 
                        padding: '10px', 
                        backgroundColor: 'white', 
                        borderRadius: '5px',
                        border: '1px solid #e5e7eb',
                        maxHeight: '200px',
                        overflow: 'auto',
                      }}>
                        <pre style={{ 
                          margin: 0, 
                          whiteSpace: 'pre-wrap', 
                          wordBreak: 'break-word',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}>
                          {typeof stepFormData.config.lastResponse === 'object' 
                            ? JSON.stringify(stepFormData.config.lastResponse, null, 2)
                            : String(stepFormData.config.lastResponse)}
                        </pre>
                      </div>
                      
                      {stepFormData.config.availableFields && stepFormData.config.availableFields.length > 0 && (
                        <div style={{ 
                          marginTop: '15px', 
                          padding: '15px', 
                          backgroundColor: '#f0fdf4', 
                          borderRadius: '5px',
                          border: '1px solid #86efac',
                        }}>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '10px', color: '#166534' }}>
                            📋 Campos Disponíveis para Mapear:
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '8px',
                            maxHeight: '150px',
                            overflowY: 'auto',
                          }}>
                            {stepFormData.config.availableFields.map((field: string, index: number) => {
                              const isAlreadyMapped = stepFormData.config.fieldMappings?.some(
                                (m: any) => m.fieldPath === field
                              );
                              return (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    if (!isAlreadyMapped) {
                                      const newMappings = [...(stepFormData.config.fieldMappings || [])];
                                      // Sugerir nome da variável baseado no último segmento do campo
                                      const variableName = field.split('.').pop()?.replace(/\[0\]/g, '') || field;
                                      newMappings.push({ 
                                        fieldPath: field, 
                                        variableName: variableName,
                                      });
                                      setStepFormData({
                                        ...stepFormData,
                                        config: { 
                                          ...stepFormData.config, 
                                          fieldMappings: newMappings,
                                        },
                                      });
                                    }
                                  }}
                                  disabled={isAlreadyMapped}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: isAlreadyMapped ? '#e5e7eb' : '#10b981',
                                    color: isAlreadyMapped ? '#6b7280' : 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: isAlreadyMapped ? 'not-allowed' : 'pointer',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    opacity: isAlreadyMapped ? 0.6 : 1,
                                  }}
                                  title={isAlreadyMapped ? 'Já mapeado' : `Clique para mapear: ${field}`}
                                >
                                  {field} {isAlreadyMapped && '✓'}
                                </button>
                              );
                            })}
                          </div>
                          <small style={{ color: '#166534', fontSize: '11px', display: 'block', marginTop: '8px' }}>
                            💡 Clique nos campos acima para adicioná-los automaticamente ao mapeamento
                          </small>
                        </div>
                      )}
                    </>
                  )}
                  {!stepFormData.config.lastResponse && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                      Clique em "Testar Requisição" para ver o preview da resposta da API e os campos disponíveis
                    </p>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowStepModal(false);
                  setEditingNode(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveStep}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

