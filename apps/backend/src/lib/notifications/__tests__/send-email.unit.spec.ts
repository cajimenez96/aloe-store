import type { MedusaContainer } from "@medusajs/framework/types"
import { sendEmail } from "../send-email"

function setup(options: { failures?: number; contactEmail?: string | null } = {}) {
  let remaining = options.failures ?? 0
  const createNotifications = jest.fn(async () => {
    if (remaining > 0) {
      remaining--
      throw new Error("proveedor caído")
    }
    return [{ id: "noti_1" }]
  })
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
  const query = {
    graph: jest.fn(async () => ({
      data: [
        {
          name: "Aloe",
          metadata: { admin_notification_email: options.contactEmail ?? null },
        },
      ],
    })),
  }
  const container = {
    resolve: (key: string) =>
      key === "logger" ? logger : key === "query" ? query : { createNotifications },
  } as unknown as MedusaContainer
  return { container, createNotifications, logger }
}

const message = {
  to: "cliente@ejemplo.com",
  template: "example" as const,
  data: { name: "Ana", message: "Tu pedido está listo." },
}
const noWait = async () => {}

describe("sendEmail", () => {
  it("envía por el canal email con el asunto, el HTML y el texto ya armados", async () => {
    const { container, createNotifications } = setup({ contactEmail: "dueno@comercio.com" })
    await expect(sendEmail(container, message, { sleep: noWait })).resolves.toBe(true)

    expect(createNotifications).toHaveBeenCalledTimes(1)
    const sent = (createNotifications.mock.calls[0] as unknown as [Record<string, any>])[0]
    expect(sent).toMatchObject({
      to: "cliente@ejemplo.com",
      channel: "email",
      template: "example",
    })
    expect(sent.data.subject).toBe("Aviso de Aloe")
    expect(sent.data.html).toContain("Tu pedido está listo.")
    expect(sent.data.html).toContain("dueno@comercio.com")
    expect(sent.data.text).toContain("Hola Ana")
  })

  it("reintenta cuando el proveedor falla y termina enviando", async () => {
    const { container, createNotifications, logger } = setup({ failures: 2 })
    await expect(sendEmail(container, message, { sleep: noWait })).resolves.toBe(true)
    expect(createNotifications).toHaveBeenCalledTimes(3)
    expect(logger.error).toHaveBeenCalledTimes(2)
  })

  it("si todos los intentos fallan, registra el fallo y no rompe el flujo", async () => {
    const { container, createNotifications, logger } = setup({ failures: 99 })
    await expect(sendEmail(container, message, { sleep: noWait })).resolves.toBe(false)
    expect(createNotifications).toHaveBeenCalledTimes(3)
    const events = logger.error.mock.calls.map((call) => JSON.parse(call[0]).event)
    expect(events).toEqual(["email_failed", "email_failed", "email_failed", "email_gave_up"])
  })

  it("el registro de fallos no incluye el destinatario ni los datos del cliente", async () => {
    const { container, logger } = setup({ failures: 99 })
    await sendEmail(container, message, { sleep: noWait })
    const logged = logger.error.mock.calls.map((call) => call[0]).join("\n")
    expect(logged).not.toContain("cliente@ejemplo.com")
    expect(logged).not.toContain("Ana")
    expect(logged).not.toContain("Tu pedido")
    expect(logged).toContain("example")
  })

  it("una plantilla que no existe se registra como fallo, sin enviar nada", async () => {
    const { container, createNotifications, logger } = setup()
    await expect(
      sendEmail(container, { ...message, template: "inventada" as never }, { sleep: noWait })
    ).resolves.toBe(false)
    expect(createNotifications).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalled()
  })
})
