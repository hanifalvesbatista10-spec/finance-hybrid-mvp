import { LoginClient } from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; plan?: string }>;
}) {
  const params = await searchParams;

  return (
    <LoginClient
      initialMode={params.mode === "register" ? "register" : "login"}
      initialRole={
        params.plan === "INSTITUTIONAL" ? "INSTITUTIONAL" : "PERSONAL"
      }
    />
  );
}
