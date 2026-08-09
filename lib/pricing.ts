import { adminSupabase } from "@/lib/admin";

export type CheckoutPlan = "PERSONAL" | "BUSINESS" | "MEDICAL";

export const DEFAULT_PLAN_CENTS: Record<CheckoutPlan, number> = {
  PERSONAL: 1990,
  BUSINESS: 7990,
  MEDICAL: 5990,
};

export const DEFAULT_PLAN_DESCRIPTIONS: Record<CheckoutPlan, string> = {
  PERSONAL: "Equity One Pessoal — Gestão Financeira",
  BUSINESS: "Equity One Negócios — Gestão Financeira Empresarial",
  MEDICAL: "Equity One Médicos — Gestão Financeira e Carreira Médica",
};

export type PlatformPricingSettings = {
  personal_price_cents: number;
  business_price_cents: number;
  medical_price_cents: number;
  personal_checkout_enabled: boolean;
  business_checkout_enabled: boolean;
  medical_checkout_enabled: boolean;
};

export async function getPlatformPricingSettings(): Promise<PlatformPricingSettings> {
  const { data } = await adminSupabase
    .from("platform_settings")
    .select(
      "personal_price_cents,business_price_cents,medical_price_cents,personal_checkout_enabled,business_checkout_enabled,medical_checkout_enabled",
    )
    .eq("id", 1)
    .maybeSingle();

  return {
    personal_price_cents: Number(data?.personal_price_cents ?? DEFAULT_PLAN_CENTS.PERSONAL),
    business_price_cents: Number(data?.business_price_cents ?? DEFAULT_PLAN_CENTS.BUSINESS),
    medical_price_cents: Number(data?.medical_price_cents ?? DEFAULT_PLAN_CENTS.MEDICAL),
    personal_checkout_enabled: Boolean(data?.personal_checkout_enabled ?? true),
    business_checkout_enabled: Boolean(data?.business_checkout_enabled ?? true),
    medical_checkout_enabled: Boolean(data?.medical_checkout_enabled ?? true),
  };
}

export async function getDynamicPlanConfig() {
  const pricing = await getPlatformPricingSettings();

  return {
    PERSONAL: {
      amount: pricing.personal_price_cents,
      description: DEFAULT_PLAN_DESCRIPTIONS.PERSONAL,
      enabled: pricing.personal_checkout_enabled,
    },
    BUSINESS: {
      amount: pricing.business_price_cents,
      description: DEFAULT_PLAN_DESCRIPTIONS.BUSINESS,
      enabled: pricing.business_checkout_enabled,
    },
    MEDICAL: {
      amount: pricing.medical_price_cents,
      description: DEFAULT_PLAN_DESCRIPTIONS.MEDICAL,
      enabled: pricing.medical_checkout_enabled,
    },
  } as const;
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
