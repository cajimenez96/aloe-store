import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ColorSwatch } from "./color-swatch"

const meta = {
  title: "Producto/Muestra de color",
  component: ColorSwatch,
  args: { name: "Negro", hex: "#111111" },
} satisfies Meta<typeof ColorSwatch>

export default meta
type Story = StoryObj<typeof meta>

export const ConMuestra: Story = {}
export const Rosa: Story = { args: { name: "Rosa", hex: "#FF69B4" } }
export const SinMuestra: Story = {
  args: { name: "Verde agua", hex: null },
}
