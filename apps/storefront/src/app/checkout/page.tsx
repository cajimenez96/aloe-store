import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { PaymentMethod } from "@/components/checkout/payment-method";
import { getCart } from "@/lib/cart/api";
import { buildCartView } from "@/lib/cart/model";
import { getTransferPercent } from "@/lib/data";
import { getShippingChoices } from "@/lib/checkout/api";
import { formatPrice } from "@/lib/price";

export const metadata: Metadata = {
  title: "Finalizar compra | Aloe",
  robots: { index: false },
};

async function Checkout() {
  const raw = await getCart();
  const cart = buildCartView(raw);
  if (!raw || cart.lines.length === 0) redirect("/carrito");

  const [choices, transferPercent] = await Promise.all([
    getShippingChoices(raw.id),
    getTransferPercent(),
  ]);
  const method =
    raw.metadata?.payment_method === "card" ||
    raw.metadata?.payment_method === "transfer"
      ? raw.metadata.payment_method
      : null;
  // Con transferencia el total de Medusa ya trae el descuento; el de lista se reconstruye solo para mostrarlo.
  const listTotal =
    method === "transfer" && transferPercent > 0
      ? cart.total / (1 - transferPercent / 100)
      : cart.total;
  const address = raw.shipping_address;
  const selected = raw.shipping_methods?.[0]?.shipping_option_id ?? undefined;

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-10">
        <CheckoutForm
          choices={choices}
          currencyCode={cart.currencyCode}
          initial={{
            name: [address?.first_name, address?.last_name]
              .filter(Boolean)
              .join(" "),
            email: raw.email ?? "",
            phone: address?.phone ?? "",
            document:
              typeof raw.metadata?.customer_document === "string"
                ? raw.metadata.customer_document
                : "",
            shippingOptionId: selected,
            street: address?.address_1 ?? "",
            city: address?.city ?? "",
            province: address?.province ?? "",
            postalCode: address?.postal_code ?? "",
          }}
        />
        <PaymentMethod
          initial={method}
          total={cart.total}
          itemsSubtotal={cart.subtotal}
        shippingTotal={cart.shippingTotal}
          currencyCode={cart.currencyCode}
          transferPercent={transferPercent}
        />
      </div>
      <aside
        aria-label="Resumen del pedido"
        className="h-fit rounded-lg border border-hairline p-5"
      >
        <h2 className="mb-4 font-display text-2xl">Tu pedido</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span>
                {line.quantity} × {line.title}
                {line.variantTitle ? ` (${line.variantTitle})` : ""}
              </span>
              <span>{formatPrice(line.total, cart.currencyCode)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 flex flex-col gap-1 border-t border-hairline pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatPrice(cart.subtotal, cart.currencyCode)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Envío</dt>
            <dd>
              {cart.shippingTotal > 0
                ? formatPrice(cart.shippingTotal, cart.currencyCode)
                : "Sin costo"}
            </dd>
          </div>
          <div className="flex justify-between text-base">
            <dt>Total</dt>
            <dd>{formatPrice(cart.total, cart.currencyCode)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <h1 className="font-display text-4xl">Finalizar compra</h1>
      <Suspense fallback={<p aria-busy="true">Cargando…</p>}>
        <Checkout />
      </Suspense>
    </main>
  );
}
