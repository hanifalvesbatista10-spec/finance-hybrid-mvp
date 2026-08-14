"use client";

import {CategoriesManager} from "@/components/finance/CategoriesManager";
import {useAuth} from "@/context/AuthContext";

export default function CategoriasPage(){
  const {profile,adminPreviewProduct,ownerProductAccess}=useAuth();
  const institutional=ownerProductAccess?adminPreviewProduct==="BUSINESS":profile?.role==="INSTITUTIONAL";
  return <CategoriesManager institutional={institutional}/>;
}
