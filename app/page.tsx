import { ArrowRight, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CampaignApp } from "./components/CampaignApp";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  if (user) {
    return <CampaignApp userName={user.displayName} userEmail={user.email} />;
  }

  return (
    <main className="login-shell">
      <section className="login-copy">
        <div className="brand-lockup brand-lockup--large">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>
            <strong>Rede</strong>
            <small>de Lideranças</small>
          </span>
        </div>

        <div className="login-headline">
          <span className="eyebrow">Organização que cabe no bolso</span>
          <h1>Todo mundo informado. Nenhum contato esquecido.</h1>
          <p>
            Cadastre pessoas com autorização, organize suas lideranças e envie
            comunicados pelo canal oficial do WhatsApp em poucos toques.
          </p>
        </div>

        <div className="login-actions">
          <a className="button button--primary button--wide" href={chatGPTSignInPath("/")}>
            Entrar com segurança
            <ArrowRight size={19} aria-hidden="true" />
          </a>
          <Link className="button button--ghost button--wide" href="/demo">
            Ver demonstração
          </Link>
        </div>

        <div className="trust-row" aria-label="Recursos de segurança">
          <span><LockKeyhole size={16} /> Acesso protegido</span>
          <span><ShieldCheck size={16} /> Consentimento registrado</span>
          <span><MessageCircle size={16} /> API oficial</span>
        </div>
      </section>

      <aside className="login-preview" aria-label="Prévia do painel">
        <div className="preview-phone">
          <div className="preview-status"><span>9:41</span><span>● ● ●</span></div>
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
          <button type="button" className="preview-cta">+ Cadastrar contato</button>
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
