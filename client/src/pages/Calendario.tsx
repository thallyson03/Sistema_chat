import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

interface CalendarTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate: string | null;
  originalDueDate?: string | null;
  createdAt?: string;
  deal: {
    id: string;
    name: string;
    assignedTo?: { id: string; name: string } | null;
    contact?: { id: string; name: string } | null;
    pipeline?: { id: string; name: string; color?: string | null } | null;
    stage?: { id: string; name: string; color?: string | null } | null;
  };
}

const HOUR_START = 6;
const HOUR_END = 22;

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export default function Calendario() {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfWeek(new Date()));
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => addDays(weekAnchor, idx)),
    [weekAnchor],
  );

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const start = weekDays[0];
      const end = addDays(weekDays[6], 1);
      end.setHours(23, 59, 59, 999);
      const response = await api.get('/api/pipelines/tasks/calendar', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
          includeNoDue: true,
        },
      });
      setTasks(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar tarefas do calendário:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [weekDays]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const tasksByDay = useMemo(() => {
    const grouped = new Map<string, CalendarTask[]>();
    for (const day of weekDays) {
      grouped.set(day.toISOString().slice(0, 10), []);
    }
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = new Date(task.dueDate).toISOString().slice(0, 10);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(task);
    }
    for (const [, arr] of grouped) {
      arr.sort(
        (a, b) =>
          new Date(a.dueDate || '1970-01-01T00:00:00.000Z').getTime() -
          new Date(b.dueDate || '1970-01-01T00:00:00.000Z').getTime(),
      );
    }
    return grouped;
  }, [tasks, weekDays]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface px-4 py-4 text-on-surface">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Calendario</h1>
          <p className="text-xs text-on-surface-variant">
            Tarefas dos leads por semana
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-primary/20 bg-surface-container px-3 py-1.5 text-xs"
            onClick={() => setWeekAnchor((prev) => addDays(prev, -7))}
          >
            Semana anterior
          </button>
          <button
            type="button"
            className="rounded border border-primary/20 bg-surface-container px-3 py-1.5 text-xs"
            onClick={() => setWeekAnchor(startOfWeek(new Date()))}
          >
            Hoje
          </button>
          <button
            type="button"
            className="rounded border border-primary/20 bg-surface-container px-3 py-1.5 text-xs"
            onClick={() => setWeekAnchor((prev) => addDays(prev, 7))}
          >
            Proxima semana
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-primary/10 bg-surface-container-low">
        <div className="grid min-w-[980px] grid-cols-8">
          <div className="sticky top-0 z-10 border-b border-r border-primary/10 bg-surface-container px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Horario
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className="sticky top-0 z-10 border-b border-r border-primary/10 bg-surface-container px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant last:border-r-0"
            >
              {formatDayLabel(day)}
            </div>
          ))}

          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, idx) => HOUR_START + idx).map(
            (hour) => (
              <Fragment key={`row-${hour}`}>
                <div
                  key={`hour-${hour}`}
                  className="border-r border-t border-primary/10 px-2 py-3 text-[11px] text-on-surface-variant"
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
                {weekDays.map((day) => {
                  const dayKey = day.toISOString().slice(0, 10);
                  const list = tasksByDay.get(dayKey) || [];
                  const hourTasks = list.filter(
                    (task) =>
                      !!task.dueDate &&
                      new Date(task.dueDate).getHours() === hour,
                  );
                  return (
                    <div
                      key={`${dayKey}-${hour}`}
                      className="min-h-[64px] border-r border-t border-primary/10 px-1.5 py-1 last:border-r-0"
                    >
                      <div className="space-y-1">
                        {hourTasks.map((task) => (
                          <div
                            key={task.id}
                            className="rounded border border-primary/20 bg-primary/10 px-1.5 py-1 text-[10px]"
                            title={`${task.title} - ${task.deal.name}`}
                          >
                            <div className="truncate font-semibold text-primary">
                              {task.deal.contact?.name || task.deal.name}
                            </div>
                            <div className="truncate text-on-surface-variant">{task.title}</div>
                            <div className="truncate text-on-surface-variant/80">
                              {task.deal.pipeline?.name || 'Pipeline'}
                              {task.deal.stage?.name ? ` • ${task.deal.stage.name}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ),
          )}
        </div>
      </div>

      {loading && <p className="mt-2 text-xs text-on-surface-variant">Carregando tarefas...</p>}

    </div>
  );
}

