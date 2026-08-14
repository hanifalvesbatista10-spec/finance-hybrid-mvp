"use client";

import {TransactionsManagerV522} from "@/components/finance/TransactionsManagerV522";

export function TransactionsManager(props:{institutional?:boolean;compact?:boolean}){
  return <TransactionsManagerV522 {...props}/>;
}
