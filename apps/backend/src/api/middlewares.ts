import {
  authenticate,
  configureStoreSearch,
  defineMiddlewares,
} from '@medusajs/framework/http'
import { enforceRole } from '../lib/roles/guard'
import { enforceSingleCategoryOnAdd } from '../lib/single-category/middleware'
import { scrubTransferCode } from '../lib/transfer-discount/scrub-middleware'
import { validateImageUploads } from '../lib/uploads/validate-image-uploads'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
    {
      // El código de la promoción de transferencia nunca sale por la API de
      // tienda (SEC-31, HU-22).
      matcher: '/store*',
      middlewares: [scrubTransferCode],
    },
    {
      // Un producto va en una sola categoría (HU-07).
      method: ['POST'],
      matcher: '/admin/product-categories/:id/products',
      middlewares: [enforceSingleCategoryOnAdd],
    },
    {
      // Medusa no valida el tipo ni el tamaño de lo que se sube (SEC-50).
      method: ['POST'],
      matcher: '/admin/uploads',
      middlewares: [validateImageUploads],
    },
    {
      // Permisos por rol en todo /admin (SEC-21). Se autentica primero para no
      // depender del orden de los middlewares de Medusa; sin sesión, pasa de
      // largo y Medusa responde 401.
      // Debe ser un comodín de texto: Medusa 2.22 ignora en silencio un matcher
      // con RegExp cuando la entrada no define métodos (sp-01-medusa.md, punto 18).
      matcher: '/admin*',
      middlewares: [
        authenticate('user', ['session', 'bearer', 'api-key'], {
          allowUnauthenticated: true,
        }),
        enforceRole,
      ],
    },
  ],
})
