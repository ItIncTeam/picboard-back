type ErrorLike = { message?: unknown; error?: unknown };

/**
 * Достаёт читаемое сообщение из любой ошибки, никогда не возвращая `[object Object]`.
 *
 * Покрывает: `Error` (в т.ч. rxjs `TimeoutError`), строку, число/boolean,
 * plain-объект (RPC/HTTP-ошибка вида `{ statusCode, message, errors }`),
 * `message`-массив и вложенный `{ error: { message } }`.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error);
  }

  if (error && typeof error === 'object') {
    const candidate = error as ErrorLike;
    const raw = candidate.message ?? candidate.error;

    if (typeof raw === 'string' && raw.length > 0) {
      return raw;
    }

    if (Array.isArray(raw)) {
      const joined = raw.filter((m) => typeof m === 'string').join('; ');
      if (joined) {
        return joined;
      }
    }

    // вложенный объект, напр. { error: { message: '...' } }
    if (raw && typeof raw === 'object') {
      const nested = (raw as ErrorLike).message ?? (raw as ErrorLike).error;
      if (typeof nested === 'string' && nested.length > 0) {
        return nested;
      }
    }

    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') {
        return json;
      }
    } catch {
      // circular — падаем в общий fallback ниже
    }
  }

  return 'Unknown error';
}
