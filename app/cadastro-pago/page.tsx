import { PaidRegistrationClient } from "./PaidRegistrationClient";
type PageProps={searchParams:Promise<{token?:string|string[]}>};
export default async function PaidRegistrationPage({searchParams}:PageProps){
  const params=await searchParams; const token=Array.isArray(params.token)?params.token[0]??"":params.token??"";
  return <PaidRegistrationClient token={token}/>;
}
