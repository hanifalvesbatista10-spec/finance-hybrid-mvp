import { LoginClient } from "./LoginClient";
type Props={searchParams:Promise<{next?:string|string[]}>};
export default async function LoginPage({searchParams}:Props){const p=await searchParams;const raw=Array.isArray(p.next)?p.next[0]:p.next;const next=raw&&raw.startsWith('/')?raw:'';return <LoginClient initialNext={next}/>}
