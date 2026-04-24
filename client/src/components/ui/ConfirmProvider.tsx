import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
  prompt: (options: {
    title?: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
  }) => Promise<string | null>;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type PendingAlert = {
  title?: string;
  message: string;
  resolve: () => void;
};

type PendingPrompt = {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  resolve: (value: string | null) => void;
};

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [pendingAlert, setPendingAlert] = useState<PendingAlert | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const close = useCallback((result: boolean) => {
    if (pending) {
      pending.resolve(result);
    }
    setPending(null);
  }, [pending]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({
        ...options,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((message: string, title = 'Aviso') => {
    return new Promise<void>((resolve) => {
      setPendingAlert({
        title,
        message,
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options: {
    title?: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
  }) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue || '');
      setPendingPrompt({
        ...options,
        resolve,
      });
    });
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message?: any) => {
      setPendingAlert({
        title: 'Aviso',
        message: String(message ?? ''),
        resolve: () => undefined,
      });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const value = useMemo<ConfirmContextValue>(() => ({ confirm, alert, prompt }), [confirm, alert, prompt]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      {pending && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(2, 6, 12, 0.72)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={() => close(false)}
        >
          <div
            style={{
              width: '92%',
              maxWidth: '520px',
              background: 'linear-gradient(180deg, #1a2027 0%, #171c22 100%)',
              border: '1px solid #2a3340',
              borderRadius: '12px',
              boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: '#e5e7eb', fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
              {pending.title || 'Confirmação'}
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.5, marginBottom: '18px', whiteSpace: 'pre-line' }}>
              {pending.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => close(false)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#111827',
                  color: '#d1d5db',
                  border: '1px solid #2a3340',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                {pending.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(90deg,#22c55e,#16a34a)',
                  color: '#0b1f12',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {pending.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(2, 6, 12, 0.72)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={() => {
            pendingAlert.resolve();
            setPendingAlert(null);
          }}
        >
          <div
            style={{
              width: '92%',
              maxWidth: '520px',
              background: 'linear-gradient(180deg, #1a2027 0%, #171c22 100%)',
              border: '1px solid #2a3340',
              borderRadius: '12px',
              boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: '#e5e7eb', fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
              {pendingAlert.title || 'Aviso'}
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.5, marginBottom: '18px', whiteSpace: 'pre-line' }}>
              {pendingAlert.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  pendingAlert.resolve();
                  setPendingAlert(null);
                }}
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(90deg,#22c55e,#16a34a)',
                  color: '#0b1f12',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(2, 6, 12, 0.72)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={() => {
            pendingPrompt.resolve(null);
            setPendingPrompt(null);
          }}
        >
          <div
            style={{
              width: '92%',
              maxWidth: '520px',
              background: 'linear-gradient(180deg, #1a2027 0%, #171c22 100%)',
              border: '1px solid #2a3340',
              borderRadius: '12px',
              boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: '#e5e7eb', fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
              {pendingPrompt.title || 'Informação'}
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.5, marginBottom: '12px', whiteSpace: 'pre-line' }}>
              {pendingPrompt.message}
            </div>
            <input
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={pendingPrompt.placeholder || ''}
              style={{
                width: '100%',
                backgroundColor: '#0f1419',
                color: '#e5e7eb',
                border: '1px solid #2a3340',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '14px',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  pendingPrompt.resolve(null);
                  setPendingPrompt(null);
                }}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#111827',
                  color: '#d1d5db',
                  border: '1px solid #2a3340',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                {pendingPrompt.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingPrompt.resolve(promptValue);
                  setPendingPrompt(null);
                }}
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(90deg,#22c55e,#16a34a)',
                  color: '#0b1f12',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {pendingPrompt.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  }
  return context.confirm;
}

export function useAlert() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useAlert deve ser usado dentro de ConfirmProvider');
  }
  return context.alert;
}

export function usePrompt() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('usePrompt deve ser usado dentro de ConfirmProvider');
  }
  return context.prompt;
}

