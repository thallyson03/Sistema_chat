type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const raw = String(process.env.LOG_LEVEL || '').trim().toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

const minLevel = resolveMinLevel();

function shouldLog(level: LogLevel): boolean {
  return levelWeight[level] >= levelWeight[minLevel];
}

function serializeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta || {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    emit('debug', message, meta);
  },
  info(message: string, meta?: Record<string, unknown>) {
    emit('info', message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit('warn', message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit('error', message, meta);
  },
  errorWithCause(message: string, error: unknown, meta?: Record<string, unknown>) {
    emit('error', message, {
      ...(meta || {}),
      error: serializeError(error),
    });
  },
};

