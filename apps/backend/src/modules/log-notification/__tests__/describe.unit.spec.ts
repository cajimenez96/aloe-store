import { describeNotification } from "../describe"

const notification = {
  to: "ana.perez@ejemplo.com",
  channel: "email",
  template: "transfer-order",
  data: {
    subject: "Pedido #4: datos para transferir",
    html: "<p>CBU 0170099220000067797370</p>",
    text: "Titular: Aloe SRL\nCBU o CVU: 0170099220000067797370\nhttp://tienda/pedido/order_1/acceso?token=QvAt6PWHkc6TtQPF2RXTNEmJM4eh1k0NtR4DS6I8Gqs",
  },
}

describe("describeNotification (SEC-70)", () => {
  it("por defecto registra solo la plantilla, el canal, el destinatario enmascarado y el asunto", () => {
    const fields = describeNotification(notification, false)
    expect(fields).toEqual({
      template: "transfer-order",
      channel: "email",
      to_masked: "a***@ejemplo.com",
      subject: "Pedido #4: datos para transferir",
    })
  })

  it("el registro por defecto no contiene el CBU, el token, el nombre ni el email completo", () => {
    const logged = JSON.stringify(describeNotification(notification, false))
    for (const secret of ["0170099220000067797370", "QvAt6PWHkc6TtQPF2RXTNEmJM4eh1k0NtR4DS6I8Gqs", "Aloe SRL", "ana.perez"]) {
      expect(logged).not.toContain(secret)
    }
  })

  it("con la opción de desarrollo agrega el texto, para ver el enlace al probar en local", () => {
    const fields = describeNotification(notification, true)
    expect(fields.text).toContain("acceso?token=")
  })

  it("tolera una notificación incompleta", () => {
    expect(describeNotification({ to: "x", channel: "email", template: "t" } as never, false)).toMatchObject({
      template: "t",
      to_masked: "***",
    })
  })
})
