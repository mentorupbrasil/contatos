import { CampaignApp } from "./components/CampaignApp";
import { LoginBrand, LoginForm, LoginTrust } from "./components/LoginForm";
import { requireAppUser } from "../lib/auth";
import { getSessionUser } from "../lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSessionUser();

  if (session) {
    try {
      const user = await requireAppUser();
      return <CampaignApp userName={user.name} userEmail={user.email} />;
    } catch {
      // Sessão inválida — mostra login.
    }
  }

  return (
    <main className="login-shell login-shell--simple">
      <section className="login-copy">
        <LoginBrand />

        <div className="login-headline">
          <span className="eyebrow">Rede de lideranças · Imperatriz</span>
          <h1>Entre com seu e-mail e senha</h1>
          <p>
            Cada liderança acessa a própria base. A administração libera os logins e acompanha o
            ranking da rede.
          </p>
        </div>

        <div className="login-actions">
          <LoginForm />
        </div>
        <LoginTrust />
      </section>
    </main>
  );
}
