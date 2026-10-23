export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type ImageKind = "jpeg" | "png" | "webp"

export type UploadedFile = {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

export type UploadError = {
  status: 413 | 415
  body: {
    type: "invalid_data"
    code: "IMAGE_TOO_LARGE" | "IMAGE_FORMAT_INVALID"
    message: string
    details?: Record<string, unknown>
  }
}

const EXTENSIONS: Record<string, ImageKind> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
}

const MIME_TYPES: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte)

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

/** Detecta el formato por los primeros bytes, ignorando extensión y tipo declarado. */
export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return "jpeg"
  }
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return "png"
  }
  if (startsWith(buffer, ascii("RIFF")) && startsWith(buffer, ascii("WEBP"), 8)) {
    return "webp"
  }
  return null
}

const formatError = (): UploadError => ({
  status: 415,
  body: {
    type: "invalid_data",
    code: "IMAGE_FORMAT_INVALID",
    message:
      "El archivo no es una imagen válida. Subí una imagen JPG, PNG o WebP.",
  },
})

/**
 * Valida una imagen de producto (seguridad.md, SEC-50): hasta 5 MB, JPG, PNG o
 * WebP, y contenido real coherente con la extensión y el tipo declarado.
 * Devuelve el error a responder, o null si el archivo es válido.
 */
export function validateImageFile(file: UploadedFile): UploadError | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      status: 413,
      body: {
        type: "invalid_data",
        code: "IMAGE_TOO_LARGE",
        message: "La imagen supera 5 MB. Comprimila o elegí una más liviana.",
        details: { max_mb: MAX_IMAGE_BYTES / (1024 * 1024) },
      },
    }
  }

  const kind = detectImageKind(file.buffer)
  if (!kind) {
    return formatError()
  }

  const extension = file.originalname.split(".").pop()?.toLowerCase() ?? ""
  const hasExtension = file.originalname.includes(".")
  if (!hasExtension || EXTENSIONS[extension] !== kind) {
    return formatError()
  }

  if (file.mimetype !== MIME_TYPES[kind]) {
    return formatError()
  }

  return null
}
