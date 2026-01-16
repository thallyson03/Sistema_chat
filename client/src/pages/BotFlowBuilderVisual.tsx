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
const MessageNode = ({ data, selected, id }: any) => {
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
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#60a5fa', width: '16px', height: '16px', border: '2px solid white' }} />
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
      <Handle type="source" position={Position.Bottom} style={{ background: '#60a5fa', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para condição
const ConditionNode = ({ data, selected, id }: any) => {
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
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#fbbf24', width: '16px', height: '16px', border: '2px solid white' }} />
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
      <Handle type="source" position={Position.Bottom} id="true" style={{ background: '#10b981', left: '25%', width: '16px', height: '16px', border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ background: '#ef4444', left: '75%', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para handoff
const HandoffNode = ({ data, selected, id }: any) => {
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
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#dc2626',
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
      <Handle type="target" position={Position.Top} style={{ background: '#f87171', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold' }}>👤 Transferir</div>
      <div style={{ fontSize: '12px', opacity: 0.9 }}>Para humano</div>
    </div>
  );
};

// Componente de nó customizado para delay
const DelayNode = ({ data, selected, id }: any) => {
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
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#9ca3af', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>⏱️ Aguardar</div>
      <div style={{ fontSize: '12px', opacity: 0.9 }}>
        {data.delay ? `${data.delay}ms` : 'Tempo'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#9ca3af', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para input
const InputNode = ({ data, selected, id }: any) => {
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
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#34d399', width: '16px', height: '16px', border: '2px solid white' }} />
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
      <Handle type="source" position={Position.Bottom} style={{ background: '#34d399', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para set variable
const SetVariableNode = ({ data, selected, id }: any) => {
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
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#a78bfa', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🔧 Definir Variável</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.variableName ? `{{${data.config.variableName}}}` : 'Nova variável'}
      </div>
      {data.config?.value && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          = {String(data.config.value).length > 30 ? String(data.config.value).substring(0, 30) + '...' : data.config.value}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#a78bfa', width: '16px', height: '16px', border: '2px solid white' }} />
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
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: 'rgba(255,255,255,0.8)', width: '16px', height: '16px', border: '2px solid #333' }} />
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
      <Handle type="source" position={Position.Bottom} style={{ background: 'rgba(255,255,255,0.8)', width: '16px', height: '16px', border: '2px solid #333' }} />
    </div>
  );
};

// Componente de nó customizado para Image
const ImageNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#ec4899',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(236, 72, 153, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #f472b6' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#f472b6', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🖼️ Imagem</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px', wordBreak: 'break-word' }}>
        {data.config?.imageUrl ? (data.config.imageUrl.length > 40 ? data.config.imageUrl.substring(0, 40) + '...' : data.config.imageUrl) : 'Nova imagem'}
      </div>
      {data.config?.altText && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          Alt: {data.config.altText}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#f472b6', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Video
const VideoNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#dc2626',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(220, 38, 38, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #f87171' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#f87171', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🎥 Vídeo</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px', wordBreak: 'break-word' }}>
        {data.config?.videoUrl ? (data.config.videoUrl.length > 40 ? data.config.videoUrl.substring(0, 40) + '...' : data.config.videoUrl) : 'Novo vídeo'}
      </div>
      {data.config?.platform && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Plataforma: {data.config.platform}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#f87171', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Audio
const AudioNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#7c3aed',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(124, 58, 237, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #a78bfa' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#a78bfa', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🎵 Áudio</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px', wordBreak: 'break-word' }}>
        {data.config?.audioUrl ? (data.config.audioUrl.length > 40 ? data.config.audioUrl.substring(0, 40) + '...' : data.config.audioUrl) : 'Novo áudio'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#a78bfa', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Embed
const EmbedNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#059669',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(5, 150, 105, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #34d399' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#34d399', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>📦 Embed</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px', wordBreak: 'break-word' }}>
        {data.config?.embedUrl ? (data.config.embedUrl.length > 40 ? data.config.embedUrl.substring(0, 40) + '...' : data.config.embedUrl) : 'Novo embed'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#34d399', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Email Input
const EmailInputNode = ({ data, selected, id }: any) => {
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
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#fbbf24', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>📧 Email</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.placeholder || 'Digite seu email...'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#fbbf24', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Number Input
const NumberInputNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#06b6d4',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(6, 182, 212, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #22d3ee' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#22d3ee', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🔢 Número</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.placeholder || 'Digite um número...'}
      </div>
      {data.config?.min !== undefined && data.config?.max !== undefined && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Min: {data.config.min} | Max: {data.config.max}
        </div>
      )}
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#22d3ee', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Phone Input
const PhoneInputNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#14b8a6',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(20, 184, 166, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #5eead4' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#5eead4', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>📱 Telefone</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.placeholder || 'Digite seu telefone...'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#5eead4', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Date Input
const DateInputNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#a855f7',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(168, 85, 247, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #c084fc' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#c084fc', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>📅 Data</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.label || 'Selecione uma data...'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#c084fc', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para File Upload
const FileUploadNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#f97316',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(249, 115, 22, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #fb923c' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#fb923c', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>📎 Upload</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.accept ? `Tipos: ${data.config.accept}` : 'Enviar arquivo...'}
      </div>
      {data.config?.maxSize && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Tamanho máx: {data.config.maxSize}MB
        </div>
      )}
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#fb923c', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Redirect
const RedirectNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#6366f1',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(99, 102, 241, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #818cf8' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#818cf8', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🔀 Redirecionar</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px', wordBreak: 'break-word' }}>
        {data.config?.url ? (data.config.url.length > 40 ? data.config.url.substring(0, 40) + '...' : data.config.url) : 'Nova URL'}
      </div>
      {data.config?.openInNewTab && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Nova aba
        </div>
      )}
    </div>
  );
};

// Componente de nó customizado para Script
const ScriptNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#1e293b',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(30, 41, 59, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #475569' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#475569', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>⚙️ Script</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.code ? (data.config.code.length > 30 ? data.config.code.substring(0, 30) + '...' : data.config.code) : 'Código JavaScript'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#475569', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Wait (diferente de Delay)
const WaitNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#64748b',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(100, 116, 139, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #94a3b8' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>⏸️ Aguardar</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.waitFor ? data.config.waitFor : 'Aguardando evento...'}
      </div>
      {data.config?.message && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          {data.config.message}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Typebot Link
const TypebotLinkNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#0ea5e9',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(14, 165, 233, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #38bdf8' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#38bdf8', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🔗 Link Bot</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.botId ? `Bot: ${data.config.botId}` : 'Selecione um bot...'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#38bdf8', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para AB Test
const ABTestNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#9333ea',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(147, 51, 234, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #a855f7' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#a855f7', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🧪 Teste A/B</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.variants ? `${data.config.variants.length} variante(s)` : '2 variantes'}
      </div>
      {data.config?.splitPercent && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Split: {data.config.splitPercent}% / {100 - data.config.splitPercent}%
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="variantA" style={{ background: '#10b981', left: '25%', width: '16px', height: '16px', border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} id="variantB" style={{ background: '#3b82f6', left: '75%', width: '16px', height: '16px', border: '2px solid white' }} />
    </div>
  );
};

// Componente de nó customizado para Jump
const JumpNode = ({ data, selected, id }: any) => {
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#eab308',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(234, 179, 8, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #facc15' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#facc15', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>↷ Pular</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {data.config?.targetStepId ? `Para: ${data.config.targetStepId.substring(0, 20)}...` : 'Selecione destino...'}
      </div>
    </div>
  );
};

// Componente de nó customizado para Picture Choice
const PictureChoiceNode = ({ data, selected, id }: any) => {
  const choices = data.config?.choices || [];
  return (
    <div
      style={{
        padding: '15px 20px',
        backgroundColor: '#be185d',
        color: 'white',
        borderRadius: '8px',
        minWidth: '200px',
        maxWidth: '300px',
        boxShadow: selected ? '0 4px 12px rgba(190, 24, 93, 0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        border: selected ? '2px solid #ec4899' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {selected && data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
              data.onDelete(id);
            }
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
      <Handle type="target" position={Position.Top} style={{ background: '#ec4899', width: '16px', height: '16px', border: '2px solid white' }} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>🖼️ Escolha com Imagem</div>
      <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>
        {choices.length > 0 ? `${choices.length} opção(ões)` : 'Nenhuma opção'}
      </div>
      {data.config?.variableName && (
        <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
          → Salvar em: {data.config.variableName}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#ec4899', width: '16px', height: '16px', border: '2px solid white' }} />
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
      <Handle type="source" position={Position.Bottom} style={{ background: '#34d399', width: '16px', height: '16px', border: '2px solid white' }} />
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
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={true}
        style={{ 
          background: '#f87171', 
          width: '20px', 
          height: '20px', 
          border: '2px solid white',
          cursor: 'crosshair',
          zIndex: 1000
        }} 
      />
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
  abTest: ABTestNode,
  jump: JumpNode,
  pictureChoice: PictureChoiceNode,
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
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<Array<{ type: 'user' | 'bot', content: string, timestamp: Date }>>([]);
  const [previewCurrentStepId, setPreviewCurrentStepId] = useState<string | null>(null);
  const [previewContext, setPreviewContext] = useState<Record<string, any>>({});
  const [previewWaitingInput, setPreviewWaitingInput] = useState<{ stepId: string, inputType: string, placeholder?: string } | null>(null);
  const [previewInputValue, setPreviewInputValue] = useState('');
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);

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
  }, []);

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
              if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
                handleDeleteNode(nodeToDelete.id);
              }
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showStepModal, handleDeleteNode]);

  const loadFlowToCanvas = useCallback((flow: Flow) => {
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
                         step.type === 'AB_TEST' ? 'abTest' :
                         step.type === 'JUMP' ? 'jump' :
                         step.type === 'PICTURE_CHOICE' ? 'pictureChoice' : 'message';

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
            config: step.config || {},
            onDelete: handleDeleteNode,
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
          // Se nextStepId for "END", criar edge para o nó "end"
          if (step.nextStepId === 'END') {
            newEdges.push({
              id: `${step.id}-end`,
              source: step.id,
              target: 'end',
            });
          } else {
            // Caso contrário, criar edge para o step correspondente
            newEdges.push({
              id: `${step.id}-${step.nextStepId}`,
              source: step.id,
              target: step.nextStepId,
            });
          }
        }

        // Conexões de condição
        if (step.conditions && step.conditions.length > 0) {
          const condition = step.conditions[0];
          if (condition.trueStepId) {
            // Se trueStepId for "END", criar edge para o nó "end"
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
            // Se falseStepId for "END", criar edge para o nó "end"
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
  }, [handleDeleteNode]);

  useEffect(() => {
    if (selectedFlow) {
      // Recarregar o fluxo do backend para garantir que temos os dados mais recentes
      const reloadFlow = async () => {
        try {
          const response = await api.get(`/api/bots/flows/${selectedFlow.id}`);
          const updatedFlow = response.data;
          loadFlowToCanvas(updatedFlow);
        } catch (error) {
          console.error('Erro ao recarregar fluxo:', error);
          // Se falhar, usar o fluxo que já temos
          loadFlowToCanvas(selectedFlow);
        }
      };
      reloadFlow();
    }
  }, [selectedFlow, loadFlowToCanvas]);

  const onConnect = useCallback(
    async (params: Connection) => {
      console.log('🔌 onConnect chamado:', params);
      
      // Adicionar label baseado no tipo de conexão
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      console.log('📦 sourceNode:', sourceNode);
      console.log('📦 targetNode:', targetNode);
      
      // Ignorar apenas conexões do start (não tem stepId)
      // Permitir conexões para o end
      if (params.source === 'start') {
        console.log('⚠️ Ignorando conexão do start');
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
          
          // Salvar trueStepId na condição
          try {
            // Buscar step para verificar condições existentes
            const stepResponse = await api.get(`/api/bots/flows/${selectedFlow?.id}`);
            const flow = stepResponse.data;
            const step = flow?.steps?.find((s: any) => s.id === sourceStepId);
            const existingCondition = step?.conditions?.[0];
            
            // Se o destino for "end", usar "END" como valor especial
            const finalTrueStepId = params.target === 'end' ? 'END' : targetStepId;
            
            // Criar ou atualizar condição (o backend faz upsert)
            await api.post(`/api/bots/steps/${sourceStepId}/conditions`, {
              condition: existingCondition?.condition || 'message.content',
              operator: existingCondition?.operator || 'CONTAINS',
              value: existingCondition?.value || '',
              trueStepId: finalTrueStepId,
              falseStepId: existingCondition?.falseStepId || null,
            });
          } catch (error) {
            console.error('Erro ao salvar conexão de condição (true):', error);
          }
        } else if (params.sourceHandle === 'false') {
          label = 'Não';
          edgeStyle = { stroke: '#ef4444', strokeWidth: 2 };
          labelColor = '#ef4444';
          
          // Salvar falseStepId na condição
          try {
            // Buscar step para verificar condições existentes
            const stepResponse = await api.get(`/api/bots/flows/${selectedFlow?.id}`);
            const flow = stepResponse.data;
            const step = flow?.steps?.find((s: any) => s.id === sourceStepId);
            const existingCondition = step?.conditions?.[0];
            
            // Se o destino for "end", usar "END" como valor especial
            const finalFalseStepId = params.target === 'end' ? 'END' : targetStepId;
            
            // Criar ou atualizar condição (o backend faz upsert)
            await api.post(`/api/bots/steps/${sourceStepId}/conditions`, {
              condition: existingCondition?.condition || 'message.content',
              operator: existingCondition?.operator || 'CONTAINS',
              value: existingCondition?.value || '',
              trueStepId: existingCondition?.trueStepId || null,
              falseStepId: finalFalseStepId,
            });
          } catch (error) {
            console.error('Erro ao salvar conexão de condição (false):', error);
          }
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
        } catch (error) {
          console.error('❌ Erro ao salvar conexão:', error);
        }
        
        if (sourceNode?.type === 'message' && sourceNode.data.buttons) {
          // Se for uma mensagem com botões, usar o texto do botão
          const buttonIndex = edges.filter(e => e.source === params.source).length;
          if (sourceNode.data.buttons[buttonIndex]) {
            label = sourceNode.data.buttons[buttonIndex].text;
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
      
      // Recarregar o fluxo para garantir que as conexões sejam salvas
      if (selectedFlow) {
        try {
          const flowResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
          const updatedFlow = flowResponse.data;
          setSelectedFlow(updatedFlow);
          // loadFlowToCanvas será chamado automaticamente pelo useEffect
        } catch (error) {
          console.error('Erro ao recarregar fluxo:', error);
        }
      }
    },
    [edges, nodes, selectedFlow]
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
        case 'abTest':
          return { variants: [{ percent: 50, blockId: '' }, { percent: 50, blockId: '' }], splitPercent: 50 };
        case 'jump':
          return { targetStepId: '' };
        case 'pictureChoice':
          return { choices: [], variableName: '', multiple: false, layout: 'grid' };
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

      // Criar ou atualizar resposta se for tipo MESSAGE ou mídia
      let responseId = null;
      if (stepFormData.type === 'MESSAGE' && stepFormData.content) {
        try {
          const response = await api.post('/api/bots/responses', {
            type: 'TEXT',
            content: stepFormData.content,
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
      } else if (stepFormData.type === 'IMAGE' && stepFormData.config?.imageUrl) {
        try {
          const response = await api.post('/api/bots/responses', {
            type: 'IMAGE',
            content: stepFormData.config.altText || '',
            mediaUrl: stepFormData.config.imageUrl,
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
      } else if (stepFormData.type === 'VIDEO' && stepFormData.config?.videoUrl) {
        try {
          const response = await api.post('/api/bots/responses', {
            type: 'VIDEO',
            content: '',
            mediaUrl: stepFormData.config.videoUrl,
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
      } else if (stepFormData.type === 'AUDIO' && stepFormData.config?.audioUrl) {
        try {
          const response = await api.post('/api/bots/responses', {
            type: 'AUDIO',
            content: '',
            mediaUrl: stepFormData.config.audioUrl,
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
                  onDelete: node.data.onDelete || handleDeleteNode,
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

      case 'abTest':
        // Teste A/B
        const splitPercent = stepData.config?.splitPercent || 50;
        setPreviewMessages(prev => [...prev, {
          type: 'bot',
          content: `🧪 Teste A/B: ${splitPercent}% / ${100 - splitPercent}% (simulado)`,
          timestamp: new Date(),
        }]);
        
        // Escolher variante aleatoriamente
        const random = Math.random() * 100;
        const selectedVariant = random < splitPercent ? 'variantA' : 'variantB';
        const abEdge = edges.find(e => e.source === stepId && e.sourceHandle === selectedVariant);
        if (abEdge) {
          setTimeout(() => {
            executePreviewStep(abEdge.target);
          }, 500);
        } else {
          const abDefaultEdge = edges.find(e => e.source === stepId);
          if (abDefaultEdge) {
            setTimeout(() => {
              executePreviewStep(abDefaultEdge.target);
            }, 500);
          }
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

  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: '#ff6b35', // Fundo laranja similar ao Typebot
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.15) 1px, transparent 0)',
      backgroundSize: '20px 20px',
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
          <div style={{ 
            padding: '6px 12px', 
            backgroundColor: '#3b82f6', 
            color: 'white', 
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '14px',
          }}>
            Bot Flow Builder
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
              }}
            >
              Flow
            </button>
            <button
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Theme
            </button>
            <button
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Settings
            </button>
            <button
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Share
            </button>
            <button
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Results
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={selectedFlow?.id || ''}
            onChange={(e) => {
              const flow = flows.find(f => f.id === e.target.value);
              setSelectedFlow(flow || null);
            }}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              backgroundColor: 'white',
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
              padding: '6px 12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            + Novo
          </button>
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
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Element Palette */}
        <div style={{
          width: '280px',
          backgroundColor: '#f9fafb',
          borderRight: '1px solid #e5e7eb',
          overflowY: 'auto',
          padding: '15px',
        }}>
          {/* Header da Sidebar */}
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => navigate('/bots')}
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: '10px',
              }}
            >
              ←
            </button>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '5px' }}>
              {selectedFlow?.name || 'Selecione um fluxo'}
            </div>
            <button
              onClick={() => setShowFlowModal(true)}
              style={{
                padding: '4px 8px',
                backgroundColor: 'transparent',
                color: '#3b82f6',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              + Criar novo fluxo
            </button>
          </div>

          {/* Bubbles Section */}
          <div style={{ marginBottom: '25px' }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: '600', 
              color: '#6b7280', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}>
              Bubbles
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => handleAddNode('message')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>💬</span>
                <span>Text</span>
              </button>
              <button
                onClick={() => handleAddNode('image')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#ec4899';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🖼️</span>
                <span>Image</span>
              </button>
              <button
                onClick={() => handleAddNode('video')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🎥</span>
                <span>Video</span>
              </button>
              <button
                onClick={() => handleAddNode('embed')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>📦</span>
                <span>Embed</span>
              </button>
              <button
                onClick={() => handleAddNode('audio')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#7c3aed';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🎵</span>
                <span>Audio</span>
              </button>
            </div>
          </div>

          {/* Inputs Section */}
          <div style={{ marginBottom: '25px' }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: '600', 
              color: '#6b7280', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}>
              Inputs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => handleAddNode('input')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>📝</span>
                <span>Text</span>
              </button>
              <button
                onClick={() => handleAddNode('numberInput')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#06b6d4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🔢</span>
                <span>Number</span>
              </button>
              <button
                onClick={() => handleAddNode('emailInput')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#f59e0b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>📧</span>
                <span>Email</span>
              </button>
              <button
                onClick={() => handleAddNode('phoneInput')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#14b8a6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>📱</span>
                <span>Phone</span>
              </button>
              <button
                onClick={() => handleAddNode('dateInput')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#a855f7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>📅</span>
                <span>Date</span>
              </button>
              <button
                onClick={() => handleAddNode('fileUpload')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#f97316';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>📎</span>
                <span>File</span>
              </button>
              <button
                onClick={() => handleAddNode('pictureChoice')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#be185d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🖼️</span>
                <span>Picture Choice</span>
              </button>
            </div>
          </div>

          {/* Logic Section */}
          <div style={{ marginBottom: '25px' }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: '600', 
              color: '#6b7280', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}>
              Logic
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => handleAddNode('setVariable')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#8b5cf6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>✏️</span>
                <span>Set variable</span>
              </button>
              <button
                onClick={() => handleAddNode('condition')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#f59e0b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🔀</span>
                <span>Condition</span>
              </button>
              <button
                onClick={() => handleAddNode('redirect')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#6366f1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🔀</span>
                <span>Redirect</span>
              </button>
              <button
                onClick={() => handleAddNode('script')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>&lt;/&gt;</span>
                <span>Code</span>
              </button>
              <button
                onClick={() => handleAddNode('httpRequest')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#06b6d4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🌐</span>
                <span>Webhook</span>
              </button>
              <button
                onClick={() => handleAddNode('typebotLink')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#0ea5e9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🔗</span>
                <span>Typebot</span>
              </button>
              <button
                onClick={() => handleAddNode('abTest')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#9333ea';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>🧪</span>
                <span>AB Test</span>
              </button>
              <button
                onClick={() => handleAddNode('jump')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#eab308';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>↷</span>
                <span>Jump</span>
              </button>
              <button
                onClick={() => handleAddNode('wait')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#64748b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>⏸️</span>
                <span>Wait</span>
              </button>
              <button
                onClick={() => handleAddNode('delay')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#6b7280';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>⏱️</span>
                <span>Delay</span>
              </button>
              <button
                onClick={() => handleAddNode('handoff')}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <span style={{ fontSize: '18px' }}>👤</span>
                <span>Handoff</span>
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div style={{ 
          flex: 1, 
          position: 'relative', 
          marginRight: showPreview ? '400px' : '0', 
          transition: 'margin-right 0.3s ease',
          backgroundColor: 'white',
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
              if (window.confirm('Deseja excluir esta conexão?')) {
                // Remover do backend primeiro
                const sourceNode = nodes.find(n => n.id === edge.source);
                const sourceStepId = sourceNode?.data?.stepId;
                
                if (sourceStepId && !sourceStepId.startsWith('step-') && selectedFlow) {
                  try {
                    if (sourceNode?.type === 'condition') {
                      // Para condições, atualizar removendo trueStepId ou falseStepId
                      const stepResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
                      const flow = stepResponse.data;
                      const step = flow?.steps?.find((s: any) => s.id === sourceStepId);
                      const existingCondition = step?.conditions?.[0];
                      
                      if (existingCondition) {
                        // Atualizar condição removendo o stepId correspondente
                        await api.post(`/api/bots/steps/${sourceStepId}/conditions`, {
                          condition: existingCondition.condition || 'message.content',
                          operator: existingCondition.operator || 'CONTAINS',
                          value: existingCondition.value || '',
                          trueStepId: edge.sourceHandle === 'true' ? null : existingCondition.trueStepId,
                          falseStepId: edge.sourceHandle === 'false' ? null : existingCondition.falseStepId,
                        });
                      }
                    } else {
                      // Para outros tipos, remover nextStepId
                      await api.put(`/api/bots/steps/${sourceStepId}`, {
                        nextStepId: null,
                      });
                    }
                    
                    // Recarregar o fluxo para atualizar as conexões
                    const flowResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
                    const updatedFlow = flowResponse.data;
                    setSelectedFlow(updatedFlow);
                    // loadFlowToCanvas será chamado automaticamente pelo useEffect
                  } catch (error) {
                    console.error('Erro ao remover conexão do backend:', error);
                    // Remover visualmente mesmo se falhar no backend
                    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
                  }
                } else {
                  // Remover visualmente se não tiver stepId válido
                  setEdges((eds) => eds.filter((e) => e.id !== edge.id));
                }
              }
            }}
            nodeTypes={nodeTypes}
            onNodeDoubleClick={handleNodeDoubleClick}
            fitView
            style={{ backgroundColor: 'transparent' }}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                      Mensagem *
                    </label>
                    {availableVariables.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        💡 Use {'{{variável}}'} para inserir variáveis
                      </div>
                    )}
                  </div>
                  <textarea
                    value={stepFormData.content}
                    onChange={(e) => setStepFormData({ ...stepFormData, content: e.target.value })}
                    placeholder="Digite a mensagem que o bot enviará... Ex: Olá {{nome}}, como posso ajudar?"
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
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '5px', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#0369a1' }}>
                      📋 Variáveis Disponíveis:
                    </div>
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
                                padding: '4px 8px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '500',
                              }}
                              title={`Inserir {{${varName}}}`}
                            >
                              {varName}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px', fontStyle: 'italic' }}>
                          Clique em uma variável para inserir na mensagem
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#6b7280', padding: '8px', backgroundColor: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a' }}>
                        💡 <strong>Nenhuma variável disponível ainda.</strong> Para criar variáveis:
                        <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                          <li>Crie blocos de Input (Texto, Email, Número, etc.) e configure o nome da variável</li>
                          <li>Ou crie variáveis globais do bot na página de gerenciamento de variáveis</li>
                        </ul>
                        <div style={{ marginTop: '8px', fontSize: '10px' }}>
                          Você também pode digitar manualmente: {'{{nome_da_variavel}}'}
                        </div>
                      </div>
                    )}
                  </div>
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
                                      onDelete: node.data.onDelete || handleDeleteNode,
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

            {stepFormData.type === 'IMAGE' && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    URL da Imagem *
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.imageUrl || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, imageUrl: e.target.value },
                    })}
                    placeholder="https://exemplo.com/imagem.jpg"
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
                    URL do Vídeo *
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.videoUrl || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, videoUrl: e.target.value },
                    })}
                    placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
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
                    URL do Áudio *
                  </label>
                  <input
                    type="text"
                    value={stepFormData.config.audioUrl || ''}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, audioUrl: e.target.value },
                    })}
                    placeholder="https://exemplo.com/audio.mp3"
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
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, variableName: e.target.value },
                    })}
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
                      // Atualizar lista de variáveis disponíveis
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

