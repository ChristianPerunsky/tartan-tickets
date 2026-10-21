import { OrderPanel } from "../../../components/OrderPanel";

// The checkout / receipt page for one order. The order is loaded in the browser
// from /api/orders/{id}, which checks that it belongs to the person asking.
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // params is a Promise in this version of Next.js
  return (
    <>
      <h1>Your order</h1>
      <OrderPanel orderId={id} />
    </>
  );
}
