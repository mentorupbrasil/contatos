import { CampaignApp } from "./components/CampaignApp";
import { LoginForm, LoginTrust } from "./components/LoginForm";
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
      // Sessão sem convite válido — mostra o login de novo.
    }
  }

  return (
    <main className="login-shell">
      <section className="login-copy">
        <div className="brand-lockup brand-lockup--large">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>
            <strong>Rede</strong>
            <small>de Lideranças</small>
          </span>
        </div>

        <div className="login-headline">
          <span className="eyebrow">Organização que cabe no bolso</span>
          <h1>Todo mundo informado. Nenhum contato esquecido.</h1>
          <p>
            Cadastre pessoas com autorização, organize suas lideranças e envie comunicados pelo
            canal oficial do WhatsApp em poucos toques.
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
            <div className="preview-logo">R</div>
            <div className="preview-avatar">AP</div>
          </div>
          <div className="preview-greeting">
            <small>Bom dia, Ana</small>
            <strong>Vamos movimentar a rede?</strong>
          </div>
          <div className="preview-total">
            <span>Contatos ativos</span>
            <strong>1.248</strong>
            <em>+86 nesta semana</em>
          </div>
          <button type="button" className="preview-cta">
            + Cadastrar contato
          </button>
          <div className="preview-message">
            <span>PRÓXIMO DISPARO</span>
            <strong>Encontro de lideranças</strong>
            <small>Sábado, 9h · 1.248 destinatários</small>
          </div>
        </div>
      </aside>
    </main>
  );
}
