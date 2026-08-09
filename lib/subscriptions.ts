export type SubscriptionPlan = "PERSONAL" | "BUSINESS" | "MEDICAL";

export type SubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELED"
  | "EXPIRED";

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  starts_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  access_mode: "MANUAL" | "PROVIDER" | "LIFETIME";
  payment_provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  last_payment_at: string | null;
  next_payment_at: string | null;
  canceled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function subscriptionIsActive(
  subscription: Subscription | null,
) {
  if (!subscription) return false;
  if (subscription.status !== "ACTIVE") return false;
  if (subscription.access_mode === "LIFETIME") return true;
  if (!subscription.current_period_end) return false;

  return new Date(subscription.current_period_end).getTime() > Date.now();
}

export function subscriptionStatusLabel(
  subscription: Subscription | null,
) {
  if (!subscription) return "Sem assinatura";

  if (
    subscription.status === "ACTIVE" &&
    subscription.access_mode !== "LIFETIME" &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() <= Date.now()
  ) {
    return "Vencida";
  }

  const labels: Record<SubscriptionStatus, string> = {
    PENDING: "Aguardando liberação",
    ACTIVE: "Ativa",
    PAST_DUE: "Pagamento pendente",
    SUSPENDED: "Suspensa",
    CANCELED: "Cancelada",
    EXPIRED: "Vencida",
  };

  return labels[subscription.status];
}

export function formatSubscriptionDate(value: string | null) {
  if (!value) return "Sem vencimento";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));
}
