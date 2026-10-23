import { create } from "zustand"

/**
 * Solo estado de interfaz (arquitectura.md, sección 18). Nunca precios, stock ni
 * el contenido del carrito: el carrito vive en Medusa.
 */
type UiState = {
  cartOpen: boolean
  openCart: () => void
  closeCart: () => void
}

export const useUiStore = create<UiState>((set) => ({
  cartOpen: false,
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
}))
