// Экран успешного оформления заказа
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { CheckCircle2 } from "lucide-react";

// Определяем маршрут «/order-success/$id»
export const Route = createFileRoute("/order-success/$id")({
  head: () => ({ meta: [{ title: "Заказ оформлен — Kupiks" }] }),
  component: OrderSuccess,
});

// Компонент экрана успеха
function OrderSuccess() {
  const { id } = Route.useParams();
  return (
    <AppLayout>
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
        <h1 className="mt-4 text-3xl font-bold">Заказ оформлен!</h1>
        <p className="mt-2 text-muted-foreground">
          Номер вашего заказа:{" "}
          <span className="font-mono text-foreground">{id.slice(0, 8).toUpperCase()}</span>
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/account"
            className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            Мои заказы
          </Link>
          <Link
            to="/catalog"
            className="rounded-xl border px-5 py-3 font-semibold hover:bg-accent"
          >
            Продолжить покупки
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
