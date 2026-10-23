/**
 * Configuración base de la tienda (arquitectura.md, sección 5; planning.md, HU-04).
 *
 * Es idempotente: ejecutarlo dos veces no duplica nada. No carga datos de
 * catálogo. Se ejecuta con `npm run setup:store`.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createLocationFulfillmentSetWorkflow,
  createPricePreferencesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updatePricePreferencesWorkflow,
  updateSalesChannelsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

const CURRENCY = "ars"
const COUNTRY = "ar"
const MEDUSA_DEFAULT_CHANNEL = "Default Sales Channel"
const WEB = "Web"
const LOCAL = "Local"
const REGION_NAME = "Argentina"
const LOCATION_NAME = "Local"
const FULFILLMENT_SET_NAME = "Entregas desde el local"
const API_KEY_TITLE = "Tienda web"
const PICKUP_NAME = "Retiro en el local"
const DELIVERY_NAME = "Envío a domicilio"

export default async function setupStore({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const created: string[] = []
  const kept: string[] = []
  const report = (didCreate: boolean, what: string) =>
    (didCreate ? created : kept).push(what)

  // 1. Canales de venta "Web" y "Local".
  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const channelByName = new Map<string, string>(
    channels.map((c) => [c.name as string, c.id as string])
  )
  // Medusa crea un canal "Default Sales Channel" al migrar: se reutiliza como "Web".
  const defaultChannelId = channelByName.get(MEDUSA_DEFAULT_CHANNEL)
  if (!channelByName.has(WEB) && defaultChannelId) {
    await updateSalesChannelsWorkflow(container).run({
      input: { selector: { id: defaultChannelId }, update: { name: WEB } },
    })
    channelByName.delete(MEDUSA_DEFAULT_CHANNEL)
    channelByName.set(WEB, defaultChannelId)
    report(true, `canal de venta "${WEB}" (renombrado desde "${MEDUSA_DEFAULT_CHANNEL}")`)
  }
  for (const name of [WEB, LOCAL]) {
    if (channelByName.has(name)) {
      report(false, `canal de venta "${name}"`)
      continue
    }
    const {
      result: [channel],
    } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name }] },
    })
    channelByName.set(name, channel.id)
    report(true, `canal de venta "${name}"`)
  }
  const webChannelId = channelByName.get(WEB)!
  const localChannelId = channelByName.get(LOCAL)!

  // 2. Moneda ARS por defecto y canal "Web" por defecto de la tienda.
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "default_sales_channel_id", "supported_currencies.*"],
  })
  const store = stores[0]
  if (!store) {
    throw new Error(
      "No hay una tienda creada. Ejecutá `npm run db:migrate` antes de la configuración base."
    )
  }
  const currencies = (store.supported_currencies ?? []) as {
    currency_code: string
    is_default: boolean
  }[]
  const arsIsDefault = currencies.some(
    (c) => c.currency_code === CURRENCY && c.is_default
  )
  if (!arsIsDefault || store.default_sales_channel_id !== webChannelId) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          default_sales_channel_id: webChannelId,
          supported_currencies: [
            { currency_code: CURRENCY, is_default: true },
            ...currencies
              .filter((c) => c.currency_code !== CURRENCY)
              .map((c) => ({ currency_code: c.currency_code, is_default: false })),
          ],
        },
      },
    })
    report(true, "ARS como moneda por defecto de la tienda")
  } else {
    report(false, "ARS como moneda por defecto de la tienda")
  }

  // 3. Región Argentina con el proveedor de pago manual.
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
    filters: { name: REGION_NAME },
  })
  let regionId = regions[0]?.id as string | undefined
  if (!regionId) {
    const {
      result: [region],
    } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: CURRENCY,
            countries: [COUNTRY],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    regionId = region.id
  }
  report(!regions[0], `región "${REGION_NAME}"`)

  // 4. Región fiscal. La alícuota depende de la condición fiscal del cliente
  //    (pregunta bloqueante 1) y se carga cuando se confirme.
  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
    filters: { country_code: COUNTRY },
  })
  if (!taxRegions.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: COUNTRY, provider_id: "tp_system" }],
    })
  }
  report(!taxRegions.length, "región fiscal de Argentina")

  // 5. Precios con impuestos incluidos para ARS y para la región.
  const { data: preferences } = await query.graph({
    entity: "price_preference",
    fields: ["id", "attribute", "value", "is_tax_inclusive"],
  })
  for (const [attribute, value] of [
    ["currency_code", CURRENCY],
    ["region_id", regionId],
  ] as const) {
    const existing = preferences.find(
      (p) => p.attribute === attribute && p.value === value
    )
    if (!existing) {
      await createPricePreferencesWorkflow(container).run({
        input: [{ attribute, value, is_tax_inclusive: true }],
      })
      report(true, `precios con impuestos incluidos (${attribute})`)
    } else if (!existing.is_tax_inclusive) {
      await updatePricePreferencesWorkflow(container).run({
        input: {
          selector: { id: existing.id },
          update: { is_tax_inclusive: true },
        },
      })
      report(true, `precios con impuestos incluidos (${attribute})`)
    } else {
      report(false, `precios con impuestos incluidos (${attribute})`)
    }
  }

  // 6. Ubicación de stock "Local", asociada a ambos canales.
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "sales_channels.id",
      "fulfillment_sets.id",
      "fulfillment_sets.name",
      "fulfillment_providers.id",
    ],
    filters: { name: LOCATION_NAME },
  })
  let location = locations[0]
  if (!location) {
    const {
      result: [created_],
    } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: LOCATION_NAME,
            address: { country_code: "AR", city: "", address_1: "" },
          },
        ],
      },
    })
    location = {
      id: created_.id,
      name: LOCATION_NAME,
      sales_channels: [],
      fulfillment_sets: [],
      fulfillment_providers: [],
    }
  }
  report(!locations[0], `ubicación de stock "${LOCATION_NAME}"`)

  const linkedChannels = new Set(
    (location.sales_channels ?? []).map((c) => c?.id)
  )
  const missingChannels = [webChannelId, localChannelId].filter(
    (id) => !linkedChannels.has(id)
  )
  if (missingChannels.length) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: missingChannels },
    })
  }
  report(
    missingChannels.length > 0,
    `ubicación "${LOCATION_NAME}" asociada a los canales "Web" y "Local"`
  )

  const hasProvider = (location.fulfillment_providers ?? []).some(
    (p) => p?.id === "manual_manual"
  )
  if (!hasProvider) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }
  report(!hasProvider, "proveedor de envío manual en la ubicación")

  // 7. Conjunto de entregas con la zona "Argentina".
  let fulfillmentSet = (location.fulfillment_sets ?? []).find(
    (f) => f?.name === FULFILLMENT_SET_NAME
  )
  if (!fulfillmentSet) {
    const { result } = await createLocationFulfillmentSetWorkflow(
      container
    ).run({
      input: {
        location_id: location.id,
        fulfillment_set_data: { name: FULFILLMENT_SET_NAME, type: "shipping" },
      },
    })
    void result
    const fulfillment = container.resolve(Modules.FULFILLMENT)
    const [set] = await fulfillment.listFulfillmentSets({
      name: FULFILLMENT_SET_NAME,
    })
    await fulfillment.createServiceZones({
      name: REGION_NAME,
      fulfillment_set_id: set.id,
      geo_zones: [{ country_code: COUNTRY, type: "country" }],
    })
    fulfillmentSet = { id: set.id, name: FULFILLMENT_SET_NAME }
  }
  report(
    !(location.fulfillment_sets ?? []).some(
      (f) => f?.name === FULFILLMENT_SET_NAME
    ),
    `conjunto de entregas "${FULFILLMENT_SET_NAME}"`
  )

  // 8. Opciones de envío: retiro sin costo y envío con costo fijo.
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const [serviceZone] = await fulfillmentModule.listServiceZones({
    fulfillment_set: { id: fulfillmentSet!.id },
  })
  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  })
  const existingOptions = new Set(options.map((o) => o.name))
  const toCreate = [
    {
      name: PICKUP_NAME,
      label: "Retiro",
      description: "Retirás tu compra en el local, sin costo.",
      code: "pickup",
    },
    {
      // El costo fijo se define con el dueño (pregunta abierta 6) y se edita
      // desde el panel. Se crea en 0 para que el checkout sea probable.
      name: DELIVERY_NAME,
      label: "Envío",
      description: "El comercio coordina el envío con vos.",
      code: "delivery",
    },
  ].filter((option) => !existingOptions.has(option.name))
  if (toCreate.length) {
    await createShippingOptionsWorkflow(container).run({
      input: toCreate.map((option) => ({
        name: option.name,
        price_type: "flat" as const,
        provider_id: "manual_manual",
        service_zone_id: serviceZone.id,
        shipping_profile_id: profiles[0].id,
        type: {
          label: option.label,
          description: option.description,
          code: option.code,
        },
        prices: [
          { currency_code: CURRENCY, amount: 0 },
          { region_id: regionId!, amount: 0 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
          { attribute: "is_return", value: "false", operator: "eq" as const },
        ],
      })),
    })
  }
  for (const name of [PICKUP_NAME, DELIVERY_NAME]) {
    report(!existingOptions.has(name), `opción de envío "${name}"`)
  }

  // 9. Clave publicable asociada al canal "Web".
  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "token", "sales_channels.id"],
    filters: { title: API_KEY_TITLE, type: "publishable" },
  })
  let key = keys[0]
  if (!key) {
    const {
      result: [newKey],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: API_KEY_TITLE, type: "publishable", created_by: "" }],
      },
    })
    key = { id: newKey.id, title: API_KEY_TITLE, token: newKey.token, sales_channels: [] }
  }
  const keyHasWeb = (key.sales_channels ?? []).some((c) => c?.id === webChannelId)
  if (!keyHasWeb) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: key.id, add: [webChannelId] },
    })
  }
  report(!keys[0] || !keyHasWeb, `clave publicable asociada al canal "${WEB}"`)

  logger.info("Configuración base de la tienda")
  for (const line of created) logger.info(`  creado: ${line}`)
  for (const line of kept) logger.info(`  ya existía: ${line}`)
  logger.info(`Clave publicable (NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY): ${key.token}`)
  logger.warn(
    "Pendiente: la alícuota de impuestos depende de la condición fiscal del cliente, y el costo del envío a domicilio se define con el dueño."
  )
}
