import Image from "next/image";
import { cn } from "@/lib/utils";

export function EquityOneLogo({className="h-16 md:h-20 w-auto",priority=false}:{className?:string;priority?:boolean}){
  return <Image src="/equity-one-logo.png" alt="Equity One" width={646} height={734} priority={priority} className={cn("object-contain",className)}/>;
}
