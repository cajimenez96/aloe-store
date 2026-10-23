import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
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
      // Medusa no valida el tipo ni el tamaño de lo que se sube (SEC-50).
      method: ['POST'],
      matcher: '/admin/uploads',
      middlewares: [validateImageUploads],
    },
  ],
})
