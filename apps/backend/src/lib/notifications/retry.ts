type RetryOptions = {
  /** Cantidad total de intentos, el primero incluido. */
  attempts: number
  /** Espera antes del segundo intento. Se duplica en cada intento siguiente. */
  baseDelayMs?: number
  sleep?: (ms: number) => Promise<void>
  /** Se llama en cada fallo con el número de intento, para dejarlo registrado. */
  onFailure?: (attempt: number, error: unknown) => void
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Ejecuta una tarea y la reintenta con retroceso exponencial. Después del último
 * intento lanza el último error (arquitectura.md, sección 19).
 */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, baseDelayMs = 500, sleep = defaultSleep, onFailure } = options
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      onFailure?.(attempt, error)
      if (attempt < attempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1))
      }
    }
  }

  throw lastError
}
