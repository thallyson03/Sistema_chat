import React, { useMemo, useState } from 'react';

export interface TaskNotificationData {
  taskId: string;
  dealId?: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  status?: string;
}

interface TaskNotificationCardProps {
  task: TaskNotificationData;
  onComplete?: (taskId: string) => Promise<void> | void;
  onSaveResult?: (taskId: string, result: string) => Promise<void> | void;
}

function formatDate(date?: string | null) {
  if (!date) return 'Sem prazo';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Sem prazo';
  return `Hoje ${parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function TaskNotificationCard({
  task,
  onComplete,
  onSaveResult,
}: TaskNotificationCardProps) {
  const [result, setResult] = useState(task.description || '');
  const [savingResult, setSavingResult] = useState(false);
  const [completing, setCompleting] = useState(false);
  const isDone = String(task.status || '').toUpperCase() === 'DONE';

  const dueLabel = useMemo(() => formatDate(task.dueDate), [task.dueDate]);

  return (
    <div className="w-full rounded-[6px] border border-[rgba(216,162,191,0.55)] bg-[#2f3432] px-2.5 py-2 text-[#d7ddda]">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] leading-none text-[#a6afab]">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d8a2bf] text-[10px] text-[#c07aa0]">
          ◷
        </span>
        <span>{dueLabel}</span>
        <span className="text-[#9aa39f]">De Robot</span>
      </div>
      <div className="mb-1.5 text-[13px] font-semibold leading-tight text-[#edf2ee]">
        <span className="mr-1 text-[12px]">☑</span>
        {task.title || 'Tarefa'}
      </div>

      <div className="flex items-center gap-1.5">
        <textarea
          value={result}
          onChange={(e) => setResult(e.target.value)}
          placeholder="Adicionar resultado"
          className="h-[28px] min-h-[28px] flex-1 resize-none rounded-[2px] border border-[rgba(206,214,210,0.18)] bg-[#1f2321] px-2 py-1 text-[12px] text-[#dde4e0] outline-none placeholder:text-[#98a19d] focus:border-[rgba(216,162,191,0.55)]"
          rows={1}
        />
        <button
          type="button"
          disabled={completing || isDone}
          onClick={async () => {
            if (!onComplete || isDone) return;
            try {
              setCompleting(true);
              await onComplete(task.taskId);
            } finally {
              setCompleting(false);
            }
          }}
          className="h-[28px] whitespace-nowrap rounded-[2px] border border-[rgba(206,214,210,0.18)] bg-[#3a403d] px-2.5 text-[11px] font-semibold text-[#d0d7d3] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDone ? 'Tarefa concluída' : completing ? 'Concluindo...' : 'Tarefa concluída'}
        </button>
      </div>

      <div className="mt-1.5 flex items-center">
        <button
          type="button"
          disabled={savingResult || isDone}
          onClick={async () => {
            if (!onSaveResult || isDone) return;
            try {
              setSavingResult(true);
              await onSaveResult(task.taskId, result);
            } finally {
              setSavingResult(false);
            }
          }}
          className="h-[24px] rounded-[2px] border border-[rgba(206,214,210,0.18)] bg-[#2f3532] px-2.5 text-[11px] font-medium text-[#aeb7b3] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingResult ? 'Salvando...' : 'Salvar resultado'}
        </button>
      </div>
    </div>
  );
}
