"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function centsToBRLInput(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

export function brlInputToNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

export function numberToBRLInput(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return centsToBRLInput(Math.round((Number.isFinite(numeric) ? numeric : 0) * 100));
}

export function MoneyInput({
  value,
  onValueChange,
  className,
  placeholder = "R$ 0,00",
  required = false,
  disabled = false,
}: {
  value: string;
  onValueChange: (formatted: string, numeric: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="off"
      value={value}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className={cn("font-semibold tabular-nums", className)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        if (!digits) {
          onValueChange("", 0);
          return;
        }
        const cents = Number(digits);
        onValueChange(centsToBRLInput(cents), cents / 100);
      }}
    />
  );
}
