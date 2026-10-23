import { redirect } from "next/navigation"

// La portada es el catálogo hasta que el comercio defina otra.
export default function Home() {
  redirect("/productos")
}
