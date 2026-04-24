import { useEffect, useState, useCallback, useRef } from 'react';
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
import { useConfirm } from '../components/ui/ConfirmProvider';

interface Flow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  steps: FlowStep[];
}

interface BotMeta {
  id: string;
  name: string;
  publishedVersion?: string;
  hasPendingChanges?: boolean;
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

interface UserOption {
  id: string;
  name: string;
  email?: string;
}

const getNodeCardStyle = (
  selected: boolean,
  accent: string,
  minWidth = '180px',
  maxWidth = '210px',
) => ({
  background: 'linear-gradient(180deg, #1a2027 0%, #171c22 100%)',
  color: '#e5e7eb',
  borderRadius: '12px',
  minWidth,
  maxWidth,
  boxShadow: selected
    ? `0 0 0 1px ${accent}, 0 14px 28px rgba(0, 0, 0, 0.45)`
    : '0 10px 22px rgba(0,0,0,0.34)',
  border: selected ? `1px solid ${accent}` : '1px solid #2a3340',
  position: 'relative' as const,
  overflow: 'hidden' as const,
});

const nodeHeaderStyle = {
  padding: '9px 10px',
  borderBottom: '1px solid #2d3748',
  fontWeight: 700,
  fontSize: '11px',
  letterSpacing: '0.6px',
  textTransform: 'uppercase' as const,
  color: '#d1d5db',
};

const nodeBodyBoxStyle = {
  fontSize: '12px',
  color: '#e5e7eb',
  marginTop: '8px',
  backgroundColor: '#0f1419',
  border: '1px solid #293241',
  borderRadius: '6px',
  padding: '8px 9px',
  minHeight: '16px',
};

const renderNodeHeader = (label: string, icon: string, iconColor: string) => (
  <div style={{ ...nodeHeaderStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
    <span className="material-symbols-rounded" style={{ fontSize: '13px', color: iconColor }}>
      {icon}
    </span>
    <span>{label}</span>
  </div>
);

const getDeleteButtonStyle = (bg = '#ef4444') => ({
  position: 'absolute' as const,
  top: '5px',
  right: '5px',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  backgroundColor: bg,
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  fontWeight: 'bold',
  zIndex: 10,
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
});

const getHandleStyle = (accent: string) => ({
  background: accent,
  width: '14px',
  height: '14px',
  border: '2px solid #0f172a',
});

// Componente de nó customizado para mensagem
const MessageNode = ({ data, selected, id }: any) => {
  const accent = '#22c55e';
  const buttons = data.buttons || [];
  
  return (
    <div
      style={getNodeCardStyle(selected, accent, '250px', '300px')}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={getDeleteButtonStyle()}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Mensagem', 'chat', '#22c55e')}
      <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '12px', lineHeight: 1.35, color: '#e5e7eb', marginBottom: buttons.length > 0 ? '10px' : '0', backgroundColor: '#0f1419', border: '1px solid #293241', borderRadius: '6px', padding: '8px 9px' }}>
        {data.content ? (data.content.length > 50 ? data.content.substring(0, 50) + '...' : data.content) : 'Nova mensagem'}
      </div>
      {buttons.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {buttons.map((btn: any, idx: number) => (
            <div
              key={idx}
              style={{
                padding: '8px 10px',
                backgroundColor: idx === 0 ? 'rgba(34, 197, 94, 0.15)' : '#0f1419',
                borderRadius: '6px',
                fontSize: '11px',
                textAlign: 'left',
                border: idx === 0 ? '1px solid #22c55e' : '1px solid #2d3748',
                color: idx === 0 ? '#86efac' : '#cbd5e1',
              }}
            >
              {btn.text || `Botão ${idx + 1}`}
            </div>
          ))}
        </div>
      )}
      </div>
      {buttons.length > 0 ? (
        buttons.map((btn: any, idx: number) => (
          <Handle
            key={`btn-handle-${idx}`}
            type="source"
            position={Position.Right}
            id={`btn-${idx}`}
            style={{
              ...getHandleStyle(accent),
              top: `${58 + idx * 16}%`,
            }}
          />
        ))
      ) : (
        <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
      )}
    </div>
  );
};

// Componente de nó customizado para condição
const ConditionNode = ({ data, selected, id }: any) => {
  const accent = '#f59e0b';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={getDeleteButtonStyle()}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Condição', 'alt_route', '#f59e0b')}
      <div style={{ padding: '10px 10px', fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>
        {data.conditionsList?.length > 0
          ? data.conditionsList.length === 1
            ? `${data.condition || 'message.content'} ${data.operator || ''} ${data.value || '?'}`
            : `${data.conditionsList.length} condições (${data.logicOperator === 'OR' ? 'OU' : 'E'})`
          : data.condition
            ? `${data.condition} ${data.operator} ${data.value}`
            : 'Nova condição'}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <div style={{
          flex: 1,
          padding: '6px',
          backgroundColor: '#0f1419',
          borderRadius: '5px',
          fontSize: '11px',
          textAlign: 'center',
          border: '1px solid #2d3748',
        }}>
          Sim
        </div>
        <div style={{
          flex: 1,
          padding: '6px',
          backgroundColor: '#0f1419',
          borderRadius: '5px',
          fontSize: '11px',
          textAlign: 'center',
          border: '1px solid #2d3748',
        }}>
          Não
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="true" style={{ ...getHandleStyle('#10b981'), top: '30%' }} />
      <Handle type="source" position={Position.Right} id="false" style={{ ...getHandleStyle('#ef4444'), top: '70%' }} />
    </div>
  );
};

// Componente de nó customizado para handoff
const HandoffNode = ({ data, selected, id }: any) => {
  const accent = '#ef4444';
  return (
    <div
      style={{ ...getNodeCardStyle(selected, accent, '170px', '220px'), textAlign: 'center' }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={getDeleteButtonStyle('#dc2626')}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Handoff', 'support_agent', '#ef4444')}
      <div style={{ padding: '10px 10px', fontSize: '12px', color: '#cbd5e1', textTransform: 'uppercase', lineHeight: 1.35 }}>Transferir para humano</div>
    </div>
  );
};

// Componente de nó customizado para mover lead (deal) em pipelines
const MoveDealNode = ({ data, selected, id }: any) => {
  const accent = '#0f766e';
  const pipelineName = data.config?.pipelineName || 'Funil atual';
  const stageName = data.config?.stageName || 'Mesma etapa';

  return (
    <div
      style={getNodeCardStyle(selected, accent, '220px', '260px')}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={getDeleteButtonStyle()}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle
        type="target"
        position={Position.Left}
        style={getHandleStyle(accent)}
      />
      {renderNodeHeader('Mover Lead', 'move_up', '#0f766e')}
      <div style={{ padding: '12px', fontSize: '12px', color: '#cbd5e1' }}>
        <div>Funil: {pipelineName}</div>
        <div>Coluna: {stageName}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={getHandleStyle(accent)}
      />
    </div>
  );
};

// Componente de nó customizado para delay
const DelayNode = ({ data, selected, id }: any) => {
  const accent = '#6b7280';
  return (
    <div
      style={{ ...getNodeCardStyle(selected, accent, '170px', '230px'), textAlign: 'center' }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={getDeleteButtonStyle()}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #2d3748', fontWeight: 700, fontSize: '14px', color: '#d1d5db' }}>⏱️ Delay</div>
      <div style={{ padding: '12px', fontSize: '12px', color: '#cbd5e1' }}>
        {data.delay ? `${data.delay}ms` : 'Tempo'}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para input
const InputNode = ({ data, selected, id }: any) => {
  const accent = '#10b981';
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
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={getDeleteButtonStyle()}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #2d3748', fontWeight: 700, fontSize: '14px', color: '#d1d5db' }}>
        {icons[inputType] || '📝'} Input: {inputType}
      </div>
      <div style={{ padding: '12px', fontSize: '12px', color: '#cbd5e1', marginBottom: '5px' }}>
        {data.config?.placeholder || 'Aguardando resposta...'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para set variable
const SetVariableNode = ({ data, selected, id }: any) => {
  const accent = '#8b5cf6';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={getDeleteButtonStyle()}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Definir Variável', 'tune', '#8b5cf6')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px' }}>
        {data.config?.variableName ? `{{${data.config.variableName}}}` : 'Nova variável'}
      </div>
      {data.config?.value && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          = {String(data.config.value).length > 30 ? String(data.config.value).substring(0, 30) + '...' : data.config.value}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para HTTP Request
const HTTPRequestNode = ({ data, selected, id }: any) => {
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
  const accent = methodColors[method] || '#6b7280';
  
  return (
    <div
      style={getNodeCardStyle(selected, accent, '220px', '350px')}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={getDeleteButtonStyle()}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader(`HTTP ${method}`, 'language', accent)}
      <div style={{ padding: '10px 10px' }}>
      <div style={{ ...nodeBodyBoxStyle, wordBreak: 'break-word' as const }}>
        {url ? (url.length > 40 ? url.substring(0, 40) + '...' : url) : 'Nova requisição'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '10px', opacity: 0.8, fontStyle: 'italic', marginTop: '6px' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      {response && (
        <div style={{ 
          marginTop: '10px', 
          padding: '8px', 
          backgroundColor: '#0f1419', 
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
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Image
const ImageNode = ({ data, selected, id }: any) => {
  const accent = '#ec4899';
  const imageSrc = String(data.config?.imageUrl || data.mediaUrl || '').trim();
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Imagem', 'image', '#ec4899')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px', padding: '0', overflow: 'hidden' }}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={data.config?.altText || 'Imagem do bloco'}
            style={{ width: '100%', height: '72px', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ padding: '8px 9px', color: '#9ca3af' }}>Nova imagem</div>
        )}
      </div>
      {data.config?.altText && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          Alt: {data.config.altText}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Video
const VideoNode = ({ data, selected, id }: any) => {
  const accent = '#dc2626';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#991b1b',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Vídeo', 'videocam', '#dc2626')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px', wordBreak: 'break-word' as const }}>
        {data.config?.videoUrl ? (data.config.videoUrl.length > 40 ? data.config.videoUrl.substring(0, 40) + '...' : data.config.videoUrl) : 'Novo vídeo'}
      </div>
      {data.config?.platform && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Plataforma: {data.config.platform}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Audio
const AudioNode = ({ data, selected, id }: any) => {
  const accent = '#7c3aed';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Áudio', 'graphic_eq', '#7c3aed')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px', wordBreak: 'break-word' as const }}>
        {data.config?.audioUrl ? (data.config.audioUrl.length > 40 ? data.config.audioUrl.substring(0, 40) + '...' : data.config.audioUrl) : 'Novo áudio'}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Embed
const EmbedNode = ({ data, selected, id }: any) => {
  const accent = '#059669';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Embed', 'code', '#059669')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px', wordBreak: 'break-word' as const }}>
        {data.config?.embedUrl ? (data.config.embedUrl.length > 40 ? data.config.embedUrl.substring(0, 40) + '...' : data.config.embedUrl) : 'Novo embed'}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Email Input
const EmailInputNode = ({ data, selected, id }: any) => {
  const accent = '#f59e0b';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Email', 'mail', '#f59e0b')}
      <div style={{ padding: '10px 10px' }}>
      <div style={nodeBodyBoxStyle}>
        {data.config?.placeholder || 'Digite seu email...'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '10px', opacity: 0.8, fontStyle: 'italic', marginTop: '6px' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Number Input
const NumberInputNode = ({ data, selected, id }: any) => {
  const accent = '#06b6d4';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Número', 'tag', '#06b6d4')}
      <div style={{ padding: '10px 10px' }}>
      <div style={nodeBodyBoxStyle}>
        {data.config?.placeholder || 'Digite um número...'}
      </div>
      {data.config?.min !== undefined && data.config?.max !== undefined && (
        <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '6px' }}>
          Min: {data.config.min} | Max: {data.config.max}
        </div>
      )}
      {data.config?.variableName && (
        <div style={{ fontSize: '10px', opacity: 0.8, fontStyle: 'italic', marginTop: '6px' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Phone Input
const PhoneInputNode = ({ data, selected, id }: any) => {
  const accent = '#14b8a6';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Telefone', 'call', '#14b8a6')}
      <div style={{ padding: '10px 10px' }}>
      <div style={nodeBodyBoxStyle}>
        {data.config?.placeholder || 'Digite seu telefone...'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '10px', opacity: 0.8, fontStyle: 'italic', marginTop: '6px' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Date Input
const DateInputNode = ({ data, selected, id }: any) => {
  const accent = '#a855f7';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Data', 'calendar_month', '#a855f7')}
      <div style={{ padding: '10px 10px' }}>
      <div style={nodeBodyBoxStyle}>
        {data.config?.label || 'Selecione uma data...'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '10px', opacity: 0.8, fontStyle: 'italic', marginTop: '6px' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para File Upload
const FileUploadNode = ({ data, selected, id }: any) => {
  const accent = '#f97316';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Upload', 'upload_file', '#f97316')}
      <div style={{ padding: '10px 10px' }}>
      <div style={nodeBodyBoxStyle}>
        {data.config?.accept ? `Tipos: ${data.config.accept}` : 'Enviar arquivo...'}
      </div>
      {data.config?.maxSize && (
        <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '6px' }}>
          Tamanho máx: {data.config.maxSize}MB
        </div>
      )}
      {data.config?.variableName && (
        <div style={{ fontSize: '10px', opacity: 0.8, fontStyle: 'italic', marginTop: '6px' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para Redirect
const RedirectNode = ({ data, selected, id }: any) => {
  const accent = '#6366f1';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle(accent)} />
      {renderNodeHeader('Redirecionar', 'open_in_new', '#6366f1')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px', wordBreak: 'break-word' as const }}>
        {data.config?.url ? (data.config.url.length > 40 ? data.config.url.substring(0, 40) + '...' : data.config.url) : 'Nova URL'}
      </div>
      {data.config?.openInNewTab && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Nova aba
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={getHandleStyle(accent)}
      />
    </div>
  );
};

// Componente de nó customizado para Script
const ScriptNode = ({ data, selected, id }: any) => {
  const accent = '#1e293b';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#475569')} />
      {renderNodeHeader('Script', 'terminal', '#475569')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px' }}>
        {data.config?.code ? (data.config.code.length > 30 ? data.config.code.substring(0, 30) + '...' : data.config.code) : 'Código JavaScript'}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle('#475569')} />
    </div>
  );
};

// Componente de nó customizado para Wait (diferente de Delay)
const WaitNode = ({ data, selected, id }: any) => {
  const accent = '#64748b';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#94a3b8')} />
      {renderNodeHeader('Aguardar', 'hourglass_top', '#94a3b8')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px' }}>
        {data.config?.waitFor ? data.config.waitFor : 'Aguardando evento...'}
      </div>
      {data.config?.message && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          {data.config.message}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={getHandleStyle('#94a3b8')} />
    </div>
  );
};

// Componente de nó customizado para Typebot Link
const TypebotLinkNode = ({ data, selected, id }: any) => {
  const accent = '#0ea5e9';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#38bdf8')} />
      {renderNodeHeader('Link Bot', 'link', '#38bdf8')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px' }}>
        {data.config?.botId ? `Bot: ${data.config.botId}` : 'Selecione um bot...'}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle('#38bdf8')} />
    </div>
  );
};

// Componente de nó customizado para AB Test
const ABTestNode = ({ data, selected, id }: any) => {
  const accent = '#9333ea';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#a855f7')} />
      {renderNodeHeader('Teste A/B', 'science', '#a855f7')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px' }}>
        {data.config?.variants ? `${data.config.variants.length} variante(s)` : '2 variantes'}
      </div>
      {data.config?.splitPercent && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Split: {data.config.splitPercent}% / {100 - data.config.splitPercent}%
        </div>
      )}
      <Handle type="source" position={Position.Right} id="variantA" style={{ ...getHandleStyle('#10b981'), top: '30%' }} />
      <Handle type="source" position={Position.Right} id="variantB" style={{ ...getHandleStyle('#3b82f6'), top: '70%' }} />
    </div>
  );
};

// Componente de nó customizado para Jump
const JumpNode = ({ data, selected, id }: any) => {
  const accent = '#eab308';
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#facc15')} />
      {renderNodeHeader('Pular', 'redo', '#facc15')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px' }}>
        {data.config?.targetStepId ? `Para: ${data.config.targetStepId.substring(0, 20)}...` : 'Selecione destino...'}
      </div>
    </div>
  );
};

// Componente de nó customizado para Picture Choice
const PictureChoiceNode = ({ data, selected, id }: any) => {
  const accent = '#be185d';
  const choices = data.config?.choices || [];
  return (
    <div
      style={getNodeCardStyle(selected, accent)}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onRequestDelete) {
              data.onRequestDelete(id);
              return;
            }
            data.onDelete(id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Excluir bloco"
        >
          ×
        </button>
      )}
      <Handle type="target" position={Position.Left} style={getHandleStyle('#ec4899')} />
      {renderNodeHeader('Escolha com Imagem', 'photo_library', '#ec4899')}
      <div style={{ ...nodeBodyBoxStyle, margin: '10px' }}>
        {choices.length > 0 ? `${choices.length} opção(ões)` : 'Nenhuma opção'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={getHandleStyle('#ec4899')} />
    </div>
  );
};

// Componente de nó customizado para início
const StartNode = ({ data }: any) => {
  const accent = '#22c55e';
  return (
    <div
      style={{
        ...getNodeCardStyle(false, accent, '250px', '300px'),
        position: 'relative',
      }}
    >
      {renderNodeHeader('Início do Fluxo', 'flag', '#4ade80')}
      <div style={{ padding: '10px 12px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.35 }}>
        {data?.description || 'Quando o usuário inicia a conversa pela primeira vez.'}
      </div>
      <Handle type="source" position={Position.Right} style={getHandleStyle(accent)} />
    </div>
  );
};

// Componente de nó customizado para fim
const EndNode = ({ data }: any) => {
  const accent = '#ef4444';
  return (
    <div
      style={{
        ...getNodeCardStyle(false, accent, '170px', '220px'),
        textAlign: 'center',
        fontWeight: 'bold',
        position: 'relative',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={true}
        style={{ 
          ...getHandleStyle(accent),
          cursor: 'crosshair',
          zIndex: 1000
        }} 
      />
      <div style={{ padding: '10px 12px', fontSize: '12px', letterSpacing: '0.6px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <span className="material-symbols-rounded" style={{ fontSize: '14px', color: '#ef4444' }}>stop_circle</span>
        <span>Fim</span>
      </div>
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
  moveDeal: MoveDealNode,
  delay: DelayNode,
  input: InputNode,
  emailInput: EmailInputNode,
  numberInput: NumberInputNode,
  phoneInput: PhoneInputNode,
  dateInput: DateInputNode,
  fileUpload: FileUploadNode,
  setVariable: SetVariableNode,
  httpRequest: HTTPRequestNode,
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  embed: EmbedNode,
  redirect: RedirectNode,
  script: ScriptNode,
  wait: WaitNode,
  typebotLink: TypebotLinkNode,
  jump: JumpNode,
  pictureChoice: PictureChoiceNode,
  start: StartNode,
  end: EndNode,
};

export default function BotFlowBuilderVisual() {
  const confirm = useConfirm();
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const [botMeta, setBotMeta] = useState<BotMeta | null>(null);
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
    buttons: [] as any[],
  });
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowFormData, setFlowFormData] = useState({
    name: '',
    description: '',
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<Array<{ type: 'user' | 'bot', content: string, timestamp: Date }>>([]);
  const [previewCurrentStepId, setPreviewCurrentStepId] = useState<string | null>(null);
  const [previewContext, setPreviewContext] = useState<Record<string, any>>({});
  const [previewWaitingInput, setPreviewWaitingInput] = useState<{ stepId: string, inputType: string, placeholder?: string } | null>(null);
  const [previewInputValue, setPreviewInputValue] = useState('');
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [selectedBlockType, setSelectedBlockType] = useState<string>('condition');

  const markBotAsPending = useCallback(() => {
    setBotMeta((prev) => (prev ? { ...prev, hasPendingChanges: true } : prev));
  }, []);


  // Função para substituir variáveis no preview
  const parsePreviewVariables = useCallback((text: string, context?: Record<string, any>): string => {
    if (!text) return text;
    const ctx = context || previewContext;
    let result = text;
    // Substituir {{variável}} pelo valor do contexto
    result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = ctx[varName];
      return value !== undefined && value !== null ? String(value) : match;
    });
    return result;
  }, [previewContext]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodesRef = useRef(nodes);
  const previewContextRef = useRef(previewContext);
  
  // Atualizar refs sempre que mudarem
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    previewContextRef.current = previewContext;
  }, [previewContext]);

  useEffect(() => {
    if (botId) {
      fetchFlows();
      fetchIntents();
      fetchVariables();
      fetchUsers();
      fetchPipelines();
    }
  }, [botId]);

  useEffect(() => {
    // Coletar variáveis dos steps do fluxo atual
    if (selectedFlow && selectedFlow.steps) {
      const variablesFromSteps: string[] = [];
      selectedFlow.steps.forEach((step: any) => {
        if (step.config) {
          // Variáveis de inputs
          if (step.config.variableName) {
            variablesFromSteps.push(step.config.variableName);
          }
          // Variáveis de HTTP Request (fieldMappings)
          if (step.config.fieldMappings && Array.isArray(step.config.fieldMappings)) {
            step.config.fieldMappings.forEach((mapping: any) => {
              if (mapping.variableName) {
                variablesFromSteps.push(mapping.variableName);
              }
            });
          }
          // Variável principal do HTTP Request
          if (step.config.variableName && step.type === 'HTTP_REQUEST') {
            variablesFromSteps.push(step.config.variableName);
          }
          // Variáveis definidas por SCRIPT (saveResultInVariable)
          if (step.type === 'SCRIPT' && step.config.saveResultInVariable) {
            variablesFromSteps.push(String(step.config.saveResultInVariable).trim());
          }
        }
      });
      // Combinar com variáveis do bot (sem duplicatas)
      setAvailableVariables((prev) => {
        const allVars = [...prev, ...variablesFromSteps];
        return [...new Set(allVars)];
      });
    }
  }, [selectedFlow]);

  const fetchVariables = async () => {
    try {
      const response = await api.get(`/api/bots/${botId}/variables`);
      const botVars = (response.data || []).map((v: any) => v.name);
      setAvailableVariables(botVars);
    } catch (error) {
      console.error('Erro ao carregar variáveis:', error);
    }
  };

  const fetchFlows = async () => {
    try {
      try {
        await api.post(`/api/bots/${botId}/draft-flow`);
      } catch (draftError) {
        console.error('Erro ao preparar rascunho do bot:', draftError);
      }

      try {
        const botResponse = await api.get(`/api/bots/${botId}`);
        setBotMeta(botResponse.data || null);
      } catch (botError) {
        console.error('Erro ao carregar metadados do bot:', botError);
        setBotMeta(null);
      }

      const response = await api.get(`/api/bots/${botId}/flows`);
      const flowList = response.data || [];
      setFlows(flowList);

      if (flowList.length === 0) {
        // Se não existe fluxo ainda, criar automaticamente um fluxo padrão
        try {
          const created = await api.post(`/api/bots/${botId}/flows`, {
            name: 'Fluxo principal',
            description: 'Fluxo padrão do bot',
            trigger: 'always',
          });
          setFlows([created.data]);
          setSelectedFlow(created.data);
        } catch (createError: any) {
          console.error('Erro ao criar fluxo padrão do bot:', createError);
        }
      } else {
        const draftFlow = flowList.find((f: any) => f.isActive === false);
        const publishedFlow = flowList.find((f: any) => f.isActive === true);
        const preferred =
          draftFlow ||
          publishedFlow ||
          flowList.find((f: any) => Array.isArray(f.steps) && f.steps.length > 0) ||
          flowList[0];
        setSelectedFlow(preferred);
      }
    } catch (error) {
      console.error('Erro ao carregar fluxos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishBot = async () => {
    if (!botId) return;
    try {
      await api.post(`/api/bots/${botId}/publish-draft`);
      alert('Publicação realizada com sucesso!');
      await fetchFlows();
    } catch (error: any) {
      console.error('Erro ao publicar bot:', error);
      alert(error.response?.data?.error || 'Erro ao publicar bot');
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

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users?limit=500');
      const list = Array.isArray(response.data?.users) ? response.data.users : (response.data || []);
      setUsers(
        list.map((u: any) => ({
          id: u.id,
          name: u.name || u.email || 'Usuário',
          email: u.email,
        })),
      );
    } catch (error) {
      console.error('Erro ao carregar usuários para Round Robin:', error);
    }
  };

  const fetchPipelines = async () => {
    try {
      const response = await api.get('/api/pipelines');
      const list = Array.isArray(response.data) ? response.data : [];
      setPipelines(list);
    } catch (error) {
      console.error('Erro ao carregar pipelines para bloco Mover lead:', error);
    }
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    // Não permitir deletar nós de início e fim
    if (nodeId === 'start' || nodeId === 'end') {
      alert('Não é possível excluir os nós de início e fim');
      return;
    }

    // Remover o nó e obter informações antes de deletar
    setNodes((nds) => {
      const nodeToDelete = nds.find(n => n.id === nodeId);
      
      // Se o nó tinha um stepId válido (não temporário), deletar do backend
      if (nodeToDelete?.data?.stepId && !nodeToDelete.data.stepId.startsWith('step-')) {
        // Deletar do backend
        api.delete(`/api/bots/steps/${nodeToDelete.data.stepId}`).catch((error) => {
          console.error('Erro ao deletar step do backend:', error);
        });
      }
      
      return nds.filter((node) => node.id !== nodeId);
    });
    
    // Remover todas as conexões relacionadas a este nó
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    markBotAsPending();
  }, [markBotAsPending]);

  const requestNodeDelete = useCallback((nodeId: string) => {
    (async () => {
      const confirmed = await confirm({
        title: 'Excluir bloco',
        message: 'Tem certeza que deseja excluir este bloco?',
      });
      if (!confirmed) return;
      handleDeleteNode(nodeId);
    })();
  }, [confirm, handleDeleteNode]);

  // Adicionar suporte à tecla Delete para deletar nós selecionados
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Verificar se a tecla Delete ou Backspace foi pressionada
      if ((event.key === 'Delete' || event.key === 'Backspace') && !showStepModal) {
        // Prevenir comportamento padrão (não deletar texto em inputs)
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          // Verificar se algum nó está selecionado usando a ref
          const selectedNodes = nodesRef.current.filter(node => node.selected);
          if (selectedNodes.length > 0) {
            event.preventDefault();
            const nodeToDelete = selectedNodes[0];
            if (nodeToDelete.id !== 'start' && nodeToDelete.id !== 'end') {
              requestNodeDelete(nodeToDelete.id);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showStepModal, requestNodeDelete]);

  const loadFlowToCanvas = useCallback((flow: Flow) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const steps = Array.isArray(flow?.steps) ? flow.steps : [];
    let edgesToSet: Edge[] = newEdges;

    // Nó de início
    newNodes.push({
      id: 'start',
      type: 'start',
      position: { x: 250, y: 50 },
      data: { label: 'Início' },
    });

    // Carregar steps como nós
    if (steps.length > 0) {
      steps.forEach((step, index) => {
        const nodeType = step.type === 'MESSAGE' ? 'message' :
                         step.type === 'CONDITION' ? 'condition' :
                         step.type === 'HANDOFF' ? 'handoff' :
                         step.type === 'MOVE_DEAL' ? 'moveDeal' :
                         step.type === 'DELAY' ? 'delay' :
                         step.type === 'INPUT' ? 'input' :
                         step.type === 'SET_VARIABLE' ? 'setVariable' :
                         step.type === 'HTTP_REQUEST' ? 'httpRequest' :
                         step.type === 'IMAGE' ? 'image' :
                         step.type === 'VIDEO' ? 'video' :
                         step.type === 'AUDIO' ? 'audio' :
                         step.type === 'EMBED' ? 'embed' :
                         step.type === 'EMAIL_INPUT' ? 'emailInput' :
                         step.type === 'NUMBER_INPUT' ? 'numberInput' :
                         step.type === 'PHONE_INPUT' ? 'phoneInput' :
                         step.type === 'DATE_INPUT' ? 'dateInput' :
                         step.type === 'FILE_UPLOAD' ? 'fileUpload' :
                         step.type === 'REDIRECT' ? 'redirect' :
                         step.type === 'SCRIPT' ? 'script' :
                        step.type === 'WAIT' ? 'wait' :
                        step.type === 'TYPEBOT_LINK' ? 'typebotLink' :
                        step.type === 'JUMP' ? 'jump' :
                         step.type === 'PICTURE_CHOICE' ? 'pictureChoice' : 'message';

        const position = (step.config?.position && typeof step.config.position === 'object' && 'x' in step.config.position && 'y' in step.config.position)
          ? { x: Number(step.config.position.x), y: Number(step.config.position.y) }
          : (step.position || { x: 250, y: 150 + (index * 150) });

        newNodes.push({
          id: step.id,
          type: nodeType,
          position,
          data: {
            label: step.type,
            content: step.response?.content || '',
            mediaUrl: step.response?.mediaUrl || '',
            condition: step.conditions?.[0]?.condition || '',
            operator: step.conditions?.[0]?.operator || '',
            value: step.conditions?.[0]?.value || '',
            conditionsList: (step.conditions || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
            logicOperator: step.config?.logicOperator || 'AND',
            delay: step.config?.delay || '',
            buttons: step.config?.buttons || [],
            stepId: step.id,
            config: step.config || {},
            order: step.order,
            onDelete: handleDeleteNode,
            onRequestDelete: requestNodeDelete,
          },
        });

        // Conexões: nextStepId e condições (para montar o set de "destinos")
        const nextId = step.nextStepId != null ? String(step.nextStepId).trim() : '';
        if (nextId) {
          if (nextId === 'END') {
            newEdges.push({
              id: `${step.id}-end`,
              source: step.id,
              target: 'end',
            });
          } else {
            newEdges.push({
              id: `${step.id}-${nextId}`,
              source: step.id,
              target: nextId,
            });
          }
        }

        // Conexões por botão (MESSAGE com botões)
        if (step.type === 'MESSAGE' && Array.isArray(step.config?.buttons)) {
          step.config.buttons.forEach((btn: any, btnIndex: number) => {
            const buttonTarget = btn?.nextStepId != null ? String(btn.nextStepId).trim() : '';
            if (!buttonTarget) return;

            const target = buttonTarget === 'END' ? 'end' : buttonTarget;
            newEdges.push({
              id: `${step.id}-btn-${btnIndex}-${target}`,
              source: step.id,
              sourceHandle: `btn-${btnIndex}`,
              target,
              label: btn?.text || `Botão ${btnIndex + 1}`,
              style: { stroke: '#22c55e', strokeWidth: 2 },
              labelStyle: { fill: '#22c55e', fontWeight: 600 },
              labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
            } as any);
          });
        }
        if (step.conditions && step.conditions.length > 0) {
          const condition = step.conditions[0];
          if (condition.trueStepId) {
            const trueTarget = condition.trueStepId === 'END' ? 'end' : condition.trueStepId;
            newEdges.push({
              id: `${step.id}-true-${trueTarget}`,
              source: step.id,
              sourceHandle: 'true',
              target: trueTarget,
              label: 'Sim',
              style: { stroke: '#10b981', strokeWidth: 2 },
              labelStyle: { fill: '#10b981', fontWeight: 600 },
              labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
            });
          }
          if (condition.falseStepId) {
            const falseTarget = condition.falseStepId === 'END' ? 'end' : condition.falseStepId;
            newEdges.push({
              id: `${step.id}-false-${falseTarget}`,
              source: step.id,
              sourceHandle: 'false',
              target: falseTarget,
              label: 'Não',
              style: { stroke: '#ef4444', strokeWidth: 2 },
              labelStyle: { fill: '#ef4444', fontWeight: 600 },
              labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
            });
          }
        }
      });

      // Steps que são destino de alguma conexão (não são "entrada")
      const targetStepIds = new Set<string>();
      newEdges.forEach((e) => {
        if (e.target && e.target !== 'end') targetStepIds.add(e.target);
      });

      // Conectar Início a todos os steps de entrada (que não são alvo de nenhuma outra conexão)
      steps.forEach((step) => {
        if (!targetStepIds.has(step.id)) {
          newEdges.push({
            id: `start-${step.id}`,
            source: 'start',
            target: step.id,
          });
        }
      });

      // Remover duplicatas de edges start-> (caso já existissem no loop acima)
      const seen = new Set<string>();
      const deduped: Edge[] = [];
      newEdges.forEach((e) => {
        const key = `${e.source}-${e.target}${e.sourceHandle ? `-${e.sourceHandle}` : ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(e);
        }
      });
      edgesToSet = deduped.length ? deduped : newEdges;

      // Nó de fim
      newNodes.push({
        id: 'end',
        type: 'end',
        position: { x: 250, y: 150 + (steps.length * 150) },
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
    setEdges(edgesToSet);
  }, [handleDeleteNode, requestNodeDelete]);

  useEffect(() => {
    if (selectedFlow) {
      const reloadFlow = async () => {
        try {
          const flowResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`, {
            params: { _: Date.now() },
          });
          const updatedFlow = flowResponse.data;
          loadFlowToCanvas(updatedFlow);
          setSelectedFlow(updatedFlow);
        } catch (error) {
          console.error('Erro ao recarregar fluxo:', error);
          loadFlowToCanvas(selectedFlow);
        }
      };
      reloadFlow();
    }
  }, [selectedFlow?.id, loadFlowToCanvas]);

  const onConnect = useCallback(
    async (params: Connection) => {
      console.log('🔌 onConnect chamado:', params);
      
      // Adicionar label baseado no tipo de conexão
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      console.log('📦 sourceNode:', sourceNode);
      console.log('📦 targetNode:', targetNode);
      
      // Conexões saindo do Início: apenas adicionar a edge na tela (não há step no backend para salvar)
      if (params.source === 'start') {
        const targetNodeId = params.target;
        const newEdge = {
          ...params,
          id: `start-${targetNodeId}-${Date.now()}`,
          style: { stroke: '#10b981', strokeWidth: 2 },
        };
        setEdges((eds) => [...eds, newEdge]);
        console.log('✅ Conexão do Início adicionada na tela');
        return;
      }
      
      // Verificar se o sourceNode tem um stepId válido
      const sourceStepId = sourceNode?.data?.stepId;
      const targetStepId = targetNode?.data?.stepId;
      
      if (!sourceStepId || sourceStepId.startsWith('step-')) {
        console.warn('Não é possível salvar conexão: step de origem não foi salvo ainda');
        return;
      }
      
      // Se o destino for "end", não precisa de stepId (end não tem stepId)
      // Se não for "end", precisa de stepId válido
      if (params.target !== 'end') {
        if (!targetStepId || targetStepId.startsWith('step-')) {
          console.warn('Não é possível salvar conexão: step de destino não foi salvo ainda');
          return;
        }
      }
      
      let label = '';
      let edgeStyle = { stroke: '#3b82f6', strokeWidth: 2 };
      let labelColor = '#3b82f6';
      
      if (sourceNode?.type === 'condition') {
        // Usar o sourceHandle para determinar se é "Sim" ou "Não"
        if (params.sourceHandle === 'true') {
          label = 'Sim';
          edgeStyle = { stroke: '#10b981', strokeWidth: 2 };
          labelColor = '#10b981';

          try {
            const stepResponse = await api.get(`/api/bots/flows/${selectedFlow?.id}`);
            const flow = stepResponse.data;
            const step = flow?.steps?.find((s: any) => s.id === sourceStepId);
            const sorted = (step?.conditions || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            const firstCondition = sorted[0];
            const finalTrueStepId = params.target === 'end' ? 'END' : targetStepId;

            if (firstCondition?.id) {
              await api.put(`/api/bots/conditions/${firstCondition.id}`, {
                condition: firstCondition.condition,
                operator: firstCondition.operator,
                value: firstCondition.value,
                order: firstCondition.order,
                trueStepId: finalTrueStepId,
                falseStepId: firstCondition.falseStepId ?? undefined,
              });
            } else {
              await api.post(`/api/bots/steps/${sourceStepId}/conditions`, {
                condition: 'message.content',
                operator: 'CONTAINS',
                value: '',
                order: 0,
                trueStepId: finalTrueStepId,
              });
            }
          } catch (error) {
            console.error('Erro ao salvar conexão de condição (true):', error);
          }
        } else if (params.sourceHandle === 'false') {
          label = 'Não';
          edgeStyle = { stroke: '#ef4444', strokeWidth: 2 };
          labelColor = '#ef4444';

          try {
            const stepResponse = await api.get(`/api/bots/flows/${selectedFlow?.id}`);
            const flow = stepResponse.data;
            const step = flow?.steps?.find((s: any) => s.id === sourceStepId);
            const sorted = (step?.conditions || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            const firstCondition = sorted[0];
            const finalFalseStepId = params.target === 'end' ? 'END' : targetStepId;

            if (firstCondition?.id) {
              await api.put(`/api/bots/conditions/${firstCondition.id}`, {
                condition: firstCondition.condition,
                operator: firstCondition.operator,
                value: firstCondition.value,
                order: firstCondition.order,
                trueStepId: firstCondition.trueStepId ?? undefined,
                falseStepId: finalFalseStepId,
              });
            } else {
              await api.post(`/api/bots/steps/${sourceStepId}/conditions`, {
                condition: 'message.content',
                operator: 'CONTAINS',
                value: '',
                order: 0,
                falseStepId: finalFalseStepId,
              });
            }
          } catch (error) {
            console.error('Erro ao salvar conexão de condição (false):', error);
          }
        }
      } else {
        const isMessageButtonHandle =
          sourceNode?.type === 'message' &&
          typeof params.sourceHandle === 'string' &&
          params.sourceHandle.startsWith('btn-');

        if (isMessageButtonHandle) {
          const buttonIndex = Number(params.sourceHandle?.replace('btn-', ''));
          const currentButtons = Array.isArray(sourceNode?.data?.buttons)
            ? [...sourceNode.data.buttons]
            : [];

          if (!Number.isNaN(buttonIndex) && currentButtons[buttonIndex]) {
            const nextStepIdValue = params.target === 'end' ? 'END' : targetStepId;
            currentButtons[buttonIndex] = {
              ...currentButtons[buttonIndex],
              nextStepId: nextStepIdValue,
            };

            try {
              await api.put(`/api/bots/steps/${sourceStepId}`, {
                config: {
                  ...(sourceNode?.data?.config || {}),
                  buttons: currentButtons,
                },
              });
            } catch (error: any) {
              console.error('❌ Erro ao salvar conexão do botão:', error);
              const msg =
                error?.response?.data?.error || error?.message || 'Falha ao salvar conexão do botão';
              alert(`Conexão não salva: ${msg}. Verifique permissões ou tente novamente.`);
              return;
            }

            label = currentButtons[buttonIndex].text || `Botão ${buttonIndex + 1}`;
            edgeStyle = { stroke: '#22c55e', strokeWidth: 2 };
            labelColor = '#22c55e';
          }
        } else {
        // Para outros tipos, salvar nextStepId
        // Se o destino for "end", salvar "END" como valor especial
        try {
          const nextStepIdValue = params.target === 'end' ? 'END' : targetStepId;
          console.log('💾 Salvando nextStepId:', { sourceStepId, nextStepIdValue, target: params.target });
          await api.put(`/api/bots/steps/${sourceStepId}`, {
            nextStepId: nextStepIdValue,
          });
          console.log('✅ nextStepId salvo com sucesso');
        } catch (error: any) {
          console.error('❌ Erro ao salvar conexão:', error);
          const msg = error?.response?.data?.error || error?.message || 'Falha ao salvar conexão';
          alert(`Conexão não salva: ${msg}. Verifique permissões ou tente novamente.`);
          return;
        }
        
        if (sourceNode?.type === 'message' && sourceNode.data.buttons) {
          // Se for uma mensagem com botões, usar o texto do botão
          const buttonIndex = edges.filter(e => e.source === params.source).length;
          if (sourceNode.data.buttons[buttonIndex]) {
            label = sourceNode.data.buttons[buttonIndex].text;
          }
        }
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
      
      console.log('🔗 Criando nova edge:', newEdge);
      setEdges((eds) => {
        const updated = [...eds, newEdge];
        console.log('📊 Edges atualizadas:', updated.length, 'edges');
        return updated;
      });
      markBotAsPending();
      
      // Recarregar o fluxo para exibir as conexões salvas
      if (selectedFlow) {
        try {
          const flowResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`, {
            params: { _: Date.now() },
          });
          const updatedFlow = flowResponse.data;
          loadFlowToCanvas(updatedFlow);
          setSelectedFlow(updatedFlow);
        } catch (error) {
          console.error('Erro ao recarregar fluxo:', error);
        }
      }
    },
    [edges, nodes, selectedFlow, markBotAsPending]
  );

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mantemos a regra de um fluxo por bot: se já existe, apenas avisa
    if (flows.length > 0) {
      alert('Este bot já possui um fluxo. Só é permitido um fluxo por bot.');
      return;
    }

    try {
      const created = await api.post(`/api/bots/${botId}/flows`, {
        name: flowFormData.name || 'Fluxo principal',
        description: flowFormData.description,
        trigger: 'always',
      });
      setFlows([created.data]);
      setSelectedFlow(created.data);
      setShowFlowModal(false);
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

    const getDefaultConfig = (nodeType: string) => {
      switch (nodeType) {
        case 'input':
          return { inputType: 'TEXT', placeholder: '', variableName: '' };
        case 'setVariable':
          return { variableName: '', value: '' };
        case 'httpRequest':
          return { method: 'GET', url: '', headers: {}, body: '', variableName: 'httpResponse', showResponse: false, fieldMappings: [] };
        case 'image':
          return { imageUrl: '', altText: '', clickAction: null };
        case 'video':
          return { videoUrl: '', platform: 'youtube', autoplay: false };
        case 'audio':
          return { audioUrl: '', autoplay: false };
        case 'embed':
          return { embedUrl: '', height: 400, width: '100%' };
        case 'emailInput':
          return { placeholder: 'Digite seu email...', variableName: '', required: true };
        case 'numberInput':
          return { placeholder: 'Digite um número...', variableName: '', min: null, max: null, required: false };
        case 'phoneInput':
          return { placeholder: 'Digite seu telefone...', variableName: '', required: true };
        case 'dateInput':
          return { label: 'Selecione uma data', variableName: '', minDate: null, maxDate: null, required: false };
        case 'fileUpload':
          return { accept: '*/*', maxSize: 10, variableName: '', multiple: false };
        case 'redirect':
          return { url: '', openInNewTab: false };
        case 'script':
          return { code: '', saveResultInVariable: '' };
        case 'wait':
          return { waitFor: 'user', message: 'Aguardando...' };
        case 'typebotLink':
          return { botId: '', passVariables: true };
        case 'jump':
          return { targetStepId: '' };
        case 'pictureChoice':
          return { choices: [], variableName: '', multiple: false, layout: 'grid' };
        case 'moveDeal':
          return { pipelineId: '', stageId: '', pipelineName: '', stageName: '' };
        default:
          return {};
      }
    };

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
        config: getDefaultConfig(type),
        onDelete: handleDeleteNode,
        onRequestDelete: requestNodeDelete,
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
                     node.type === 'moveDeal' ? 'MOVE_DEAL' :
                     node.type === 'delay' ? 'DELAY' :
                     node.type === 'input' ? 'INPUT' :
                     node.type === 'setVariable' ? 'SET_VARIABLE' :
                     node.type === 'httpRequest' ? 'HTTP_REQUEST' :
                     node.type === 'image' ? 'IMAGE' :
                     node.type === 'video' ? 'VIDEO' :
                     node.type === 'audio' ? 'AUDIO' :
                     node.type === 'embed' ? 'EMBED' :
                     node.type === 'emailInput' ? 'EMAIL_INPUT' :
                     node.type === 'numberInput' ? 'NUMBER_INPUT' :
                     node.type === 'phoneInput' ? 'PHONE_INPUT' :
                     node.type === 'dateInput' ? 'DATE_INPUT' :
                     node.type === 'fileUpload' ? 'FILE_UPLOAD' :
                     node.type === 'redirect' ? 'REDIRECT' :
                     node.type === 'script' ? 'SCRIPT' :
                     node.type === 'wait' ? 'WAIT' :
                     node.type === 'typebotLink' ? 'TYPEBOT_LINK' :
                     node.type === 'abTest' ? 'AB_TEST' :
                     node.type === 'jump' ? 'JUMP' :
                     node.type === 'pictureChoice' ? 'PICTURE_CHOICE' : 'MESSAGE';
    
    // Configurar config baseado no tipo
    let config: any = {};
    if (node.data.delay) {
      config = { delay: node.data.delay };
    } else if (node.data.condition) {
      config = {
        condition: node.data.condition,
        operator: node.data.operator,
        value: node.data.value,
        logicOperator: node.data.config?.logicOperator || 'AND',
        conditionsList: node.data.conditionsList || [],
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
    } else if (stepType === 'IMAGE') {
      config = {
        imageUrl: '',
        altText: '',
        clickAction: null,
      };
    } else if (stepType === 'VIDEO') {
      config = {
        videoUrl: '',
        platform: 'youtube',
        autoplay: false,
      };
    } else if (stepType === 'AUDIO') {
      config = {
        audioUrl: '',
        autoplay: false,
      };
    } else if (stepType === 'EMBED') {
      config = {
        embedUrl: '',
        height: 400,
        width: '100%',
      };
    } else if (stepType === 'EMAIL_INPUT') {
      config = { placeholder: 'Digite seu email...', variableName: '', required: true };
    } else if (stepType === 'NUMBER_INPUT') {
      config = { placeholder: 'Digite um número...', variableName: '', min: null, max: null, required: false };
    } else if (stepType === 'PHONE_INPUT') {
      config = { placeholder: 'Digite seu telefone...', variableName: '', required: true };
    } else if (stepType === 'DATE_INPUT') {
      config = { label: 'Selecione uma data', variableName: '', minDate: null, maxDate: null, required: false };
    } else if (stepType === 'FILE_UPLOAD') {
      config = { accept: '*/*', maxSize: 10, variableName: '', multiple: false };
    } else if (stepType === 'REDIRECT') {
      config = { url: '', openInNewTab: false };
    } else if (stepType === 'SCRIPT') {
      config = { code: '', saveResultInVariable: '' };
    } else if (stepType === 'WAIT') {
      config = { waitFor: 'user', message: 'Aguardando...', waitTime: 1000 };
    } else if (stepType === 'TYPEBOT_LINK') {
      config = { botId: '', passVariables: true };
    } else if (stepType === 'AB_TEST') {
      config = { variants: [{ percent: 50, blockId: '' }, { percent: 50, blockId: '' }], splitPercent: 50 };
    } else if (stepType === 'JUMP') {
      config = { targetStepId: '' };
    } else if (stepType === 'PICTURE_CHOICE') {
      config = { choices: [], variableName: '', multiple: false, layout: 'grid' };
    }
    
    const isNewNode = !node.data?.stepId || String(node.data.stepId).startsWith('step-');
    const existingStep = selectedFlow?.steps?.find((s: any) => s.id === (node.data?.stepId || node.id));
    const stepOrder = isNewNode
      ? (selectedFlow?.steps?.length ?? 0)
      : (node.data?.order ?? existingStep?.order ?? 0);

    if (stepType === 'CONDITION' && existingStep?.conditions?.length) {
      const sorted = existingStep.conditions.slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      config.conditionsList = sorted.map((c: any) => ({
        id: c.id,
        condition: c.condition,
        operator: c.operator,
        value: c.value,
      }));
      config.logicOperator = config.logicOperator || existingStep.config?.logicOperator || 'AND';
    }
    if (stepType === 'CONDITION' && (!config.conditionsList || config.conditionsList.length === 0)) {
      config.conditionsList = [{ id: null, condition: 'message.content', operator: 'CONTAINS', value: '' }];
      config.logicOperator = config.logicOperator || 'AND';
    }

    const normalizedMessageConfig =
      stepType === 'MESSAGE'
        ? {
            ...config,
            interactiveType: config?.interactiveType || 'buttons',
            listButtonText: config?.listButtonText || 'Ver opções',
            listHeaderText: config?.listHeaderText || '',
            listFooterText: config?.listFooterText || '',
            listSectionTitle: config?.listSectionTitle || 'Opções',
          }
        : config;

    setStepFormData({
      type: stepType,
      content: node.data.content || '',
      order: stepOrder,
      intentId: '',
      config: normalizedMessageConfig,
      buttons: node.data.buttons || [],
    });
    setShowStepModal(true);
  };

  const handleSaveStep = async () => {
    if (!selectedFlow || !editingNode) return;

    try {
      const imageUrl = String(stepFormData.config?.imageUrl || '').trim();
      const videoUrl = String(stepFormData.config?.videoUrl || '').trim();
      const audioUrl = String(stepFormData.config?.audioUrl || '').trim();

      if (uploadingImage || uploadingVideo) {
        alert('Aguarde o upload da mídia terminar antes de salvar o step.');
        return;
      }

      if (stepFormData.type === 'IMAGE' && !imageUrl) {
        alert('Configure a imagem antes de salvar o step.');
        return;
      }

      if (stepFormData.type === 'VIDEO' && !videoUrl) {
        alert('Configure o vídeo antes de salvar o step.');
        return;
      }

      if (stepFormData.type === 'AUDIO' && !audioUrl) {
        alert('Configure o áudio antes de salvar o step.');
        return;
      }

      // Verificar se é edição: stepId existe e não começa com "step-" (que indica ID temporário)
      const stepIdValue = editingNode.data.stepId;
      const isEditing = stepIdValue && !stepIdValue.startsWith('step-');
      let stepId: string;
      let shouldCreateNew = false;

      if (isEditing) {
        // Tentar atualizar step existente
        stepId = stepIdValue;
        try {
          const configWithPosition = {
            ...stepFormData.config,
            buttons: stepFormData.buttons,
            position: editingNode.position || undefined,
          };
          if (stepFormData.type === 'CONDITION') {
            (configWithPosition as any).logicOperator = stepFormData.config.logicOperator || 'AND';
          }
          await api.put(`/api/bots/steps/${stepId}`, {
            type: stepFormData.type,
            order: stepFormData.order,
            config: configWithPosition,
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

        if (stepFormData.type === 'CONDITION' && !shouldCreateNew && (stepFormData.config.conditionsList || []).length > 0) {
          const existingStep = selectedFlow?.steps?.find((s: any) => s.id === stepId);
          const existingIds = (existingStep?.conditions || []).map((c: any) => c.id);
          const list = stepFormData.config.conditionsList as any[];
          const firstCondition = existingStep?.conditions?.[0];
          for (let i = 0; i < list.length; i++) {
            const c = list[i];
            const payload: any = { condition: c.condition || 'message.content', operator: c.operator || 'CONTAINS', value: c.value ?? '', order: i };
            if (i === 0 && firstCondition && (firstCondition.trueStepId || firstCondition.falseStepId)) {
              payload.trueStepId = firstCondition.trueStepId;
              payload.falseStepId = firstCondition.falseStepId;
            }
            if (c.id) {
              await api.put(`/api/bots/conditions/${c.id}`, payload);
            } else {
              await api.post(`/api/bots/steps/${stepId}/conditions`, payload);
            }
          }
          const keepIds = list.filter((x: any) => x.id).map((x: any) => x.id);
          for (const id of existingIds) {
            if (!keepIds.includes(id)) {
              try { await api.delete(`/api/bots/conditions/${id}`); } catch (_) {}
            }
          }
        }
      } else {
        shouldCreateNew = true;
      }
      
      if (shouldCreateNew) {
        // Criar novo step
        const configWithPosition = {
          ...stepFormData.config,
          buttons: stepFormData.buttons,
          position: editingNode.position || undefined,
        };
        if (stepFormData.type === 'CONDITION') {
          (configWithPosition as any).logicOperator = stepFormData.config.logicOperator || 'AND';
        }
        const stepResponse = await api.post(`/api/bots/flows/${selectedFlow.id}/steps`, {
          type: stepFormData.type,
          order: stepFormData.order,
          config: configWithPosition,
          intentId: stepFormData.intentId || null,
          responseId: null,
        });
        stepId = stepResponse.data.id;

        if (stepFormData.type === 'CONDITION' && (stepFormData.config.conditionsList || []).length > 0) {
          for (let i = 0; i < stepFormData.config.conditionsList.length; i++) {
            const c = stepFormData.config.conditionsList[i];
            await api.post(`/api/bots/steps/${stepId}/conditions`, {
              condition: c.condition || 'message.content',
              operator: c.operator || 'CONTAINS',
              value: c.value ?? '',
              order: i,
            });
          }
        }
      }

      // Criar ou atualizar resposta se for tipo MESSAGE ou mídia
      let responseId = null;
      if (stepFormData.type === 'MESSAGE' && stepFormData.content) {
        try {
          const interactiveType = String(stepFormData.config?.interactiveType || 'buttons');
          const messageButtons = Array.isArray(stepFormData.buttons) ? stepFormData.buttons : [];
          const response = await api.post('/api/bots/responses', {
            type: 'TEXT',
            content: stepFormData.content,
            buttons: messageButtons,
            metadata: {
              interactiveType,
              listButtonText: stepFormData.config?.listButtonText || undefined,
              listHeaderText: stepFormData.config?.listHeaderText || undefined,
              listFooterText: stepFormData.config?.listFooterText || undefined,
              listSectionTitle: stepFormData.config?.listSectionTitle || undefined,
            },
            flowStepId: stepId,
            intentId: null,
          });
          responseId = response.data.id;
          
          await api.put(`/api/bots/steps/${stepId}`, {
            responseId: responseId,
          });
        } catch (responseError: any) {
          console.error('Erro ao criar resposta:', responseError);
        }
      } else if (stepFormData.type === 'IMAGE' && imageUrl) {
        try {
          const response = await api.post('/api/bots/responses', {
            type: 'IMAGE',
            content: stepFormData.config.altText || '',
            mediaUrl: imageUrl,
            flowStepId: stepId,
            intentId: null,
          });
          responseId = response.data.id;
          
          await api.put(`/api/bots/steps/${stepId}`, {
            responseId: responseId,
          });
        } catch (responseError: any) {
          console.error('Erro ao criar resposta de imagem:', responseError);
        }
      } else if (stepFormData.type === 'VIDEO' && videoUrl) {
        try {
          const response = await api.post('/api/bots/responses', {
            type: 'VIDEO',
            content: '',
            mediaUrl: videoUrl,
            flowStepId: stepId,
            intentId: null,
          });
          responseId = response.data.id;
          
          await api.put(`/api/bots/steps/${stepId}`, {
            responseId: responseId,
          });
        } catch (responseError: any) {
          console.error('Erro ao criar resposta de vídeo:', responseError);
        }
      } else if (stepFormData.type === 'AUDIO' && audioUrl) {
        try {
          const response = await api.post('/api/bots/responses', {
            type: 'AUDIO',
            content: '',
            mediaUrl: audioUrl,
            flowStepId: stepId,
            intentId: null,
          });
          responseId = response.data.id;
          
          await api.put(`/api/bots/steps/${stepId}`, {
            responseId: responseId,
          });
        } catch (responseError: any) {
          console.error('Erro ao criar resposta de áudio:', responseError);
        }
      }

      // Atualizar nó com dados do step (incluir posição atual para não perder ao recarregar)
      const positionToSave = editingNode.position || { x: 250, y: 250 };
      setNodes((nds) =>
        nds.map((node) =>
          node.id === editingNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: stepFormData.content,
                  condition: stepFormData.config.conditionsList?.[0]?.condition ?? stepFormData.config.condition,
                  operator: stepFormData.config.conditionsList?.[0]?.operator ?? stepFormData.config.operator,
                  value: stepFormData.config.conditionsList?.[0]?.value ?? stepFormData.config.value,
                  conditionsList: stepFormData.config.conditionsList || [],
                  logicOperator: stepFormData.config.logicOperator,
                  delay: stepFormData.config.delay,
                  buttons: stepFormData.buttons,
                  stepId: stepId,
                  config: { ...stepFormData.config, position: positionToSave },
                  onDelete: node.data.onDelete || handleDeleteNode,
                  onRequestDelete: node.data.onRequestDelete || requestNodeDelete,
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
      markBotAsPending();
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

  const startPreview = () => {
    if (!selectedFlow) {
      alert('Selecione um fluxo primeiro');
      return;
    }
    if (nodes.length === 0) {
      alert('Carregue o fluxo primeiro. Aguarde o carregamento ou recarregue a página.');
      return;
    }
    setShowPreview(true);
    setPreviewMessages([]);
    setPreviewContext({});
    setPreviewWaitingInput(null);
    setPreviewInputValue('');
    // Encontrar o primeiro step (conectado ao start)
    const startEdge = edges.find(e => e.source === 'start');
    if (startEdge) {
      setPreviewCurrentStepId(startEdge.target);
      // Adicionar mensagem de boas-vindas
      setPreviewMessages([{
        type: 'bot',
        content: '👋 Preview iniciado! Iniciando fluxo...',
        timestamp: new Date(),
      }]);
      setTimeout(() => {
        executePreviewStep(startEdge.target);
      }, 500);
    } else {
      setPreviewMessages([{
        type: 'bot',
        content: '⚠️ Nenhum step conectado ao início do fluxo. Conecte um step ao nó de início.',
        timestamp: new Date(),
      }]);
    }
  };

  const executePreviewStep = useCallback((stepId: string) => {
    const node = nodes.find(n => n.id === stepId);
    if (!node) {
      setPreviewMessages(prev => [...prev, {
        type: 'bot',
        content: '❌ Erro: Step não encontrado',
        timestamp: new Date(),
      }]);
      return;
    }

    const stepType = node.type;
    const stepData = node.data;

    switch (stepType) {
      case 'message':
        // Enviar mensagem do bot
        const messageContent = stepData.content || 'Mensagem vazia';
        // Usar o contexto mais recente através da ref
        const currentContext = previewContextRef.current;
        const parsedMessage = parsePreviewVariables(messageContent, currentContext);
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: parsedMessage,
          timestamp: new Date(),
        }]);
        
        // Verificar se há botões
        if (stepData.buttons && stepData.buttons.length > 0) {
          // Mostrar botões como opções
          const buttonsText = stepData.buttons.map((btn: any, idx: number) => 
            `${idx + 1}. ${btn.text || `Botão ${idx + 1}`}`
          ).join('\n');
          setPreviewMessages(prev => [...prev, {
            type: 'bot',
            content: `Opções:\n${buttonsText}\n\nDigite o número da opção ou o texto do botão.`,
            timestamp: new Date(),
          }]);
          setPreviewWaitingInput({ stepId, inputType: 'CHOICE', placeholder: 'Escolha uma opção' });
        } else {
          // Ir para o próximo step
          const nextEdge = edges.find(e => e.source === stepId);
          if (nextEdge) {
            setTimeout(() => {
              executePreviewStep(nextEdge.target);
            }, 500);
          } else {
            setPreviewMessages(prev => [...prev, {
              type: 'bot',
              content: '🏁 Fim do fluxo',
              timestamp: new Date(),
            }]);
          }
        }
        break;

      case 'condition':
        // Avaliar condição
        const condition = stepData.condition || '';
        const operator = stepData.operator || 'EQUALS';
        const value = stepData.value || '';
        
        // Por enquanto, vamos pedir ao usuário para escolher
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🔀 Condição: ${condition} ${operator} ${value}\n\nDigite "sim" se a condição for verdadeira, ou "não" se for falsa.`,
          timestamp: new Date(),
        }]);
        setPreviewWaitingInput({ stepId, inputType: 'CHOICE', placeholder: 'sim ou não' });
        break;

      case 'input':
        // Solicitar input do usuário
        const inputType = stepData.config?.inputType || 'TEXT';
        const placeholder = stepData.config?.placeholder || 'Digite sua resposta...';
        const variableName = stepData.config?.variableName || '';
        
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `📝 ${placeholder}`,
          timestamp: new Date(),
        }]);
        setPreviewWaitingInput({ stepId, inputType, placeholder });
        break;

      case 'setVariable':
        // Definir variável
        const varName = stepData.config?.variableName || '';
        const varValue = stepData.config?.value || '';
        setPreviewContext(prev => ({ ...prev, [varName]: varValue }));
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🔧 Variável "${varName}" definida como: ${varValue}`,
          timestamp: new Date(),
        }]);
        
        // Ir para o próximo step
        const varNextEdge = edges.find(e => e.source === stepId);
        if (varNextEdge) {
          setTimeout(() => {
            executePreviewStep(varNextEdge.target);
          }, 500);
        }
        break;

      case 'httpRequest':
        // Simular requisição HTTP
        const method = stepData.config?.method || 'GET';
        const url = stepData.config?.url || '';
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🌐 Executando ${method} ${url}...`,
          timestamp: new Date(),
        }]);
        
        // Simular resposta (em preview real, faria a requisição)
        setTimeout(() => {
          setPreviewMessages(prev => [...prev, {
            type: 'bot',
            content: `✅ Requisição concluída (simulado em preview)`,
            timestamp: new Date(),
          }]);
          
          // Ir para o próximo step
          const httpNextEdge = edges.find(e => e.source === stepId);
          if (httpNextEdge) {
            setTimeout(() => {
              executePreviewStep(httpNextEdge.target);
            }, 500);
          }
        }, 1000);
        break;

      case 'delay':
        // Aguardar delay
        const delay = stepData.delay || 1000;
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `⏱️ Aguardando ${delay}ms...`,
          timestamp: new Date(),
        }]);
        setTimeout(() => {
          const delayNextEdge = edges.find(e => e.source === stepId);
          if (delayNextEdge) {
            executePreviewStep(delayNextEdge.target);
          }
        }, delay);
        break;

      case 'handoff':
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: '👤 Transferindo para atendente humano...',
          timestamp: new Date(),
        }]);
        break;

      case 'image':
        // Exibir imagem
        const imageUrl = stepData.config?.imageUrl || '';
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🖼️ Imagem: ${imageUrl || 'URL não configurada'}`,
          timestamp: new Date(),
        }]);
        
        const imageNextEdge = edges.find(e => e.source === stepId);
        if (imageNextEdge) {
          setTimeout(() => {
            executePreviewStep(imageNextEdge.target);
          }, 500);
        }
        break;

      case 'video':
        // Exibir vídeo
        const videoUrl = stepData.config?.videoUrl || '';
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🎥 Vídeo: ${videoUrl || 'URL não configurada'}`,
          timestamp: new Date(),
        }]);
        
        const videoNextEdge = edges.find(e => e.source === stepId);
        if (videoNextEdge) {
          setTimeout(() => {
            executePreviewStep(videoNextEdge.target);
          }, 500);
        }
        break;

      case 'audio':
        // Exibir áudio
        const audioUrl = stepData.config?.audioUrl || '';
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🎵 Áudio: ${audioUrl || 'URL não configurada'}`,
          timestamp: new Date(),
        }]);
        
        const audioNextEdge = edges.find(e => e.source === stepId);
        if (audioNextEdge) {
          setTimeout(() => {
            executePreviewStep(audioNextEdge.target);
          }, 500);
        }
        break;

      case 'embed':
        // Exibir embed
        const embedUrl = stepData.config?.embedUrl || '';
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `📦 Embed: ${embedUrl || 'URL não configurada'}`,
          timestamp: new Date(),
        }]);
        
        const embedNextEdge = edges.find(e => e.source === stepId);
        if (embedNextEdge) {
          setTimeout(() => {
            executePreviewStep(embedNextEdge.target);
          }, 500);
        }
        break;

      case 'emailInput':
      case 'numberInput':
      case 'phoneInput':
      case 'dateInput':
      case 'fileUpload':
        // Solicitar input específico
        const inputTypeName = stepType === 'emailInput' ? 'Email' :
                              stepType === 'numberInput' ? 'Número' :
                              stepType === 'phoneInput' ? 'Telefone' :
                              stepType === 'dateInput' ? 'Data' : 'Arquivo';
        const inputPlaceholder = stepData.config?.placeholder || `Digite ${inputTypeName.toLowerCase()}...`;
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `📝 ${inputPlaceholder}`,
          timestamp: new Date(),
        }]);
        setPreviewWaitingInput({ stepId, inputType: stepType.toUpperCase(), placeholder: inputPlaceholder });
        break;

      case 'pictureChoice':
        // Escolha com imagens
        const choices = stepData.config?.choices || [];
        const choicesText = choices.map((c: any, idx: number) => 
          `${idx + 1}. ${c.title || `Opção ${idx + 1}`}`
        ).join('\n');
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🖼️ Escolha uma opção:\n${choicesText || 'Nenhuma opção configurada'}`,
          timestamp: new Date(),
        }]);
        setPreviewWaitingInput({ stepId, inputType: 'CHOICE', placeholder: 'Escolha uma opção' });
        break;

      case 'redirect':
        // Redirecionamento
        const redirectUrl = stepData.config?.url || '';
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🔀 Redirecionando para: ${redirectUrl || 'URL não configurada'}`,
          timestamp: new Date(),
        }]);
        
        const redirectNextEdge = edges.find(e => e.source === stepId);
        if (redirectNextEdge) {
          setTimeout(() => {
            executePreviewStep(redirectNextEdge.target);
          }, 500);
        }
        break;

      case 'script':
        // Executar script
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `⚙️ Executando script... (simulado em preview)`,
          timestamp: new Date(),
        }]);
        
        const scriptNextEdge = edges.find(e => e.source === stepId);
        if (scriptNextEdge) {
          setTimeout(() => {
            executePreviewStep(scriptNextEdge.target);
          }, 500);
        }
        break;

      case 'wait':
        // Aguardar
        const waitMessage = stepData.config?.message || 'Aguardando...';
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `⏸️ ${waitMessage}`,
          timestamp: new Date(),
        }]);
        
        const waitTime = stepData.config?.waitTime || 1000;
        setTimeout(() => {
          const waitNextEdge = edges.find(e => e.source === stepId);
          if (waitNextEdge) {
            executePreviewStep(waitNextEdge.target);
          }
        }, waitTime);
        break;

      case 'typebotLink':
        // Link para outro bot
        const linkedBotId = stepData.config?.botId || '';
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🔗 Chamando bot: ${linkedBotId || 'ID não configurado'} (simulado em preview)`,
          timestamp: new Date(),
        }]);
        
        const linkNextEdge = edges.find(e => e.source === stepId);
        if (linkNextEdge) {
          setTimeout(() => {
            executePreviewStep(linkNextEdge.target);
          }, 500);
        }
        break;

      case 'jump':
        // Pular para step específico
        const targetStepId = stepData.config?.targetStepId || '';
        if (targetStepId) {
          setPreviewMessages(prev => [...prev, {
            type: 'bot',
            content: `↷ Pulando para: ${targetStepId.substring(0, 20)}...`,
            timestamp: new Date(),
          }]);
          setTimeout(() => {
            executePreviewStep(targetStepId);
          }, 500);
        }
        break;

      case 'end':
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: '🏁 Fim do fluxo',
          timestamp: new Date(),
        }]);
        setPreviewCurrentStepId(null);
        break;

      default:
        // Ir para o próximo step
        const defaultNextEdge = edges.find(e => e.source === stepId);
        if (defaultNextEdge) {
          setTimeout(() => {
            executePreviewStep(defaultNextEdge.target);
          }, 500);
        }
    }
  }, [nodes, edges, parsePreviewVariables]);

  const handlePreviewInput = (input: string) => {
    if (!previewWaitingInput) return;

    setPreviewMessages(prev => [...prev, {
      type: 'user',
      content: input,
      timestamp: new Date(),
    }]);

    const node = nodes.find(n => n.id === previewWaitingInput.stepId);
    if (!node) return;

    const stepType = node.type;
    const stepData = node.data;

    if (stepType === 'input' || stepType === 'emailInput' || stepType === 'numberInput' || 
        stepType === 'phoneInput' || stepType === 'dateInput' || stepType === 'fileUpload') {
      // Salvar input em variável se configurado
      const variableName = stepData.config?.variableName;
      if (variableName) {
        setPreviewContext(prev => ({ ...prev, [variableName]: input }));
      }
      
      // Ir para o próximo step
      const nextEdge = edges.find(e => e.source === previewWaitingInput.stepId);
      if (nextEdge) {
        setPreviewWaitingInput(null);
        setPreviewInputValue('');
        setTimeout(() => {
          executePreviewStep(nextEdge.target);
        }, 500);
      }
    } else if (stepType === 'pictureChoice') {
      // Processar escolha de imagem
      const choiceIndex = parseInt(input) - 1;
      const choices = stepData.config?.choices || [];
      const selectedChoice = choices[choiceIndex];
      
      if (selectedChoice) {
        const variableName = stepData.config?.variableName;
        if (variableName) {
          setPreviewContext(prev => ({ ...prev, [variableName]: selectedChoice.value || selectedChoice.title }));
        }
        
        setPreviewWaitingInput(null);
        setPreviewInputValue('');
        const nextEdge = edges.find(e => e.source === previewWaitingInput.stepId);
        if (nextEdge) {
          setTimeout(() => {
            executePreviewStep(nextEdge.target);
          }, 500);
        }
      }
    } else if (stepType === 'condition') {
      // Processar escolha da condição
      const isTrue = input.toLowerCase().includes('sim') || input.toLowerCase().includes('true') || input === '1';
      const nextEdge = edges.find(e => 
        e.source === previewWaitingInput.stepId && 
        ((isTrue && e.sourceHandle === 'true') || (!isTrue && e.sourceHandle === 'false'))
      );
      
      if (nextEdge) {
        setPreviewWaitingInput(null);
        setPreviewInputValue('');
        setTimeout(() => {
          executePreviewStep(nextEdge.target);
        }, 500);
      }
    } else if (stepType === 'message' && stepData.buttons) {
      // Processar escolha de botão
      const buttonIndex = parseInt(input) - 1;
      const selectedButton = stepData.buttons[buttonIndex];
      
      if (selectedButton) {
        setPreviewWaitingInput(null);
        setPreviewInputValue('');
        // Ir para o próximo step (conexão baseada no botão)
        const nextEdge = edges.find(e => e.source === previewWaitingInput.stepId);
        if (nextEdge) {
          setTimeout(() => {
            executePreviewStep(nextEdge.target);
          }, 500);
        }
      }
    }

    setPreviewInputValue('');
  };

  const sidebarSections = [
    {
      title: 'BUBBLES',
      items: [
        { key: 'message', label: 'Texto', icon: 'chat' },
        { key: 'image', label: 'Imagem', icon: 'image' },
        { key: 'video', label: 'Video', icon: 'videocam' },
        { key: 'embed', label: 'Embed', icon: 'code' },
        { key: 'audio', label: 'Audio', icon: 'graphic_eq' },
      ],
    },
    {
      title: 'ENTRADAS',
      items: [
        { key: 'input', label: 'Texto Livre', icon: 'edit_note' },
        { key: 'emailInput', label: 'E-mail', icon: 'mail' },
        { key: 'numberInput', label: 'Numero', icon: 'tag' },
        { key: 'phoneInput', label: 'Telefone', icon: 'call' },
        { key: 'dateInput', label: 'Data', icon: 'calendar_month' },
        { key: 'fileUpload', label: 'Arquivo', icon: 'upload_file' },
        { key: 'pictureChoice', label: 'Escolha com Imagem', icon: 'photo_library' },
      ],
    },
    {
      title: 'LOGICA',
      items: [
        { key: 'condition', label: 'Condição', icon: 'alt_route' },
        { key: 'httpRequest', label: 'Webhook', icon: 'language' },
        { key: 'handoff', label: 'Handoff', icon: 'support_agent' },
        { key: 'setVariable', label: 'Variável', icon: 'tune' },
        { key: 'redirect', label: 'Redirect', icon: 'open_in_new' },
        { key: 'script', label: 'Code', icon: 'terminal' },
        { key: 'typebotLink', label: 'Typebot', icon: 'link' },
        { key: 'jump', label: 'Jump', icon: 'redo' },
        { key: 'wait', label: 'Wait', icon: 'hourglass_top' },
        { key: 'delay', label: 'Delay', icon: 'timer' },
        { key: 'moveDeal', label: 'Mover lead', icon: 'move_up' },
      ],
    },
  ];

  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }

  const isMessageStepModal = true;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: '#0a1016',
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(34, 197, 94, 0.14) 1px, transparent 0)',
      backgroundSize: '24px 24px',
    }}>
      {/* Top Navigation Bar */}
      <div style={{ 
        padding: '12px 20px', 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate('/bots')}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            ← Voltar
          </button>
          <div style={{ fontSize: '14px', color: '#374151', fontWeight: 600 }}>
            Versão atual: {botMeta?.publishedVersion || '0.0'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              backgroundColor: 'white',
              color: '#111827',
              minWidth: '180px',
            }}
            title="Um bot só pode ter um fluxo (o fluxo principal)"
          >
            {selectedFlow?.name || 'Fluxo principal'}
          </div>
          <button
            onClick={() => {
              if (showPreview) {
                setShowPreview(false);
                setPreviewMessages([]);
                setPreviewCurrentStepId(null);
                setPreviewWaitingInput(null);
              } else {
                startPreview();
              }
            }}
            disabled={!selectedFlow}
            style={{
              padding: '6px 12px',
              backgroundColor: !selectedFlow ? '#9ca3af' : showPreview ? '#ef4444' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: !selectedFlow ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            {showPreview ? '⏹️ Stop' : '▶️ Preview'}
          </button>
          <button
            onClick={handlePublishBot}
            disabled={!selectedFlow || !botMeta?.hasPendingChanges}
            style={{
              padding: '6px 12px',
              backgroundColor:
                !selectedFlow || !botMeta?.hasPendingChanges ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor:
                !selectedFlow || !botMeta?.hasPendingChanges ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '600',
            }}
            title={
              botMeta?.hasPendingChanges
                ? 'Publicar mudanças do rascunho em produção'
                : 'Sem mudanças pendentes para publicar'
            }
          >
            🚀 Publicar
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Blocos (novo layout) */}
        <div
          style={{
            width: '250px',
            backgroundColor: '#111315',
            borderRight: '1px solid #1f2937',
            overflowY: 'auto',
            padding: '12px 10px',
            color: '#e5e7eb',
          }}
        >
          <div
            style={{
              border: '1px solid #1f2937',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: '#17191c',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#22c55e', fontSize: '14px' }}>✚</span>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>Flow Builder</div>
            </div>
            <div style={{ marginTop: '2px', fontSize: '11px', color: '#9ca3af' }}>v2.4 ACTIVE</div>
          </div>

          <button
            onClick={() => {
              const firstBlock = sidebarSections[0]?.items?.[0];
              if (firstBlock) {
                setSelectedBlockType(firstBlock.key);
                handleAddNode(firstBlock.key);
              }
            }}
            style={{
              width: '100%',
              border: '1px solid #374151',
              backgroundColor: '#202327',
              color: '#86efac',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              marginBottom: '14px',
            }}
          >
            + Add Block
          </button>

          {sidebarSections.map((section) => (
            <div key={section.title} style={{ marginBottom: '14px' }}>
              <div
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  padding: '0 6px',
                }}
              >
                {section.title}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {section.items.map((item) => {
                  const isActive = selectedBlockType === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setSelectedBlockType(item.key);
                        handleAddNode(item.key);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '9px 8px',
                        borderRadius: '6px',
                        border: isActive ? '1px solid #14532d' : '1px solid transparent',
                        backgroundColor: isActive ? 'rgba(34, 197, 94, 0.14)' : 'transparent',
                        color: isActive ? '#86efac' : '#cbd5e1',
                        cursor: 'pointer',
                        fontSize: '13px',
                        textAlign: 'left',
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ width: '16px', textAlign: 'center', opacity: 0.95, fontSize: '14px' }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas Area */}
        <div style={{ 
          flex: 1, 
          position: 'relative', 
          marginRight: showPreview ? '400px' : '0', 
          transition: 'margin-right 0.3s ease',
          backgroundColor: 'transparent',
        }}>
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
            onEdgeDoubleClick={async (event, edge) => {
              const confirmed = await confirm({
                title: 'Excluir conexão',
                message: 'Deseja excluir esta conexão?',
              });
              if (!confirmed) return;
                // Remover do backend primeiro
                const sourceNode = nodes.find(n => n.id === edge.source);
                const sourceStepId = sourceNode?.data?.stepId;
                
                if (sourceStepId && !sourceStepId.startsWith('step-') && selectedFlow) {
                  try {
                    if (sourceNode?.type === 'condition') {
                      const stepResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
                      const flow = stepResponse.data;
                      const step = flow?.steps?.find((s: any) => s.id === sourceStepId);
                      const sorted = (step?.conditions || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
                      const firstCondition = sorted[0];
                      if (firstCondition?.id) {
                        await api.put(`/api/bots/conditions/${firstCondition.id}`, {
                          condition: firstCondition.condition,
                          operator: firstCondition.operator,
                          value: firstCondition.value,
                          order: firstCondition.order,
                          trueStepId: edge.sourceHandle === 'true' ? null : firstCondition.trueStepId,
                          falseStepId: edge.sourceHandle === 'false' ? null : firstCondition.falseStepId,
                        });
                      }
                    } else if (
                      sourceNode?.type === 'message' &&
                      typeof edge.sourceHandle === 'string' &&
                      edge.sourceHandle.startsWith('btn-')
                    ) {
                      const btnIndex = Number(edge.sourceHandle.replace('btn-', ''));
                      const stepResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
                      const flow = stepResponse.data;
                      const step = flow?.steps?.find((s: any) => s.id === sourceStepId);
                      const currentButtons = Array.isArray(step?.config?.buttons)
                        ? [...step.config.buttons]
                        : [];

                      if (!Number.isNaN(btnIndex) && currentButtons[btnIndex]) {
                        currentButtons[btnIndex] = {
                          ...currentButtons[btnIndex],
                          nextStepId: null,
                        };

                        await api.put(`/api/bots/steps/${sourceStepId}`, {
                          config: {
                            ...(step?.config || {}),
                            buttons: currentButtons,
                          },
                        });
                      }
                    } else {
                      // Para outros tipos, remover nextStepId
                      await api.put(`/api/bots/steps/${sourceStepId}`, {
                        nextStepId: null,
                      });
                    }
                    
                    // Recarregar o fluxo e aplicar no canvas imediatamente
                    const flowResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
                    const updatedFlow = flowResponse.data;
                    loadFlowToCanvas(updatedFlow);
                    setSelectedFlow(updatedFlow);
                    markBotAsPending();
                  } catch (error) {
                    console.error('Erro ao remover conexão do backend:', error);
                    // Remover visualmente mesmo se falhar no backend
                    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
                  }
                } else {
                  // Remover visualmente se não tiver stepId válido
                  setEdges((eds) => eds.filter((e) => e.id !== edge.id));
                }
            }}
            nodeTypes={nodeTypes}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeDragStop={async (_, node) => {
              const stepId = node.data?.stepId;
              if (!stepId || stepId.startsWith('step-') || !selectedFlow) return;
              try {
                const currentConfig = node.data?.config || {};
                await api.put(`/api/bots/steps/${stepId}`, {
                  config: { ...currentConfig, position: node.position },
                });
              } catch (e) {
                console.error('Erro ao salvar posição do bloco:', e);
              }
            }}
            fitView
            style={{ background: 'linear-gradient(180deg, rgba(11,18,24,0.88) 0%, rgba(8,14,20,0.92) 100%)' }}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="rgba(34, 197, 94, 0.24)" />
            <Controls />
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
            className="step-config-modal"
            style={{
              backgroundColor: '#1b2128',
              padding: '30px',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid #2a3340',
              boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              .step-config-modal h2,
              .step-config-modal label,
              .step-config-modal p,
              .step-config-modal span,
              .step-config-modal small {
                color: #d1d5db !important;
              }
              .step-config-modal input[type="text"],
              .step-config-modal input[type="number"],
              .step-config-modal input[type="url"],
              .step-config-modal input[type="email"],
              .step-config-modal input[type="date"],
              .step-config-modal select,
              .step-config-modal textarea {
                background-color: #0f1419 !important;
                color: #e5e7eb !important;
                border: 1px solid #2a3340 !important;
                border-radius: 6px !important;
              }
              .step-config-modal input::placeholder,
              .step-config-modal textarea::placeholder {
                color: #6b7280 !important;
              }
              .step-config-modal input[type="checkbox"] {
                accent-color: #22c55e;
              }
              .step-config-modal-content > div {
                background-color: #1f252d;
                border: 1px solid #2a3340;
                border-radius: 8px;
                padding: 12px;
              }
            `}</style>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#e5e7eb' }}>
              Editar {stepFormData.type || 'Step'}
            </h2>

            {!stepFormData.type && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>
                Erro: Tipo de step não definido. Por favor, feche e tente novamente.
              </div>
            )}

            <div className="step-config-modal-content" style={{ display: 'grid', gap: '12px' }}>
            {stepFormData.type === 'MESSAGE' && (
              <>
                <div style={{ marginBottom: '18px', color: '#e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                      Conteúdo da Mensagem
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {String(stepFormData.content || '').length} / 500
                    </div>
                  </div>
                  <textarea
                    value={stepFormData.content}
                    onChange={(e) => setStepFormData({ ...stepFormData, content: e.target.value })}
                    placeholder="Digite a mensagem que o bot enviará... Ex: Olá {{nome}}, como posso ajudar?"
                    rows={4}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #2a3340',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical',
                      backgroundColor: '#0f1419',
                      color: '#e5e7eb',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                      Variáveis Dinâmicas
                    </div>
                  </div>
                  <div style={{ padding: '10px', backgroundColor: '#1f252d', borderRadius: '8px', border: '1px solid #2a3340' }}>
                    {availableVariables.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {availableVariables.map((varName) => (
                            <button
                              key={varName}
                              type="button"
                              onClick={() => {
                                const textarea = document.querySelector('textarea[placeholder*="mensagem"]') as HTMLTextAreaElement;
                                if (textarea) {
                                  const start = textarea.selectionStart;
                                  const end = textarea.selectionEnd;
                                  const text = stepFormData.content;
                                  const newText = text.substring(0, start) + `{{${varName}}}` + text.substring(end);
                                  setStepFormData({ ...stepFormData, content: newText });
                                  // Reposicionar cursor após inserção
                                  setTimeout(() => {
                                    textarea.focus();
                                    textarea.setSelectionRange(start + varName.length + 4, start + varName.length + 4);
                                  }, 0);
                                } else {
                                  setStepFormData({ ...stepFormData, content: stepFormData.content + `{{${varName}}}` });
                                }
                              }}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: 'rgba(34, 197, 94, 0.14)',
                                color: '#86efac',
                                border: '1px solid #1f6d46',
                                borderRadius: '999px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '500',
                              }}
                              title={`Inserir {{${varName}}}`}
                            >
                              {'{{'}{varName}{'}}'}
                            </button>
                          ))}
                          <button
                            type="button"
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#2a2f37',
                              color: '#cbd5e1',
                              border: '1px solid #3b4452',
                              borderRadius: '999px',
                              fontSize: '11px',
                            }}
                          >
                            + Customizada
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                        Nenhuma variável disponível
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <div style={{
                    marginBottom: '12px',
                    padding: '10px',
                    backgroundColor: '#1f252d',
                    borderRadius: '8px',
                    border: '1px solid #2a3340',
                  }}>
                    <div style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Tipo de Interação
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[
                        { id: 'buttons', label: 'Botões' },
                        { id: 'list', label: 'Lista' },
                      ].map((option) => {
                        const selected = (stepFormData.config?.interactiveType || 'buttons') === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              setStepFormData({
                                ...stepFormData,
                                config: { ...stepFormData.config, interactiveType: option.id },
                              })
                            }
                            style={{
                              padding: '6px 10px',
                              backgroundColor: selected ? 'rgba(34, 197, 94, 0.16)' : '#0f1419',
                              color: selected ? '#86efac' : '#cbd5e1',
                              border: selected ? '1px solid #1f6d46' : '1px solid #2a3340',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(stepFormData.config?.interactiveType || 'buttons') === 'list' && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '10px',
                      backgroundColor: '#1f252d',
                      borderRadius: '8px',
                      border: '1px solid #2a3340',
                      display: 'grid',
                      gap: '8px',
                    }}>
                      <div style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                        Configuração da Lista
                      </div>
                      <input
                        type="text"
                        value={stepFormData.config?.listButtonText || ''}
                        onChange={(e) =>
                          setStepFormData({
                            ...stepFormData,
                            config: { ...stepFormData.config, listButtonText: e.target.value },
                          })
                        }
                        placeholder="Texto do botão da lista (ex: Ver opções)"
                        style={{ padding: '8px', border: '1px solid #2a3340', borderRadius: '6px', fontSize: '13px', backgroundColor: '#0f1419', color: '#e5e7eb' }}
                      />
                      <input
                        type="text"
                        value={stepFormData.config?.listSectionTitle || ''}
                        onChange={(e) =>
                          setStepFormData({
                            ...stepFormData,
                            config: { ...stepFormData.config, listSectionTitle: e.target.value },
                          })
                        }
                        placeholder="Título da seção (ex: Opções)"
                        style={{ padding: '8px', border: '1px solid #2a3340', borderRadius: '6px', fontSize: '13px', backgroundColor: '#0f1419', color: '#e5e7eb' }}
                      />
                      <input
                        type="text"
                        value={stepFormData.config?.listHeaderText || ''}
                        onChange={(e) =>
                          setStepFormData({
                            ...stepFormData,
                            config: { ...stepFormData.config, listHeaderText: e.target.value },
                          })
                        }
                        placeholder="Cabeçalho (opcional)"
                        style={{ padding: '8px', border: '1px solid #2a3340', borderRadius: '6px', fontSize: '13px', backgroundColor: '#0f1419', color: '#e5e7eb' }}
                      />
                      <input
                        type="text"
                        value={stepFormData.config?.listFooterText || ''}
                        onChange={(e) =>
                          setStepFormData({
                            ...stepFormData,
                            config: { ...stepFormData.config, listFooterText: e.target.value },
                          })
                        }
                        placeholder="Rodapé (opcional)"
                        style={{ padding: '8px', border: '1px solid #2a3340', borderRadius: '6px', fontSize: '13px', backgroundColor: '#0f1419', color: '#e5e7eb' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                      {(stepFormData.config?.interactiveType || 'buttons') === 'list' ? 'Opções da Lista' : 'Botões de Resposta'}
                    </label>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {stepFormData.buttons.length} de {(stepFormData.config?.interactiveType || 'buttons') === 'list' ? '10 opções' : '3 botões'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const isListMode = (stepFormData.config?.interactiveType || 'buttons') === 'list';
                        const maxItems = isListMode ? 10 : 3;
                        if (stepFormData.buttons.length >= maxItems) return;
                        setStepFormData({
                          ...stepFormData,
                          buttons: [
                            ...stepFormData.buttons,
                            isListMode
                              ? { text: '', description: '', section: stepFormData.config?.listSectionTitle || 'Opções', action: '', nextStepId: '' }
                              : { text: '', action: '', nextStepId: '' },
                          ],
                        });
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'transparent',
                        color: '#4ade80',
                        border: '1px dashed #2f855a',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      + {(stepFormData.config?.interactiveType || 'buttons') === 'list' ? 'Adicionar Opção' : 'Adicionar Botão'}
                    </button>
                  </div>
                  
                  {stepFormData.buttons.map((button, index) => (
                    <div key={index} style={{ 
                      marginBottom: '8px',
                      padding: '10px',
                      backgroundColor: '#1f252d',
                      borderRadius: '8px',
                      border: '1px solid #2a3340',
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
                            border: '1px solid #2a3340',
                            borderRadius: '6px',
                            fontSize: '13px',
                            backgroundColor: '#0f1419',
                            color: '#e5e7eb',
                          }}
                        />
                        {(stepFormData.config?.interactiveType || 'buttons') === 'list' && (
                          <input
                            type="text"
                            value={button.description || ''}
                            onChange={(e) => {
                              const newButtons = [...stepFormData.buttons];
                              newButtons[index].description = e.target.value;
                              setStepFormData({ ...stepFormData, buttons: newButtons });
                            }}
                            placeholder="Descrição (opcional)"
                            style={{
                              flex: 1,
                              padding: '8px',
                              border: '1px solid #2a3340',
                              borderRadius: '6px',
                              fontSize: '13px',
                              backgroundColor: '#0f1419',
                              color: '#e5e7eb',
                            }}
                          />
                        )}
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
                      {(stepFormData.config?.interactiveType || 'buttons') === 'list' && (
                        <input
                          type="text"
                          value={button.section || ''}
                          onChange={(e) => {
                            const newButtons = [...stepFormData.buttons];
                            newButtons[index].section = e.target.value;
                            setStepFormData({ ...stepFormData, buttons: newButtons });
                          }}
                          placeholder="Seção (opcional, ex: Financeiro)"
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #2a3340',
                            borderRadius: '6px',
                            fontSize: '13px',
                            backgroundColor: '#0f1419',
                            color: '#e5e7eb',
                            marginBottom: '6px',
                          }}
                        />
                      )}
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>
                        Conecte o bloco destino pelo handle lateral.
                      </div>
                    </div>
                  ))}
                  
                  {stepFormData.buttons.length === 0 && (
                    <div style={{ 
                      padding: '12px',
                      backgroundColor: '#1f252d',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#9ca3af',
                      border: '1px solid #2a3340',
                    }}>
                      {(stepFormData.config?.interactiveType || 'buttons') === 'list'
                        ? 'Adicione opções para criar uma lista interativa no WhatsApp Oficial.'
                        : 'Adicione botões para criar caminhos diferentes no fluxo.'}
                    </div>
                  )}
                </div>
              </>
            )}

            {stepFormData.type === 'HANDOFF' && (
              <>
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#fef3c7', borderRadius: '6px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#92400e' }}>
                    👤 Transferência para humano
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>
                    Você pode transferir para um único usuário ou distribuir em <strong>Round Robin</strong> entre vários usuários.
                  </p>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                    Modo de distribuição
                  </label>
                  <select
                    value={stepFormData.config?.mode || 'single'}
                    onChange={(e) =>
                      setStepFormData({
                        ...stepFormData,
                        config: {
                          ...stepFormData.config,
                          mode: e.target.value,
                        },
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                    }}
                  >
                    <option value="single">Usuário específico</option>
                    <option value="ROUND_ROBIN">Round Robin entre vários usuários</option>
                  </select>
                </div>

                {(!stepFormData.config?.mode || stepFormData.config?.mode === 'single') && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                      Usuário de destino
                    </label>
                    <select
                      value={stepFormData.config?.userId || ''}
                      onChange={(e) =>
                        setStepFormData({
                          ...stepFormData,
                          config: {
                            ...stepFormData.config,
                            userId: e.target.value || null,
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Selecione um usuário</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.email ? `(${u.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {stepFormData.config?.mode === 'ROUND_ROBIN' && (
                  <>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                        Usuários da fila Round Robin
                      </label>
                      <div
                        style={{
                          maxHeight: '220px',
                          overflowY: 'auto',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          padding: '8px',
                          backgroundColor: '#f9fafb',
                        }}
                      >
                        {users.length === 0 && (
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            Nenhum usuário carregado. Verifique a página de usuários.
                          </div>
                        )}
                        {users.map((u) => {
                          const selectedIds: string[] = Array.isArray(stepFormData.config?.userIds)
                            ? stepFormData.config.userIds
                            : [];
                          const checked = selectedIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '13px',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                backgroundColor: checked ? '#eef2ff' : 'transparent',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const current: string[] = Array.isArray(stepFormData.config?.userIds)
                                    ? [...stepFormData.config.userIds]
                                    : [];
                                  let next: string[];
                                  if (e.target.checked) {
                                    next = current.includes(u.id) ? current : [...current, u.id];
                                  } else {
                                    next = current.filter((id) => id !== u.id);
                                  }
                                  setStepFormData({
                                    ...stepFormData,
                                    config: {
                                      ...stepFormData.config,
                                      userIds: next,
                                    },
                                  });
                                }}
                              />
                              <span>
                                {u.name}
                                {u.email ? (
                                  <span style={{ fontSize: '11px', color: '#6b7280' }}> - {u.email}</span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <p style={{ marginTop: '6px', fontSize: '11px', color: '#6b7280' }}>
                        A conversa será distribuída ciclicamente entre os usuários selecionados.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {stepFormData.type === 'MOVE_DEAL' && (
              <>
                <div
                  style={{
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: '#ecfeff',
                    borderRadius: '6px',
                    border: '1px solid #a5f3fc',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '6px',
                      color: '#0f766e',
                    }}
                  >
                    📦 Mover lead entre funis e colunas
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#0f766e' }}>
                    Este bloco move o negócio ligado à conversa para outro funil/coluna do pipeline.
                  </p>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                    }}
                  >
                    Funil de destino
                  </label>
                  <select
                    value={stepFormData.config?.pipelineId || ''}
                    onChange={(e) => {
                      const pipelineId = e.target.value || '';
                      const pipeline = pipelines.find((p) => p.id === pipelineId);
                      setStepFormData({
                        ...stepFormData,
                        config: {
                          ...stepFormData.config,
                          pipelineId,
                          pipelineName: pipeline?.name || '',
                          stageId: '',
                          stageName: '',
                        },
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Manter funil atual</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                    }}
                  >
                    Coluna (etapa) de destino
                  </label>
                  <select
                    value={stepFormData.config?.stageId || ''}
                    onChange={(e) => {
                      const stageId = e.target.value || '';
                      const pipelineId = stepFormData.config?.pipelineId;
                      const pipeline = pipelines.find((p) => p.id === pipelineId) || pipelines.find((p) =>
                        p.stages?.some((s: any) => s.id === stageId),
                      );
                      const stage =
                        pipeline?.stages?.find((s: any) => s.id === stageId) || undefined;
                      setStepFormData({
                        ...stepFormData,
                        config: {
                          ...stepFormData.config,
                          stageId,
                          stageName: stage?.name || '',
                        },
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Manter coluna atual</option>
                    {(pipelines.find((p) => p.id === stepFormData.config?.pipelineId)?.stages ||
                      []).map((stage: any) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <p style={{ marginTop: '6px', fontSize: '11px', color: '#6b7280' }}>
                    Se você escolher apenas o funil, o sistema moverá o lead para a primeira etapa
                    ativa desse funil.
                  </p>
                </div>
              </>
            )}

            {stepFormData.type === 'CONDITION' && (
              <div style={{ marginBottom: '15px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Combinar condições</label>
                  <select
                    value={stepFormData.config.logicOperator || 'AND'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, logicOperator: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '12px',
                    }}
                  >
                    <option value="AND">E (todas as condições devem ser verdadeiras)</option>
                    <option value="OR">OU (qualquer condição verdadeira)</option>
                  </select>
                </div>
                <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>Condições</div>
                {(stepFormData.config.conditionsList || []).map((cond: any, idx: number) => (
                  <div
                    key={cond.id || `new-${idx}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr auto',
                      gap: '8px',
                      alignItems: 'end',
                      marginBottom: '10px',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>Variável</label>
                      <select
                        value={cond.condition || 'message.content'}
                        onChange={(e) => {
                          const list = [...(stepFormData.config.conditionsList || [])];
                          list[idx] = { ...list[idx], condition: e.target.value };
                          setStepFormData({
                            ...stepFormData,
                            config: { ...stepFormData.config, conditionsList: list },
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '5px',
                          fontSize: '12px',
                        }}
                        title="Selecione a variável cujo resultado será comparado no campo Valor"
                      >
                        <option value="message.content">Mensagem do usuário</option>
                        {(availableVariables || []).map((name: string) => (
                          <option key={name} value={`context.${name}`}>{name}</option>
                        ))}
                      </select>
                      {(!availableVariables || availableVariables.length === 0) && (
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                          Para listar variáveis: crie em Configurações do bot ou use blocos de Entrada que salvam em variável.
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>Operador</label>
                      <select
                        value={cond.operator || 'CONTAINS'}
                        onChange={(e) => {
                          const list = [...(stepFormData.config.conditionsList || [])];
                          list[idx] = { ...list[idx], operator: e.target.value };
                          setStepFormData({
                            ...stepFormData,
                            config: { ...stepFormData.config, conditionsList: list },
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
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
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>Valor para comparar</label>
                      <input
                        type="text"
                        value={cond.value || ''}
                        onChange={(e) => {
                          const list = [...(stepFormData.config.conditionsList || [])];
                          list[idx] = { ...list[idx], value: e.target.value };
                          setStepFormData({
                            ...stepFormData,
                            config: { ...stepFormData.config, conditionsList: list },
                          });
                        }}
                        placeholder="Ex: preço, sim, 100"
                        title="Valor com o qual o resultado da variável será comparado"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '5px',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = (stepFormData.config.conditionsList || []).filter((_: any, i: number) => i !== idx);
                        setStepFormData({
                          ...stepFormData,
                          config: { ...stepFormData.config, conditionsList: list.length ? list : [{ id: null, condition: 'message.content', operator: 'CONTAINS', value: '' }] },
                        });
                      }}
                      style={{
                        padding: '6px 10px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                      title="Remover condição"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const list = [...(stepFormData.config.conditionsList || []), { id: null, condition: 'message.content', operator: 'CONTAINS', value: '' }];
                    setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, conditionsList: list },
                    });
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  + Adicionar condição
                </button>
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
                          const response = await api.post('/api/bots/http-test', {
                            config: stepFormData.config,
                          });

                          const data = response.data?.data ?? null;

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
                                      onDelete: node.data.onDelete || handleDeleteNode,
                                      onRequestDelete: node.data.onRequestDelete || requestNodeDelete,
                                    },
                                  }
                                : node
                            )
                          );

                          alert('Requisição testada com sucesso! Veja o preview abaixo.');
                        } catch (error: any) {
                          const msg = error.response?.data?.error || error.message || 'Erro desconhecido';
                          alert('Erro ao testar requisição: ' + msg);
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

            {stepFormData.type === 'IMAGE' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Imagem do bubble *
                  </label>
                  {/* Upload de arquivo de imagem */}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      try {
                        setUploadingImage(true);
                        const formData = new FormData();
                        formData.append('file', file);

                        const uploadResponse = await api.post('/api/media/upload', formData, {
                          headers: {
                            'Content-Type': 'multipart/form-data',
                          },
                        });

                        const { url } = uploadResponse.data;

                        setStepFormData((prev) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            imageUrl: url,
                          },
                        }));
                      } catch (error) {
                        console.error('Erro ao fazer upload da imagem do bot:', error);
                        alert('Erro ao enviar imagem. Tente novamente.');
                      } finally {
                        setUploadingImage(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      marginBottom: '10px',
                    }}
                  />
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    Você pode enviar um arquivo de imagem do seu computador. O sistema irá gerar a URL automaticamente.
                  </p>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    URL da Imagem (opcional)
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.imageUrl || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, imageUrl: e.target.value },
                    })}
                    placeholder="https://exemplo.com/imagem.jpg ou /api/media/file/xxx.jpg"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  {uploadingImage && (
                    <p style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                      Enviando imagem...
                    </p>
                  )}
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Texto Alternativo (Alt Text)
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.altText || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, altText: e.target.value },
                    })}
                    placeholder="Descrição da imagem"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Ação ao Clicar
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.clickAction || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, clickAction: e.target.value },
                    })}
                    placeholder="URL para abrir ao clicar (opcional)"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </>
            )}

            {stepFormData.type === 'VIDEO' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Vídeo do bubble *
                  </label>
                  {/* Upload de arquivo de vídeo */}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      try {
                        setUploadingVideo(true);
                        const formData = new FormData();
                        formData.append('file', file);

                        const uploadResponse = await api.post('/api/media/upload', formData, {
                          headers: {
                            'Content-Type': 'multipart/form-data',
                          },
                        });

                        const { url } = uploadResponse.data;

                        setStepFormData((prev) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            videoUrl: url,
                          },
                        }));
                      } catch (error) {
                        console.error('Erro ao fazer upload do vídeo do bot:', error);
                        alert('Erro ao enviar vídeo. Tente novamente.');
                      } finally {
                        setUploadingVideo(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      marginBottom: '10px',
                    }}
                  />
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    Você pode enviar um arquivo de vídeo do seu computador. O sistema irá gerar a URL automaticamente.
                  </p>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    URL do Vídeo (opcional)
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.videoUrl || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, videoUrl: e.target.value },
                    })}
                    placeholder="https://exemplo.com/video.mp4 ou /api/media/file/xxx.mp4"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  {uploadingVideo && (
                    <p style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                      Enviando vídeo...
                    </p>
                  )}
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Plataforma
                  </label>
                  <select
                    value={stepFormData.config.platform || 'youtube'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, platform: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="youtube">YouTube</option>
                    <option value="vimeo">Vimeo</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stepFormData.config.autoplay || false}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, autoplay: e.target.checked },
                      })}
                    />
                    <span style={{ fontSize: '14px' }}>Reproduzir automaticamente</span>
                  </label>
                </div>
              </>
            )}

            {stepFormData.type === 'AUDIO' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Áudio do bubble *
                  </label>
                  {/* Upload de arquivo de áudio */}
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      try {
                        // Podemos reutilizar o mesmo indicador de upload de imagem,
                        // ou criar um específico caso queira diferenciar depois.
                        setUploadingImage(true);
                        const formData = new FormData();
                        formData.append('file', file);

                        const uploadResponse = await api.post('/api/media/upload', formData, {
                          headers: {
                            'Content-Type': 'multipart/form-data',
                          },
                        });

                        const { url } = uploadResponse.data;

                        setStepFormData((prev) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            audioUrl: url,
                          },
                        }));
                      } catch (error) {
                        console.error('Erro ao fazer upload do áudio do bot:', error);
                        alert('Erro ao enviar áudio. Tente novamente.');
                      } finally {
                        setUploadingImage(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      marginBottom: '10px',
                    }}
                  />
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    Você pode enviar um arquivo de áudio do seu computador. O sistema irá gerar a URL automaticamente.
                  </p>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    URL do Áudio (opcional)
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.audioUrl || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, audioUrl: e.target.value },
                    })}
                    placeholder="https://exemplo.com/audio.mp3 ou /api/media/file/xxx.ogg"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  {uploadingImage && (
                    <p style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                      Enviando áudio...
                    </p>
                  )}
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stepFormData.config.autoplay || false}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, autoplay: e.target.checked },
                      })}
                    />
                    <span style={{ fontSize: '14px' }}>Reproduzir automaticamente</span>
                  </label>
                </div>
              </>
            )}

            {stepFormData.type === 'EMBED' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    URL do Embed *
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.embedUrl || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, embedUrl: e.target.value },
                    })}
                    placeholder="https://exemplo.com/embed ou código iframe"
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
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Altura (px)
                  </label>
                  <input
                    type="number"
                    value={stepFormData.config.height || 400}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, height: parseInt(e.target.value) || 400 },
                    })}
                    min="100"
                    max="1000"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Largura
                  </label>
                  <select
                    value={stepFormData.config.width || '100%'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, width: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="100%">100%</option>
                    <option value="80%">80%</option>
                    <option value="60%">60%</option>
                    <option value="400px">400px</option>
                    <option value="600px">600px</option>
                  </select>
                </div>
              </>
            )}

            {stepFormData.type === 'INPUT' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Tipo de Input
                  </label>
                  <select
                    value={stepFormData.config.inputType || 'TEXT'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, inputType: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="TEXT">Texto</option>
                    <option value="NUMBER">Número</option>
                    <option value="EMAIL">Email</option>
                    <option value="PHONE">Telefone</option>
                    <option value="DATE">Data</option>
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.placeholder || 'Digite sua resposta...'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, placeholder: e.target.value },
                    })}
                    placeholder="Ex: Digite seu nome..."
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Nome da Variável *
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.variableName || ''}
                    onChange={(e) => {
                      const varName = e.target.value.trim();
                      setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, variableName: varName },
                      });
                      // Atualizar lista de variáveis disponíveis
                      if (varName && !availableVariables.includes(varName)) {
                        setAvailableVariables([...availableVariables, varName]);
                      }
                    }}
                    placeholder="Ex: nome, livro, idade"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    💡 A resposta do cliente será salva nesta variável. Use {'{{' + (stepFormData.config.variableName || 'variavel') + '}}'} em mensagens para exibir o valor.
                  </small>
                </div>
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '5px', border: '1px solid #86efac' }}>
                  <div style={{ fontSize: '12px', color: '#166534' }}>
                    <strong>Exemplo:</strong> Se você criar uma variável chamada "Livro" e o cliente responder "três porquinhos", 
                    então a variável "Livro" terá o valor "três porquinhos" e poderá ser usada em outras mensagens como {'{{Livro}}'}.
                  </div>
                </div>
              </>
            )}

            {stepFormData.type === 'EMAIL_INPUT' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.placeholder || 'Digite seu email...'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, placeholder: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Variável para Salvar
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.variableName || ''}
                    placeholder="email"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                    onChange={(e) => {
                      const varName = e.target.value.trim();
                      setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, variableName: varName },
                      });
                      if (varName && !availableVariables.includes(varName)) {
                        setAvailableVariables([...availableVariables, varName]);
                      }
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    💡 A resposta do cliente será salva nesta variável. Use {'{{' + (stepFormData.config.variableName || 'email') + '}}'} em mensagens.
                  </small>
                </div>
              </>
            )}

            {stepFormData.type === 'NUMBER_INPUT' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.placeholder || 'Digite um número...'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, placeholder: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Valor Mínimo</label>
                    <input
                      type="number"
                      value={stepFormData.config.min || ''}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, min: e.target.value ? parseFloat(e.target.value) : null },
                      })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '5px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Valor Máximo</label>
                    <input
                      type="number"
                      value={stepFormData.config.max || ''}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, max: e.target.value ? parseFloat(e.target.value) : null },
                      })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '5px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Variável para Salvar
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.variableName || ''}
                    onChange={(e) => {
                      const varName = e.target.value.trim();
                      setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, variableName: varName },
                      });
                      // Atualizar lista de variáveis disponíveis
                      if (varName && !availableVariables.includes(varName)) {
                        setAvailableVariables([...availableVariables, varName]);
                      }
                    }}
                    placeholder="numero"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    💡 A resposta do cliente será salva nesta variável. Use {'{{' + (stepFormData.config.variableName || 'numero') + '}}'} em mensagens.
                  </small>
                </div>
              </>
            )}

            {stepFormData.type === 'PHONE_INPUT' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.placeholder || 'Digite seu telefone...'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, placeholder: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Variável para Salvar
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.variableName || ''}
                    onChange={(e) => {
                      const varName = e.target.value.trim();
                      setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, variableName: varName },
                      });
                      // Atualizar lista de variáveis disponíveis
                      if (varName && !availableVariables.includes(varName)) {
                        setAvailableVariables([...availableVariables, varName]);
                      }
                    }}
                    placeholder="telefone"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    💡 A resposta do cliente será salva nesta variável. Use {'{{' + (stepFormData.config.variableName || 'telefone') + '}}'} em mensagens.
                  </small>
                </div>
              </>
            )}

            {stepFormData.type === 'DATE_INPUT' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Label
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.label || 'Selecione uma data'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, label: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Variável para Salvar
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.variableName || ''}
                    onChange={(e) => {
                      const varName = e.target.value.trim();
                      setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, variableName: varName },
                      });
                      // Atualizar lista de variáveis disponíveis
                      if (varName && !availableVariables.includes(varName)) {
                        setAvailableVariables([...availableVariables, varName]);
                      }
                    }}
                    placeholder="data"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    💡 A resposta do cliente será salva nesta variável. Use {'{{' + (stepFormData.config.variableName || 'data') + '}}'} em mensagens.
                  </small>
                </div>
              </>
            )}

            {stepFormData.type === 'FILE_UPLOAD' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Tipos de Arquivo Aceitos
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.accept || '*/*'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, accept: e.target.value },
                    })}
                    placeholder="image/*, .pdf, .doc"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    Ex: image/*, .pdf, .doc ou */* para todos
                  </small>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Tamanho Máximo (MB)
                  </label>
                  <input
                    type="number"
                    value={stepFormData.config.maxSize || 10}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, maxSize: parseInt(e.target.value) || 10 },
                    })}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stepFormData.config.multiple || false}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, multiple: e.target.checked },
                      })}
                    />
                    <span style={{ fontSize: '14px' }}>Permitir múltiplos arquivos</span>
                  </label>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Variável para Salvar
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.variableName || ''}
                    onChange={(e) => {
                      const varName = e.target.value.trim();
                      setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, variableName: varName },
                      });
                      // Atualizar lista de variáveis disponíveis
                      if (varName && !availableVariables.includes(varName)) {
                        setAvailableVariables([...availableVariables, varName]);
                      }
                    }}
                    placeholder="arquivo"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    💡 A resposta do cliente será salva nesta variável. Use {'{{' + (stepFormData.config.variableName || 'arquivo') + '}}'} em mensagens.
                  </small>
                </div>
              </>
            )}

            {stepFormData.type === 'REDIRECT' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    URL de Redirecionamento *
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.url || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, url: e.target.value },
                    })}
                    placeholder="https://exemplo.com"
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
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stepFormData.config.openInNewTab || false}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, openInNewTab: e.target.checked },
                      })}
                    />
                    <span style={{ fontSize: '14px' }}>Abrir em nova aba</span>
                  </label>
                </div>
              </>
            )}

            {stepFormData.type === 'SCRIPT' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Código JavaScript *
                  </label>
                  <textarea
                    value={stepFormData.config.code || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, code: e.target.value },
                    })}
                    placeholder="// Seu código JavaScript aqui"
                    rows={8}
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
                    Acesso a variáveis via objeto 'variables'. Ex: variables.nome
                  </small>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Salvar Resultado em Variável (opcional)
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.saveResultInVariable || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, saveResultInVariable: e.target.value },
                    })}
                    placeholder="resultado"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </>
            )}

            {stepFormData.type === 'WAIT' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Aguardar Por
                  </label>
                  <select
                    value={stepFormData.config.waitFor || 'user'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, waitFor: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="user">Resposta do usuário</option>
                    <option value="time">Tempo específico</option>
                    <option value="event">Evento externo</option>
                  </select>
                </div>
                {stepFormData.config.waitFor === 'time' && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                      Tempo de Espera (ms)
                    </label>
                    <input
                      type="number"
                      value={stepFormData.config.waitTime || 1000}
                      onChange={(e) => setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, waitTime: parseInt(e.target.value) || 1000 },
                      })}
                      min="0"
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
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Mensagem Durante Espera
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.message || 'Aguardando...'}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, message: e.target.value },
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </>
            )}

            {stepFormData.type === 'JUMP' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '5px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                    }}
                  >
                    Bloco de destino *
                  </label>
                  <select
                    value={stepFormData.config.targetStepId || ''}
                    onChange={(e) =>
                      setStepFormData({
                        ...stepFormData,
                        config: { ...stepFormData.config, targetStepId: e.target.value },
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Selecione um bloco</option>
                    {selectedFlow?.steps?.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.type}{' '}
                        {s.response?.content
                          ? `- ${String(s.response.content).substring(0, 40)}`
                          : ''}
                      </option>
                    ))}
                    <option value="END">Fim do fluxo (END)</option>
                  </select>
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    O fluxo vai pular diretamente para o bloco selecionado quando chegar neste ponto.
                  </small>
                </div>
              </>
            )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowStepModal(false);
                  setEditingNode(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isMessageStepModal ? '#111827' : '#6b7280',
                  color: isMessageStepModal ? '#d1d5db' : 'white',
                  border: isMessageStepModal ? '1px solid #2a3340' : 'none',
                  borderRadius: '6px',
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
                  background: isMessageStepModal ? 'linear-gradient(90deg,#22c55e,#16a34a)' : '#3b82f6',
                  color: '#0b1f12',
                  border: 'none',
                  borderRadius: '6px',
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

      {/* Painel de Preview */}
      {showPreview && (
        <div
          style={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: '400px',
            backgroundColor: 'white',
            boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
          }}
        >
          {/* Header do Preview */}
          <div
            style={{
              padding: '15px',
              backgroundColor: '#3b82f6',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px' }}>🔍 Preview do Fluxo</h3>
            <button
              onClick={() => {
                setShowPreview(false);
                setPreviewMessages([]);
                setPreviewCurrentStepId(null);
                setPreviewWaitingInput(null);
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 5px',
              }}
            >
              ×
            </button>
          </div>

          {/* Área de Mensagens */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '15px',
              backgroundColor: '#f9fafb',
            }}
          >
            {previewMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '20px' }}>
                <p>Preview iniciado. Aguardando primeira mensagem...</p>
              </div>
            )}
            {previewMessages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '15px',
                  display: 'flex',
                  justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 15px',
                    borderRadius: '10px',
                    backgroundColor: msg.type === 'user' ? '#3b82f6' : '#e5e7eb',
                    color: msg.type === 'user' ? 'white' : '#1f2937',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {previewWaitingInput && (
              <div
                style={{
                  padding: '10px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '5px',
                  marginTop: '10px',
                  fontSize: '12px',
                  color: '#92400e',
                }}
              >
                ⏳ Aguardando entrada do usuário...
              </div>
            )}
          </div>

          {/* Input do Usuário */}
          {previewWaitingInput && (
            <div
              style={{
                padding: '15px',
                backgroundColor: 'white',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={previewInputValue}
                  onChange={(e) => setPreviewInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && previewInputValue.trim()) {
                      handlePreviewInput(previewInputValue);
                    }
                  }}
                  placeholder={previewWaitingInput.placeholder || 'Digite sua resposta...'}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                />
                <button
                  onClick={() => {
                    if (previewInputValue.trim()) {
                      handlePreviewInput(previewInputValue);
                    }
                  }}
                  disabled={!previewInputValue.trim()}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: previewInputValue.trim() ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: previewInputValue.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                  }}
                >
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* Informações do Contexto */}
          {Object.keys(previewContext).length > 0 && (
            <div
              style={{
                padding: '10px 15px',
                backgroundColor: '#f0f9ff',
                borderTop: '1px solid #bae6fd',
                fontSize: '12px',
              }}
            >
              <strong>Variáveis do Contexto:</strong>
              <div style={{ marginTop: '5px' }}>
                {Object.entries(previewContext).map(([key, value]) => (
                  <div key={key} style={{ marginTop: '3px' }}>
                    <code>{key}</code>: {String(value)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

