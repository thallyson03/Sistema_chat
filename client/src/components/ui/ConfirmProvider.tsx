import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

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

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

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

