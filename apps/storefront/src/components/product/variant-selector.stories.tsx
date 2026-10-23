import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { VariantSelector } from "./variant-selector"
import type { Selection, SelectorVariant } from "@/lib/variants"

const TALLE = "opt_talle"
const COLOR = "opt_color"

const options = [
  {
    id: TALLE,
    title: "Talle",
    values: [
      { id: "t1", value: "S" },
      { id: "t2", value: "M" },
      { id: "t3", value: "L" },
    ],
  },
  {
    id: COLOR,
    title: "Color",
    values: [
      { id: "c1", value: "Negro", hex: "#111111" },
      { id: "c2", value: "Rosa", hex: "#FF69B4" },
      { id: "c3", value: "Verde agua", hex: null },
    ],
  },
]

const variants: SelectorVariant[] = [
  { id: "v1", inStock: true, options: [{ option_id: TALLE, value: "S" }, { option_id: COLOR, value: "Negro" }] },
  { id: "v2", inStock: true, options: [{ option_id: TALLE, value: "M" }, { option_id: COLOR, value: "Negro" }] },
  { id: "v3", inStock: false, options: [{ option_id: TALLE, value: "L" }, { option_id: COLOR, value: "Negro" }] },
  { id: "v4", inStock: true, options: [{ option_id: TALLE, value: "M" }, { option_id: COLOR, value: "Rosa" }] },
  { id: "v5", inStock: true, options: [{ option_id: TALLE, value: "L" }, { option_id: COLOR, value: "Verde agua" }] },
]

type Args = React.ComponentProps<typeof VariantSelector>

// La historia guarda la selección en estado, como lo haría la ficha de producto.
function Interactive(args: Args) {
  const [selection, setSelection] = useState<Selection>(args.selection)
  return (
    <VariantSelector
      {...args}
      selection={selection}
      onChange={(optionId, value) => setSelection((s) => ({ ...s, [optionId]: value }))}
    />
  )
}

const meta = {
  title: "Producto/Selector de variante",
  component: VariantSelector,
  args: { options, variants, selection: {}, onChange: () => {} },
  render: (args) => <Interactive {...args} />,
} satisfies Meta<typeof VariantSelector>

export default meta
type Story = StoryObj<typeof meta>

/** Sin nada elegido: todo está disponible. L / Negro está agotado y se marca al elegir L. */
export const Inicial: Story = {}
/** Con talle S elegido, solo existe en Negro: Rosa y Verde agua quedan deshabilitados. */
export const ConTalleElegido: Story = { args: { selection: { [TALLE]: "S" } } }
/** Con L y Negro elegidos: la variante existe pero está agotada. */
export const VarianteAgotada: Story = {
  args: { selection: { [TALLE]: "L", [COLOR]: "Negro" } },
}
