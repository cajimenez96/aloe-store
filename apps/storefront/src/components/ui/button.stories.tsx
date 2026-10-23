import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Button } from "./button"

const meta = {
  title: "Interfaz/Botón",
  component: Button,
  args: { children: "Agregar al carrito" },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primario: Story = {}
export const Contorno: Story = { args: { variant: "outline" } }
export const Aloe: Story = { args: { variant: "aloe", children: "Finalizar compra" } }
export const Pequeño: Story = { args: { size: "sm" } }
export const Deshabilitado: Story = { args: { disabled: true } }
