import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

interface CustomNodeProps {
  data: {
    label: string;
    type: 'TRIGGER' | 'ACTION' | 'CONDITION' | 'CONTROL';
    config?: any;
  };
  id: string;
}

export function JourneyCustomNode({ data, id }: CustomNodeProps) {
  const { label, type, config = {} } = data;
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja excluir o bloco "${label}"?`)) {
      deleteElements({ nodes: [{ id }] });
    }
  };

  // Verificar se o nó está configurado
  const isConfigured = () => {
    if (type === 'ACTION' && config.actionType === 'send_message') {
      return !!(config.message && config.channelId);
    }
    if (type === 'TRIGGER') {
      return !!config.triggerType;
    }
    if (type === 'CONDITION') {
      return !!(config.conditionType && config.operator);
    }
    if (type === 'CONTROL') {
      return !!(config.controlType && (config.delayValue || config.splitPercent));
    }
    return true;
  };

  const configured = isConfigured();

  const getNodeColor = () => {
    if (!configured) return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', softBg: '#fee2e2' };
    
    switch (type) {
      case 'TRIGGER':
        return { bg: '#dbeafe', border: '#0ea5e9', text: '#0f172a', softBg: '#eff6ff' };
      case 'ACTION':
        return { bg: '#dcfce7', border: '#22c55e', text: '#064e3b', softBg: '#ecfdf3' };
      case 'CONDITION':
        return { bg: '#fef3c7', border: '#f97316', text: '#78350f', softBg: '#fffbeb' };
      case 'CONTROL':
        return { bg: '#e9d5ff', border: '#8b5cf6', text: '#4c1d95', softBg: '#f5f3ff' };
      default:
        return { bg: '#f3f4f6', border: '#6b7280', text: '#374151', softBg: '#f9fafb' };
    }
  };

  const colors = getNodeColor();

  return (
    <div
      style={{
        background: '#ffffff',
        border: `1px solid ${configured ? colors.border : '#e5e7eb'}`,
        borderRadius: '14px',
        minWidth: '220px',
        boxShadow: configured
          ? '0 10px 20px rgba(15, 23, 42, 0.18)'
          : '0 4px 8px rgba(15, 23, 42, 0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Faixa superior colorida */}
      <div
        style={{
          height: '5px',
          background: `linear-gradient(90deg, ${colors.border}, ${colors.bg})`,
        }}
      />

      {/* Handle de entrada (apenas se não for TRIGGER) */}
      {type !== 'TRIGGER' && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: colors.border,
            width: '12px',
            height: '12px',
            border: '2px solid white',
          }}
        />
      )}

      {/* Botão de deletar */}
      <button
        onClick={handleDelete}
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          background: '#ef4444',
          border: 'none',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: 'white',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#dc2626';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#ef4444';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Excluir bloco"
      >
        ×
      </button>

      {/* Indicador de status */}
      <div style={{ position: 'absolute', top: '10px', right: '36px' }}>
        {configured ? (
          <span style={{ fontSize: '12px', color: '#16a34a' }}>✓</span>
        ) : (
          <span style={{ fontSize: '12px', color: '#ef4444' }}>⚠️</span>
        )}
      </div>

      {/* Conteúdo principal */}
      <div
        style={{
          padding: '10px 14px 12px',
          background: configured ? '#ffffff' : colors.softBg,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
            gap: '8px',
          }}
        >
          {/* Ícone circular à esquerda */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '999px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            {type === 'TRIGGER'
              ? '🎯'
              : type === 'ACTION'
              ? '⚡'
              : type === 'CONDITION'
              ? '❓'
              : '🎛️'}
          </div>

          {/* Tipo + label */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tipo do nó */}
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: colors.text,
                opacity: 0.8,
                letterSpacing: '0.06em',
                marginBottom: '1px',
              }}
            >
              {type === 'TRIGGER'
                ? 'Trigger'
                : type === 'ACTION'
                ? 'Ação'
                : type === 'CONDITION'
                ? 'Condição'
                : 'Controle'}
            </div>
            {/* Label */}
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: colors.text,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
              title={label}
            >
              {label}
            </div>
          </div>
        </div>

        {/* Informações adicionais */}
        {type === 'ACTION' && config.actionType === 'send_message' && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: colors.text,
              opacity: 0.8,
            }}
          >
            {config.message ? (
              <div
                style={{
                  padding: '6px 8px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px',
                  maxHeight: '48px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  border: '1px solid #e5e7eb',
                }}
              >
                💬 {config.message.substring(0, 50)}
                {config.message.length > 50 ? '…' : ''}
              </div>
            ) : (
              <div style={{ color: '#ef4444', fontWeight: 500 }}>
                ⚠️ Mensagem não configurada
              </div>
            )}
          </div>
        )}
      </div>

      {/* Handle de saída */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: colors.border,
          width: '12px',
          height: '12px',
          border: '2px solid white',
        }}
      />
    </div>
  );
}

