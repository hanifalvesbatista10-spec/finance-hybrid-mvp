"use client";

import { FinanceOverviewV522 } from "@/components/finance/FinanceOverviewV522";

export function FinanceOverview({institutional}:{institutional:boolean}){
  return <FinanceOverviewV522 institutional={institutional}/>;
}
