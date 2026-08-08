export type MedicalLink={id:string;name:string;link_type:string;nature:string;status:string;shift_value:number|null;hourly_value:number|null;weekly_hours:number|null;expected_payment_day:number|null};
export type MedicalShift={id:string;professional_link_id:string|null;hospital:string;shift_date:string;start_time:string;end_time:string;hours:number;base_value:number;additional_value:number;total_value:number;expected_payment_date:string|null;status:string;notes:string|null};
export type MedicalReceivable={id:string;service_date:string;source_name:string;description:string|null;amount:number;expected_payment_date:string|null;status:string};
export const medicalCurrency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
export function hoursBetween(start:string,end:string){const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);let a=sh*60+sm,b=eh*60+em;if(b<=a)b+=1440;return Math.round(((b-a)/60)*100)/100}
export const shiftStatus:{[key:string]:string}={SCHEDULED:'Agendado',WORKED:'Trabalhado',BILLED:'Faturado',AWAITING:'Aguardando pagamento',RECEIVED:'Recebido',CANCELED:'Cancelado'};
