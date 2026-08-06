import { LoginClient } from "./LoginClient";
import type { ProfileRole } from "@/context/AuthContext";

type LoginPageProps = {
  searchParams: Promise<{
    mode?: string | string[];
    plan?: string | string[];
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  const rawMode = Array.isArray(params.mode)
    ? params.mode[0]
    : params.mode;

  const rawPlan = Array.isArray(params.plan)
    ? params.plan[0]
    : params.plan;

  const initialMode =
    rawMode === "register" ? "register" : "login";

  const initialRole: ProfileRole =
    rawPlan === "INSTITUTIONAL"
      ? "INSTITUTIONAL"
      : "PERSONAL";

  return (
    <LoginClient
      initialMode={initialMode}
      initialRole={initialRole}
    />
  );
}
