import { withRetry } from "../retry"

const noWait = async () => {}

describe("withRetry", () => {
  it("devuelve el resultado si funciona a la primera", async () => {
    const task = jest.fn().mockResolvedValue("ok")
    await expect(withRetry(task, { attempts: 3, sleep: noWait })).resolves.toBe("ok")
    expect(task).toHaveBeenCalledTimes(1)
  })

  it("reintenta hasta que funciona", async () => {
    const task = jest
      .fn()
      .mockRejectedValueOnce(new Error("falla 1"))
      .mockRejectedValueOnce(new Error("falla 2"))
      .mockResolvedValue("ok")
    await expect(withRetry(task, { attempts: 3, sleep: noWait })).resolves.toBe("ok")
    expect(task).toHaveBeenCalledTimes(3)
  })

  it("después del último intento lanza el último error", async () => {
    const task = jest.fn().mockRejectedValue(new Error("siempre falla"))
    await expect(withRetry(task, { attempts: 3, sleep: noWait })).rejects.toThrow("siempre falla")
    expect(task).toHaveBeenCalledTimes(3)
  })

  it("espera más entre cada intento (retroceso exponencial)", async () => {
    const waits: number[] = []
    const task = jest.fn().mockRejectedValue(new Error("x"))
    await expect(
      withRetry(task, {
        attempts: 4,
        baseDelayMs: 100,
        sleep: async (ms) => {
          waits.push(ms)
        },
      })
    ).rejects.toThrow()
    expect(waits).toEqual([100, 200, 400])
  })

  it("avisa de cada fallo con el número de intento", async () => {
    const failures: [number, string][] = []
    const task = jest.fn().mockRejectedValue(new Error("boom"))
    await expect(
      withRetry(task, {
        attempts: 2,
        sleep: noWait,
        onFailure: (attempt, error) => failures.push([attempt, (error as Error).message]),
      })
    ).rejects.toThrow()
    expect(failures).toEqual([
      [1, "boom"],
      [2, "boom"],
    ])
  })

  it("con un solo intento no reintenta", async () => {
    const task = jest.fn().mockRejectedValue(new Error("x"))
    await expect(withRetry(task, { attempts: 1, sleep: noWait })).rejects.toThrow()
    expect(task).toHaveBeenCalledTimes(1)
  })
})
