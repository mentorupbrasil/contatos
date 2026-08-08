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
    <main className="login-shell">
      <section className="login-copy">
        <LoginBrand />

        <div className="login-headline">
          <span className="eyebrow">Rede Luzia Mary · Imperatriz</span>
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

      <aside className="login-preview" aria-label="Prévia do painel">
        <div className="preview-phone">
          <div className="preview-status">
            <span>9:41</span>
            <span>● ● ●</span>
          </div>
          <div className="preview-header">
            <div className="preview-logo">LM</div>
            <div className="preview-avatar">AP</div>
          </div>
          <div className="preview-greeting">
            <small>Bom dia</small>
            <strong>Vamos movimentar a rede?</strong>
          </div>
          <div className="preview-total">
            <span>Contatos ativos</span>
            <strong>—</strong>
            <em>Ranking das lideranças</em>
          </div>
          <button type="button" className="preview-cta">
            + Cadastrar contato
          </button>
          <div className="preview-message">
            <span>IMPERATRIZ-MA</span>
            <strong>Bairros da cidade</strong>
            <small>Ou cadastre outro município só com a cidade</small>
          </div>
        </div>
      </aside>
    </main>
  );
}
