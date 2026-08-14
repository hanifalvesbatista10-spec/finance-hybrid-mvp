"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { currency, type Transaction } from "@/lib/finance";

type Bucket={label:string;income:number;expense:number;net:number};

export function MonthlyCashFlowChart({items,periodKey,title,description}:{items:Transaction[];periodKey:string;title:string;description:string}){
 const points=useMemo(()=>buildMonthPoints(items,periodKey),[items,periodKey]);
 const totals=useMemo(()=>points.reduce((acc,p)=>({income:acc.income+p.income,expense:acc.expense+p.expense,net:p.net}),{income:0,expense:0,net:0}),[points]);
 const max=Math.max(...points.flatMap(p=>[p.income,p.expense]),1);
 const width=1000,height=300,left=36,right=20,top=22,bottom=38,plotW=width-left-right,plotH=height-top-bottom;
 const x=(i:number)=>left+(i/Math.max(points.length-1,1))*plotW;
 const y=(v:number)=>top+plotH-(Math.max(0,v)/max)*plotH;
 const incomePath=points.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p.income).toFixed(1)}`).join(" ");
 const expensePath=points.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p.expense).toFixed(1)}`).join(" ");
 return <section className="equity-card rounded-3xl bg-white p-6">
  <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#d2aa51]/10 text-[#9b772c]"><BarChart3 className="size-5"/></span></div>
  <div className="mt-6 grid gap-3 sm:grid-cols-3"><Mini label="Entradas" value={totals.income} tone="green"/><Mini label="Saídas" value={totals.expense} tone="red"/><Mini label="Resultado" value={totals.net} tone={totals.net>=0?"gold":"red"}/></div>
  {items.length===0?<div className="mt-6 grid h-64 place-items-center rounded-2xl bg-slate-50 text-sm text-slate-400">Nenhum lançamento neste mês.</div>:<div className="mt-6 overflow-hidden rounded-2xl bg-[#faf9f6] p-3"><svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full" role="img" aria-label="Gráfico mensal de entradas e saídas">{[0,.25,.5,.75,1].map(step=>{const gy=top+plotH-step*plotH;return <line key={step} x1={left} x2={width-right} y1={gy} y2={gy} stroke="#e5e7eb" strokeWidth="1"/>})}<path d={incomePath} fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d={expensePath} fill="none" stroke="#e11d48" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 7"/>{points.map((p,i)=><text key={`${p.label}-${i}`} x={x(i)} y={height-12} textAnchor="middle" fontSize="11" fill="#94a3b8">{p.label}</text>)}</svg><div className="flex flex-wrap items-center justify-center gap-5 pb-2 text-xs font-bold text-slate-500"><span className="flex items-center gap-2"><i className="h-1 w-5 rounded-full bg-emerald-600"/>Entradas</span><span className="flex items-center gap-2"><i className="h-1 w-5 rounded-full bg-rose-600"/>Saídas</span></div></div>}
 </section>
}

function Mini({label,value,tone}:{label:string;value:number;tone:"green"|"red"|"gold"}){const cls=tone==="green"?"bg-emerald-50 text-emerald-800":tone==="red"?"bg-rose-50 text-rose-800":"bg-[#c9a34d]/10 text-[#8a6826]";return <div className={`rounded-2xl p-4 ${cls}`}><p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-lg font-black">{currency.format(value)}</p></div>}

function buildMonthPoints(items:Transaction[],periodKey:string):Bucket[]{
 const [year,month]=periodKey.split("-").map(Number),days=new Date(year,month,0).getDate(),bucketCount=10,bucketSize=Math.ceil(days/bucketCount);
 const buckets=Array.from({length:Math.ceil(days/bucketSize)},(_,i)=>({index:i,income:0,expense:0}));
 for(const item of items){const day=Number(item.occurred_on.slice(8,10)),index=Math.min(Math.floor((Math.max(day,1)-1)/bucketSize),buckets.length-1),bucket=buckets[index];if(!bucket)continue;if(item.type==="INCOME")bucket.income+=Number(item.amount);else bucket.expense+=Number(item.amount)}
 let net=0;return buckets.map(bucket=>{const startDay=bucket.index*bucketSize+1;net+=bucket.income-bucket.expense;return {label:String(startDay).padStart(2,"0"),income:bucket.income,expense:bucket.expense,net}})
}
