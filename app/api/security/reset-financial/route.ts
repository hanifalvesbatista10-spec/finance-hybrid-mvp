import {NextResponse} from "next/server";
import {adminSupabase} from "@/lib/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";

function issuedAt(token:string){try{return Number(JSON.parse(Buffer.from(token.split('.')[1]||'', 'base64url').toString()).iat||0)}catch{return 0}}
function range(scope:string,start?:string,end?:string){const n=new Date(),y=n.getFullYear(),m=n.getMonth(),d=n.getDate(),f=(x:Date)=>x.toISOString().slice(0,10);if(scope==='DAY')return[f(new Date(y,m,d)),f(new Date(y,m,d))];if(scope==='MONTH')return[f(new Date(y,m,1)),f(new Date(y,m+1,0))];if(scope==='HALF_YEAR'){const s=m<6?0:6;return[f(new Date(y,s,1)),f(new Date(y,s+6,0))]}if(scope==='YEAR')return[f(new Date(y,0,1)),f(new Date(y,11,31))];if(scope==='RANGE')return[start||null,end||null];return[null,null]}

export async function POST(request:Request){
 const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return NextResponse.json({error:'Sessão não encontrada.'},{status:401});
 const {data:{user},error}=await adminSupabase.auth.getUser(token);
 if(error||!user)return NextResponse.json({error:'Sessão inválida.'},{status:401});
 if(Date.now()/1000-issuedAt(token)>90)return NextResponse.json({error:'Confirme sua senha novamente para realizar o reset.'},{status:403});
 const body=await request.json();
 if(String(body.confirmation||'')!=='RESETAR')return NextResponse.json({error:'Digite RESETAR para confirmar.'},{status:400});
 const scope=String(body.scope||'');
 if(!['DAY','MONTH','HALF_YEAR','YEAR','RANGE','ALL'].includes(scope))return NextResponse.json({error:'Tipo de reset inválido.'},{status:400});
 const [start,end]=range(scope,body.start,body.end);
 if(scope!=='ALL'&&(!start||!end))return NextResponse.json({error:'Período inválido.'},{status:400});
 const reset=await adminSupabase.rpc('equity_reset_financial_data',{p_user_id:user.id,p_scope:scope,p_start:start,p_end:end});
 if(reset.error)return NextResponse.json({error:reset.error.message},{status:400});
 return NextResponse.json({ok:true,result:reset.data});
}
