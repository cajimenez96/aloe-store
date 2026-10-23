import type { Preview } from "@storybook/nextjs-vite"
import "../src/app/globals.css"

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      options: { crema: { name: "Crema", value: "#fbfbf5" }, blanco: { name: "Blanco", value: "#ffffff" } },
    },
    a11y: { test: "error" },
  },
  initialGlobals: { backgrounds: { value: "crema" } },
}

export default preview
