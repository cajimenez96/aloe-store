import {
  authenticate,
  configureStoreSearch,
  defineMiddlewares,
} from '@medusajs/framework/http'
import { enforceRole } from '../lib/roles/guard'
import { blockNativeOrderRoutes } from '../lib/order-access/block-native'
import { enforceSingleCategoryOnAdd } from '../lib/single-category/middleware'
import { auditAdminAction, auditLogin } from '../lib/logging/audit'
import { rateLimit } from '../lib/rate-limit/middleware'
import { receiveProofUpload } from '../lib/transfer-proofs/upload-middleware'
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
      // Login del panel y creación de carritos y pedidos (SEC-17, HU-43).
      method: ['POST'],
      matcher: '/auth/user*',
      middlewares: [rateLimit('login'), auditLogin],
    },
    {
      method: ['POST'],
      matcher: '/store/carts',
      middlewares: [rateLimit('checkout')],
    },
    {
      method: ['POST'],
      matcher: '/store/checkout/:cart_id/complete',
      middlewares: [rateLimit('checkout')],
    },
    {
      // Los pedidos de la tienda se ven solo con el token y se confirman solo
      // por /store/checkout/:cart_id/complete (SEC-24).
      matcher: '/store/orders*',
      middlewares: [blockNativeOrderRoutes],
    },
    {
      method: ['POST'],
      matcher: '/store/carts/:id/complete',
      middlewares: [blockNativeOrderRoutes],
    },
    {
      // El código de la promoción de transferencia nunca sale por la API de
      // tienda (SEC-31, HU-22).
      matcher: '/store*',
      middlewares: [rateLimit('store'), scrubTransferCode],
    },
    {
      // Comprobante de transferencia: multipart, un archivo, validado por contenido (SEC-51).
      method: ['POST'],
      matcher: '/store/order-access/:id/transfer-proofs',
      bodyParser: false,
      middlewares: [receiveProofUpload],
    },
    {
      // Acciones sensibles del panel con el usuario que las hizo (SEC-95).
      method: ['POST'],
      matcher: '/admin/orders/:id/cancel',
      middlewares: [auditAdminAction('order_canceled')],
    },
    {
      method: ['POST'],
      matcher: '/admin/payments/:id/refund',
      middlewares: [auditAdminAction('payment_refunded')],
    },
    {
      method: ['POST'],
      matcher: '/admin/payments/:id/capture',
      middlewares: [auditAdminAction('payment_captured')],
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
