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
      <aside className="login-aside" aria-hidden="true">
        <LoginBrand />
        <p className="login-aside-lead">
          Contatos, ranking e comunicados oficiais da rede Luzia Mary em Imperatriz.
        </p>
      </aside>

      <section className="login-copy">
        <div className="login-copy-mobile-brand">
          <LoginBrand />
        </div>

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
