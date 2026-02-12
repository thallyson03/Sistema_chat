import { useEffect, useState, useCallback } from 'react';
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
  BackgroundVariant,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import api from '../utils/api';
import { Button } from '../components/ui/Button';
import JourneyNodeConfigModal from '../components/JourneyNodeConfigModal';
import { JourneyCustomNode } from '../components/JourneyCustomNode';

type JourneyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
type JourneyNodeType = 'TRIGGER' | 'ACTION' | 'CONDITION' | 'CONTROL';

interface Journey {
  id: string;
  name: string;
  description?: string | null;
  status: JourneyStatus;
}

interface JourneyNodeDto {
  id: string;
  type: JourneyNodeType;
  label: string;
  config?: any;
  positionX: number;
  positionY: number;
}

interface JourneyEdgeDto {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string | null;
  condition?: any;
}

interface JourneyWithGraph extends Journey {
  nodes: JourneyNodeDto[];
  edges: JourneyEdgeDto[];
}

const defaultViewport = { x: 0, y: 0, zoom: 0.9 };

// Definir nodeTypes fora do componente para evitar recriação
const nodeTypes = {
  journeyNode: JourneyCustomNode,
};

interface JourneyStats {
  totalContacts: number;
  totalExecutions: number;
  completed: number;
  failed: number;
  pending: number;
  totalMessagesSent: number;
  successRate: number;
}

export default function Journeys() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<JourneyWithGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newJourneyName, setNewJourneyName] = useState('');
  const [stats, setStats] = useState<JourneyStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  useEffect(() => {
    fetchJourneys();
  }, []);

  const fetchJourneys = async () => {
    try {
      const response = await api.get('/api/journeys');
      setJourneys(response.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar jornadas:', error);
      alert(error.response?.data?.error || 'Erro ao carregar jornadas');
    } finally {
      setLoading(false);
    }
  };

  const fetchJourneyStats = async (journeyId: string) => {
    setLoadingStats(true);
    try {
      const response = await api.get(`/api/journeys/${journeyId}/stats`);
      setStats(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSelectJourney = async (id: string) => {
    if (!id) {
      setSelectedJourney(null);
      setNodes([]);
      setEdges([]);
      return;
    }

    try {
      const response = await api.get(`/api/journeys/${id}`);
      const journey: JourneyWithGraph = response.data;
      
      console.log('[Journeys] Jornada carregada da API:', {
        id: journey.id,
        name: journey.name,
        nodesCount: journey.nodes?.length || 0,
        edgesCount: journey.edges?.length || 0,
        nodes: journey.nodes,
      });
      
      setSelectedJourney(journey);
      
      // Carregar estatísticas se a jornada estiver ativa
      if (journey.status === 'ACTIVE') {
        await fetchJourneyStats(id);
      } else {
        setStats(null);
      }

      if (!journey.nodes || journey.nodes.length === 0) {
        console.warn('[Journeys] Jornada não tem nós!');
        setNodes([]);
        setEdges([]);
        return;
      }

      const rfNodes: Node[] = journey.nodes.map((n) => {
        // Garantir que config seja sempre um objeto
        let config: any = n.config;
        
        // Se config for null ou undefined, usar objeto vazio
        if (!config) {
          config = {};
        }
        // Se for string, fazer parse
        else if (typeof config === 'string') {
          try {
            // Se for string vazia ou '{}', usar objeto vazio
            if (config.trim() === '' || config.trim() === '{}') {
              config = {};
            } else {
              config = JSON.parse(config);
            }
          } catch (e) {
            console.warn(`[Journeys] Erro ao parsear config do nó ${n.id}:`, e, 'Config original:', config);
            config = {};
          }
        }
        // Se já for objeto, fazer uma cópia limpa
        else if (typeof config === 'object') {
          try {
            config = JSON.parse(JSON.stringify(config));
          } catch (e) {
            console.warn(`[Journeys] Erro ao serializar config do nó ${n.id}:`, e);
            config = {};
          }
        }
        
        // Log para debug - especialmente para ACTION nodes
        if (n.type === 'ACTION') {
          console.log(`[Journeys] Carregando nó ACTION ${n.id}:`, {
            label: n.label,
            configOriginal: n.config,
            configOriginalType: typeof n.config,
            configProcessed: config,
            configProcessedType: typeof config,
            hasMessage: !!(config as any)?.message,
            message: (config as any)?.message,
            channelId: (config as any)?.channelId,
            configString: JSON.stringify(config, null, 2),
          });
        }
        
        return {
          id: n.id,
          data: { 
            label: n.label, 
            type: n.type,
            config: config || {}, // Garantir que sempre seja um objeto
          },
          position: { x: n.positionX, y: n.positionY },
          type: 'journeyNode', // Usar nosso nó customizado
        };
      });
      
      console.log('[Journeys] Total de nós carregados:', rfNodes.length);

      const rfEdges: Edge[] = journey.edges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        label: e.label || '',
      }));

      console.log('[Journeys] Nós processados:', {
        count: rfNodes.length,
        nodes: rfNodes.map(n => ({
          id: n.id,
          type: (n.data as any)?.type,
          label: (n.data as any)?.label,
          hasConfig: !!(n.data as any)?.config,
          configKeys: (n.data as any)?.config ? Object.keys((n.data as any).config) : [],
          message: (n.data as any)?.config?.message,
        })),
      });
      
      setNodes(rfNodes);
      setEdges(rfEdges);
      
      console.log('[Journeys] Nós e edges definidos no estado. Total:', rfNodes.length);
    } catch (error: any) {
      console.error('Erro ao carregar jornada:', error);
      console.error('Detalhes do erro:', error.response?.data);
      alert(error.response?.data?.error || 'Erro ao carregar jornada');
    }
  };

  const handleCreateJourney = async () => {
    if (!newJourneyName.trim()) {
      alert('Informe um nome para a jornada');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/api/journeys', {
        name: newJourneyName.trim(),
      });
      const created: Journey = response.data;
      setNewJourneyName('');
      await fetchJourneys();
      await handleSelectJourney(created.id);
    } catch (error: any) {
      console.error('Erro ao criar jornada:', error);
      alert(error.response?.data?.error || 'Erro ao criar jornada');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteJourney = async (journeyId: string, journeyName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a jornada "${journeyName}"?\n\nEsta ação não pode ser desfeita e todos os blocos e configurações serão perdidos.`)) {
      return;
    }

    try {
      await api.delete(`/api/journeys/${journeyId}`);
      
      // Se a jornada deletada estava selecionada, limpar seleção
      if (selectedJourney?.id === journeyId) {
        setSelectedJourney(null);
        setNodes([]);
        setEdges([]);
        setStats(null);
      }
      
      await fetchJourneys();
      alert('Jornada excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir jornada:', error);
      alert(error.response?.data?.error || 'Erro ao excluir jornada');
    }
  };

  const onConnect = useCallback(
    (params: Edge | Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const addNode = (type: JourneyNodeType) => {
    if (!selectedJourney) {
      alert('Selecione ou crie uma jornada primeiro.');
      return;
    }

    const id = `node_${Date.now()}`;
    const label =
      type === 'TRIGGER'
        ? 'Trigger: Novo contato'
        : type === 'ACTION'
        ? 'Ação: Enviar mensagem WhatsApp'
        : type === 'CONDITION'
        ? 'Condição'
        : 'Controle';

    const position = {
      x: 200 + nodes.length * 40,
      y: 150 + nodes.length * 20,
    };

    const newNode: Node = {
      id,
      data: { label, type, config: {} },
      position,
      type: 'journeyNode', // Usar nosso nó customizado
    };

    setNodes((nds) => nds.concat(newNode));
    // Abrir modal de configuração imediatamente após criar
    setEditingNode(newNode);
  };

  const handleNodeClick: NodeMouseHandler = (event, node) => {
    setEditingNode(node);
  };

  const handleSaveNodeConfig = (config: any, label: string) => {
    if (!editingNode) return;

    console.log('[Journeys] Salvando config do nó:', {
      nodeId: editingNode.id,
      label,
      config: JSON.stringify(config, null, 2),
    });

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === editingNode.id) {
          const updatedNode = { 
            ...n, 
            data: { 
              ...n.data, 
              label, 
              config: config || {} // Garantir que config seja sempre um objeto
            } 
          };
          console.log('[Journeys] Nó atualizado:', {
            id: updatedNode.id,
            data: updatedNode.data,
          });
          return updatedNode;
        }
        return n;
      })
    );
    setEditingNode(null);
  };

  const handleNodesDelete = useCallback((deleted: Node[]) => {
    // Remover edges conectadas aos nós deletados
    setEdges((eds) =>
      eds.filter(
        (edge) =>
          !deleted.find((node) => node.id === edge.source || node.id === edge.target)
      )
    );
  }, [setEdges]);

  const handleSaveGraph = async () => {
    if (!selectedJourney) {
      alert('Selecione uma jornada para salvar.');
      return;
    }

    setSaving(true);
    try {
      const graphPayload = {
        nodes: nodes.map((n) => {
          const nodeData = n.data as any;
          let nodeConfig = nodeData?.config || {};
          
          // Garantir que config seja um objeto puro (serializar e deserializar para limpar)
          if (nodeConfig && typeof nodeConfig === 'object') {
            try {
              nodeConfig = JSON.parse(JSON.stringify(nodeConfig));
            } catch (e) {
              console.warn(`[Journeys] Erro ao serializar config do nó ${n.id}:`, e);
              nodeConfig = {};
            }
          }
          
          // Log para debug
          if (nodeData?.type === 'ACTION') {
            console.log(`[Journeys] Salvando nó ${n.id} (${nodeData?.type}):`, {
              label: nodeData?.label,
              hasConfig: !!nodeConfig,
              hasMessage: !!(nodeConfig as any)?.message,
              message: (nodeConfig as any)?.message,
              channelId: (nodeConfig as any)?.channelId,
              configString: JSON.stringify(nodeConfig, null, 2),
            });
          }
          
          return {
            id: n.id,
            type: nodeData?.type || 'ACTION',
            label: nodeData?.label || n.id,
            config: nodeConfig, // Garantir que config seja um objeto
            positionX: n.position.x,
            positionY: n.position.y,
          };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          sourceNodeId: e.source,
          targetNodeId: e.target,
          label: (e.label as string) || null,
          condition: {}, // futuro: condições de saída
        })),
      };

      console.log('[Journeys] Salvando grafo:', JSON.stringify(graphPayload, null, 2));
      
      // Verificar se há nós ACTION com mensagem antes de salvar
      const actionNodesWithMessage = graphPayload.nodes.filter(
        (n: any) => n.type === 'ACTION' && n.config?.message
      );
      console.log(`[Journeys] Salvando ${actionNodesWithMessage.length} nós ACTION com mensagem`);
      
      await api.put(`/api/journeys/${selectedJourney.id}/graph`, graphPayload);
      
      // Aguardar um pouco para garantir que o banco processou
      await new Promise(resolve => setTimeout(resolve, 500));
      
      alert('Jornada salva com sucesso!');
      
      // Recarregar a jornada para garantir que está sincronizada
      await handleSelectJourney(selectedJourney.id);
    } catch (error: any) {
      console.error('Erro ao salvar jornada:', error);
      alert(error.response?.data?.error || 'Erro ao salvar jornada');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Carregando jornadas...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-50">
      {/* Lateral esquerda: lista de jornadas e ações */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Jornadas</h1>
          <p className="text-xs text-gray-500">Crie fluxos automatizados de atendimento</p>
        </div>

        <div className="p-4 border-b border-gray-200">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Nova jornada</label>
          <input
            type="text"
            value={newJourneyName}
            onChange={(e) => setNewJourneyName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mb-2 text-sm"
            placeholder="Ex: Boas-vindas WhatsApp"
          />
          <Button
            variant="primary"
            onClick={handleCreateJourney}
            disabled={creating || !newJourneyName.trim()}
            className="w-full"
          >
            {creating ? 'Criando...' : 'Criar jornada'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {journeys.length === 0 && (
            <p className="text-xs text-gray-500">Nenhuma jornada criada ainda.</p>
          )}
          {journeys.map((j) => (
            <div
              key={j.id}
              className={`w-full rounded border text-sm mb-1 ${
                selectedJourney?.id === j.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <button
                onClick={() => handleSelectJourney(j.id)}
                className="w-full text-left px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold truncate flex-1">{j.name}</div>
                  <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-semibold ${
                    j.status === 'ACTIVE' 
                      ? 'bg-green-100 text-green-700' 
                      : j.status === 'PAUSED'
                      ? 'bg-yellow-100 text-yellow-700'
                      : j.status === 'ARCHIVED'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {j.status === 'ACTIVE' ? '✓ Ativa' : 
                     j.status === 'PAUSED' ? '⏸ Pausada' :
                     j.status === 'ARCHIVED' ? '📦 Arquivada' : '📝 Rascunho'}
                  </span>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteJourney(j.id, j.name);
                }}
                className="w-full px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded-b flex items-center justify-center gap-1"
                title="Excluir jornada"
              >
                🗑️ Excluir
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Centro: canvas da jornada */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onNodesDelete={handleNodesDelete}
            fitView
            defaultViewport={defaultViewport}
            nodeTypes={nodeTypes}
            deleteKeyCode="Delete"
          >
            <MiniMap />
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
        </div>

        {/* Barra superior do canvas */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
          <div className="pointer-events-auto bg-white/95 backdrop-blur px-4 py-3 rounded-lg shadow-lg border border-gray-200">
            {selectedJourney ? (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">
                      {selectedJourney.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedJourney.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-700 border border-green-300' 
                        : selectedJourney.status === 'PAUSED'
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                        : selectedJourney.status === 'ARCHIVED'
                        ? 'bg-gray-100 text-gray-700 border border-gray-300'
                        : 'bg-blue-100 text-blue-700 border border-blue-300'
                    }`}>
                      {selectedJourney.status === 'ACTIVE' ? '🟢 ATIVA' : 
                       selectedJourney.status === 'PAUSED' ? '🟡 PAUSADA' :
                       selectedJourney.status === 'ARCHIVED' ? '⚫ ARQUIVADA' : '🔵 RASCUNHO'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 flex items-center gap-3">
                    <span>📊 {nodes.length} blocos</span>
                    <span>🔗 {edges.length} conexões</span>
                    {selectedJourney.status === 'ACTIVE' && (
                      <span className="text-green-600 font-semibold">✓ Funcionando</span>
                    )}
                  </div>
                  
                  {/* Estatísticas */}
                  {stats && selectedJourney.status === 'ACTIVE' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs font-semibold text-gray-700 mb-2">📈 Estatísticas</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Enviados:</span>
                          <span className="ml-1 font-semibold text-blue-600">
                            {stats.completed} de {stats.totalContacts}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Taxa de sucesso:</span>
                          <span className="ml-1 font-semibold text-green-600">
                            {stats.successRate.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Mensagens:</span>
                          <span className="ml-1 font-semibold">{stats.totalMessagesSent}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Falhas:</span>
                          <span className="ml-1 font-semibold text-red-600">{stats.failed}</span>
                        </div>
                      </div>
                      {stats.totalContacts > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all"
                              style={{ width: `${(stats.completed / stats.totalContacts) * 100}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            {stats.completed} de {stats.totalContacts} contatos processados
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedJourney.status !== 'ACTIVE' && nodes.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      try {
                        await api.put(`/api/journeys/${selectedJourney.id}`, { status: 'ACTIVE' });
                        await handleSelectJourney(selectedJourney.id);
                        alert('Jornada ativada! Ela começará a funcionar automaticamente.');
                      } catch (error: any) {
                        alert(error.response?.data?.error || 'Erro ao ativar jornada');
                      }
                    }}
                  >
                    Ativar Jornada
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                Selecione ou crie uma jornada para começar a montar o fluxo.
              </div>
            )}
          </div>

          <div className="flex gap-2 pointer-events-auto">
            {selectedJourney && selectedJourney.status === 'ACTIVE' && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-green-600 text-sm font-semibold">✓ Jornada Ativa</span>
                <span className="text-green-500 text-xs">Funcionando automaticamente</span>
              </div>
            )}
            <Button
              variant="primary"
              onClick={handleSaveGraph}
              disabled={!selectedJourney || saving}
            >
              {saving ? 'Salvando...' : 'Salvar jornada'}
            </Button>
          </div>
        </div>

        {/* Paleta lateral direita */}
        <div className="absolute top-16 right-4 w-80 bg-white/95 backdrop-blur rounded-lg shadow-xl p-4 pointer-events-auto max-h-[85vh] overflow-y-auto border border-gray-200">
          <h2 className="text-base font-bold text-gray-800 mb-2">Blocos</h2>
          <p className="text-xs text-gray-500 mb-4 pb-3 border-b border-gray-200">
            💡 Arraste ou clique para adicionar
          </p>

          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">TRIGGERS</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => addNode('TRIGGER')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-all hover:scale-105 hover:shadow-md"
                title="Contato entra na jornada"
              >
                <span className="text-lg mb-1">➕</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Entra</span>
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">ACTIONS</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => addNode('ACTION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all hover:scale-105 hover:shadow-md"
                title="Enviar mensagem WhatsApp"
              >
                <span className="text-lg mb-1">💬</span>
                <span className="text-[10px] font-semibold text-center leading-tight">WhatsApp</span>
              </button>
              <button
                onClick={() => addNode('ACTION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all hover:scale-105 hover:shadow-md"
                title="Enviar email"
              >
                <span className="text-lg mb-1">📧</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Email</span>
              </button>
              <button
                onClick={() => addNode('ACTION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all hover:scale-105 hover:shadow-md"
                title="Adicionar tag"
              >
                <span className="text-lg mb-1">🏷️</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Tag +</span>
              </button>
              <button
                onClick={() => addNode('ACTION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all hover:scale-105 hover:shadow-md"
                title="Remover tag"
              >
                <span className="text-lg mb-1">➖</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Tag -</span>
              </button>
              <button
                onClick={() => addNode('ACTION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all hover:scale-105 hover:shadow-md"
                title="Atualizar campo do contato"
              >
                <span className="text-lg mb-1">📝</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Campo</span>
              </button>
              <button
                onClick={() => addNode('ACTION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all hover:scale-105 hover:shadow-md"
                title="Adicionar à lista"
              >
                <span className="text-lg mb-1">📋</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Lista +</span>
              </button>
              <button
                onClick={() => addNode('ACTION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all hover:scale-105 hover:shadow-md"
                title="Criar ticket"
              >
                <span className="text-lg mb-1">🎫</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Ticket</span>
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">CONDITIONS</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => addNode('CONDITION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 transition-all hover:scale-105 hover:shadow-md"
                title="Se / então"
              >
                <span className="text-lg mb-1">🔀</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Se/Então</span>
              </button>
              <button
                onClick={() => addNode('CONDITION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 transition-all hover:scale-105 hover:shadow-md"
                title="Tem tag"
              >
                <span className="text-lg mb-1">🏷️</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Tag</span>
              </button>
              <button
                onClick={() => addNode('CONDITION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 transition-all hover:scale-105 hover:shadow-md"
                title="Campo do contato"
              >
                <span className="text-lg mb-1">📊</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Campo</span>
              </button>
              <button
                onClick={() => addNode('CONDITION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 transition-all hover:scale-105 hover:shadow-md"
                title="Data/Hora"
              >
                <span className="text-lg mb-1">📅</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Data</span>
              </button>
              <button
                onClick={() => addNode('CONDITION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 transition-all hover:scale-105 hover:shadow-md"
                title="Recebeu mensagem"
              >
                <span className="text-lg mb-1">💬</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Mensagem</span>
              </button>
              <button
                onClick={() => addNode('CONDITION')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 transition-all hover:scale-105 hover:shadow-md"
                title="Está na lista"
              >
                <span className="text-lg mb-1">📋</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Lista</span>
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">CONTROLS</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => addNode('CONTROL')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-all hover:scale-105 hover:shadow-md"
                title="Esperar (delay)"
              >
                <span className="text-lg mb-1">⏱️</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Esperar</span>
              </button>
              <button
                onClick={() => addNode('CONTROL')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-all hover:scale-105 hover:shadow-md"
                title="Dividir tráfego (A/B)"
              >
                <span className="text-lg mb-1">🔀</span>
                <span className="text-[10px] font-semibold text-center leading-tight">A/B</span>
              </button>
              <button
                onClick={() => addNode('CONTROL')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-all hover:scale-105 hover:shadow-md"
                title="Aguardar evento"
              >
                <span className="text-lg mb-1">⏳</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Evento</span>
              </button>
              <button
                onClick={() => addNode('CONTROL')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-all hover:scale-105 hover:shadow-md"
                title="Loop / Repetir"
              >
                <span className="text-lg mb-1">🔁</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Loop</span>
              </button>
              <button
                onClick={() => addNode('CONTROL')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-all hover:scale-105 hover:shadow-md"
                title="Parar jornada"
              >
                <span className="text-lg mb-1">🛑</span>
                <span className="text-[10px] font-semibold text-center leading-tight">Parar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de configuração do nó */}
      {editingNode && (
        <JourneyNodeConfigModal
          isOpen={!!editingNode}
          onClose={() => setEditingNode(null)}
          nodeId={editingNode.id}
          nodeType={(editingNode.data as any)?.type || 'ACTION'}
          nodeLabel={(editingNode.data as any)?.label || ''}
          nodeConfig={(editingNode.data as any)?.config || {}}
          onSave={handleSaveNodeConfig}
        />
      )}
    </div>
  );
}


