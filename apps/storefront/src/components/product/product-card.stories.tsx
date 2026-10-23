import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ProductCard } from "./product-card"

const meta = {
  title: "Producto/Tarjeta de producto",
  component: ProductCard,
  decorators: [(Story) => <div className="w-64"><Story /></div>],
  args: {
    title: "Bombacha de algodón",
    href: "#",
    listPrice: 10000,
    currencyCode: "ars",
  },
} satisfies Meta<typeof ProductCard>

export default meta
type Story = StoryObj<typeof meta>

export const SinDescuento: Story = {}
export const ConPrecioPorTransferencia: Story = { args: { transferPercent: 10 } }
export const ConCentavos: Story = { args: { listPrice: 1999, transferPercent: 15 } }
export const Agotado: Story = { args: { soldOut: true, transferPercent: 10 } }
