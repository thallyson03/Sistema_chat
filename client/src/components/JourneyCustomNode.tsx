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
    if (!configured)
      return {
        bg: 'rgba(127, 29, 29, 0.35)',
        border: '#f87171',
        text: '#fecaca',
        softBg: 'rgba(127, 29, 29, 0.2)',
      };

    switch (type) {
      case 'TRIGGER':
        return {
          bg: 'rgba(6, 78, 59, 0.45)',
          border: '#66dd8b',
          text: '#e2e3df',
          softBg: 'rgba(6, 78, 59, 0.28)',
        };
      case 'ACTION':
        return {
          bg: 'rgba(6, 95, 70, 0.4)',
          border: '#34d399',
          text: '#d1fae5',
          softBg: 'rgba(6, 78, 59, 0.22)',
        };
      case 'CONDITION':
        return {
          bg: 'rgba(120, 53, 15, 0.35)',
          border: '#fbbf24',
          text: '#fef3c7',
          softBg: 'rgba(120, 53, 15, 0.2)',
        };
      case 'CONTROL':
        return {
          bg: 'rgba(76, 29, 149, 0.35)',
          border: '#a78bfa',
          text: '#ede9fe',
          softBg: 'rgba(76, 29, 149, 0.22)',
        };
      default:
        return {
          bg: 'rgba(55, 65, 81, 0.35)',
          border: '#9ca3af',
          text: '#e5e7eb',
          softBg: 'rgba(55, 65, 81, 0.2)',
        };
    }
  };

  const colors = getNodeColor();

  return (
    <div
      style={{
        background: '#2e312e',
        border: `1px solid ${configured ? colors.border : 'rgba(63, 73, 69, 0.35)'}`,
        borderRadius: '14px',
        minWidth: '220px',
        boxShadow: configured
          ? '0 8px 32px rgba(226, 227, 223, 0.06)'
          : '0 4px 16px rgba(0, 0, 0, 0.35)',
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
            border: '2px solid #121412',
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
          <span style={{ fontSize: '12px', color: '#66dd8b' }}>✓</span>
        ) : (
          <span style={{ fontSize: '12px', color: '#f87171' }}>⚠️</span>
        )}
      </div>

      {/* Conteúdo principal */}
      <div
        style={{
          padding: '10px 14px 12px',
          background: configured ? '#1e201e' : colors.softBg,
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
                  backgroundColor: '#0d0f0d',
                  borderRadius: '6px',
                  maxHeight: '48px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  border: '1px solid rgba(63, 73, 69, 0.35)',
                }}
              >
                💬 {config.message.substring(0, 50)}
                {config.message.length > 50 ? '…' : ''}
              </div>
            ) : (
              <div style={{ color: '#f87171', fontWeight: 500 }}>
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
          border: '2px solid #121412',
        }}
      />
    </div>
  );
}

