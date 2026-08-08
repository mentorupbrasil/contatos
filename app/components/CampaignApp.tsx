"use client";

import {
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  ContactRound,
  Download,
  FileClock,
  Home,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
  Wifi,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "inicio" | "contatos" | "disparos" | "mais";
type AppRole = "admin" | "leader";
type ContactStatus = "ativo" | "saiu";
type CampaignStatus = "agendado" | "enviado" | "rascunho";

type Contact = {
  id: number;
  name: string;
  phone: string;
  neighborhood: string;
  leader: string;
  createdAt: string;
  status: ContactStatus;
};

type Campaign = {
  id: number;
  title: string;
  date: string;
  recipients: number;
  delivered?: number;
  read?: number;
  status: CampaignStatus;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const initialContacts: Contact[] = [
  { id: 1, name: "Carlos Alberto", phone: "(85) 9 8765-4321", neighborhood: "Jangurussu", leader: "Ana Paula", createdAt: "Hoje, 10:42", status: "ativo" },
  { id: 2, name: "Márcia Fernandes", phone: "(85) 9 9441-0872", neighborhood: "Messejana", leader: "Ana Paula", createdAt: "Hoje, 09:18", status: "ativo" },
  { id: 3, name: "João Batista", phone: "(85) 9 8224-5510", neighborhood: "Barroso", leader: "Rafael Lima", createdAt: "Ontem, 18:06", status: "ativo" },
  { id: 4, name: "Denise Moura", phone: "(85) 9 8012-4497", neighborhood: "Passaré", leader: "Rafael Lima", createdAt: "Ontem, 15:32", status: "ativo" },
  { id: 5, name: "Pedro Henrique", phone: "(85) 9 7320-1109", neighborhood: "Conjunto Palmeiras", leader: "Luciana Alves", createdAt: "Sex, 11:20", status: "saiu" },
];

const initialCampaigns: Campaign[] = [
  { id: 1, title: "Encontro de lideranças", date: "Sáb, 9h", recipients: 1248, status: "agendado" },
  { id: 2, title: "Resumo da semana", date: "02 ago, 18h", recipients: 1196, delivered: 1168, read: 892, status: "enviado" },
  { id: 3, title: "Agenda nos bairros", date: "28 jul, 12h", recipients: 1124, delivered: 1097, read: 841, status: "enviado" },
];

const neighborhoods = ["Todos", "Jangurussu", "Messejana", "Barroso", "Passaré"];

export function CampaignApp({
  demo = false,
  userName,
  userEmail,
}: {
  demo?: boolean;
  userName: string;
  userEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("inicio");
  const [contacts, setContacts] = useState<Contact[]>(demo ? initialContacts : []);
  const [campaigns, setCampaigns] = useState<Campaign[]>(demo ? initialCampaigns : []);
  const [activeBase, setActiveBase] = useState(demo ? 1248 : 0);
  const [role, setRole] = useState<AppRole>("admin");
  const [whatsappConnected, setWhatsappConnected] = useState(demo);
  const [loading, setLoading] = useState(!demo);
  const [contactSheet, setContactSheet] = useState(false);
  const [campaignSheet, setCampaignSheet] = useState(false);
  const [leaderSheet, setLeaderSheet] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  const firstName = userName.split(" ")[0] || "Liderança";
  const activeTotal = demo
    ? activeBase + contacts.filter((contact) => contact.id > 5 && contact.status === "ativo").length
    : activeBase;

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const result = await response.json() as {
          error?: string;
          user?: { role: AppRole };
          stats?: { activeContacts: number };
          contacts?: Array<Record<string, unknown>>;
          campaigns?: Array<Record<string, unknown>>;
          whatsappConfigured?: boolean;
        };
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar a rede.");
        if (cancelled) return;
        setRole(result.user?.role ?? "leader");
        setActiveBase(Number(result.stats?.activeContacts ?? 0));
        setContacts((result.contacts ?? []).map(mapApiContact));
        setCampaigns((result.campaigns ?? []).map(mapApiCampaign));
        setWhatsappConnected(Boolean(result.whatsappConfigured));
      } catch (error) {
        if (!cancelled) setToast(error instanceof Error ? error.message : "Não foi possível carregar a rede.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { cancelled = true; };
  }, [demo]);

  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return contacts.filter((contact) => {
      const matchesFilter = filter === "Todos" || contact.neighborhood === filter;
      const matchesSearch = !term || `${contact.name} ${contact.phone} ${contact.neighborhood}`.toLocaleLowerCase("pt-BR").includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [contacts, filter, search]);

  const showToast = (message: string) => setToast(message);

  async function installApp() {
    if (!installPrompt) {
      showToast("No iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início.");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const neighborhood = String(form.get("neighborhood") || "Não informado");
    if (!name || !phone) return;

    if (demo) {
      setContacts((current) => [{
        id: Date.now(),
        name,
        phone,
        neighborhood,
        leader: firstName,
        createdAt: "Agora",
        status: "ativo",
      }, ...current]);
      setContactSheet(false);
      showToast(`${name} entrou na rede com consentimento registrado.`);
      return;
    }

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, neighborhood, consentConfirmed: true }),
      });
      const result = await response.json() as { error?: string; contact?: Record<string, unknown> };
      if (!response.ok || !result.contact) throw new Error(result.error || "Não foi possível salvar o contato.");
      setContacts((current) => [mapApiContact(result.contact as Record<string, unknown>), ...current]);
      setActiveBase((current) => current + 1);
      setContactSheet(false);
      showToast(`${name} entrou na rede com consentimento registrado.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar o contato.");
    }
  }

  async function processCampaignQueue(campaignId: number, totalRecipients: number) {
    const total = Math.max(1, totalRecipients);
    let complete = false;
    let guard = 0;
    let finalSummary: { remaining?: number; sent?: number; delivered?: number; read?: number } = {};
    while (!complete && guard < Math.ceil(total / 25) + 5) {
      guard += 1;
      const response = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
      const result = await response.json() as { error?: string; complete?: boolean; summary?: typeof finalSummary };
      if (!response.ok) throw new Error(result.error || "A fila não pôde continuar.");
      finalSummary = result.summary ?? {};
      const remaining = Number(finalSummary.remaining ?? 0);
      setProgress(Math.min(98, Math.max(10, Math.round(((total - remaining) / total) * 100))));
      complete = Boolean(result.complete);
    }
    if (!complete) throw new Error("A fila foi pausada e pode ser retomada pelo histórico.");
    return finalSummary;
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "Novo comunicado");
    const templateName = String(form.get("template") || "atualizacao_semanal");
    setSending(true);
    setProgress(8);

    if (!demo) {
      let createdCampaign: { id: number; totalRecipients: number } | null = null;
      try {
        const createResponse = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            templateName,
            templateLanguage: "pt_BR",
            includeNameParameter: true,
            complianceConfirmed: true,
          }),
        });
        const createResult = await createResponse.json() as { error?: string; campaign?: { id: number; totalRecipients: number } };
        if (!createResponse.ok || !createResult.campaign) throw new Error(createResult.error || "Não foi possível criar o disparo.");
        createdCampaign = createResult.campaign;
        setCampaigns((current) => [{ id: createdCampaign!.id, title, date: "Na fila", recipients: createdCampaign!.totalRecipients, status: "agendado" }, ...current]);
        const summary = await processCampaignQueue(createdCampaign.id, createdCampaign.totalRecipients);
        setCampaigns((current) => current.map((item) => item.id === createdCampaign!.id ? {
          ...item,
          date: "Agora",
          status: "enviado",
          delivered: Number(summary.delivered ?? summary.sent ?? 0),
          read: Number(summary.read ?? 0),
        } : item));
        setProgress(100);
        await new Promise((resolve) => window.setTimeout(resolve, 380));
        setCampaignSheet(false);
        setTab("disparos");
        showToast("Disparo concluído pela fila oficial do WhatsApp.");
      } catch (error) {
        setCampaignSheet(false);
        setTab("disparos");
        showToast(`${createdCampaign ? "Disparo salvo. " : ""}${error instanceof Error ? error.message : "Não foi possível iniciar o envio."}`);
      } finally {
        setSending(false);
        setProgress(0);
      }
      return;
    }

    const timer = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(100, current + Math.ceil(Math.random() * 18));
        if (next === 100) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            setCampaigns((currentCampaigns) => [
              { id: Date.now(), title, date: "Agora", recipients: activeTotal, delivered: activeTotal, read: 0, status: "enviado" },
              ...currentCampaigns,
            ]);
            setSending(false);
            setCampaignSheet(false);
            setProgress(0);
            setTab("disparos");
            showToast(demo ? "Disparo simulado concluído." : "Disparo colocado na fila oficial do WhatsApp.");
          }, 450);
        }
        return next;
      });
    }, 260);
  }

  async function resumeCampaign(campaign: Campaign) {
    if (demo) {
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, date: "Agora", status: "enviado", delivered: item.recipients, read: 0 } : item));
      showToast("Fila simulada retomada e concluída.");
      return;
    }
    setSending(true);
    setProgress(8);
    try {
      const summary = await processCampaignQueue(campaign.id, campaign.recipients);
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? {
        ...item,
        date: "Agora",
        status: "enviado",
        delivered: Number(summary.delivered ?? summary.sent ?? 0),
        read: Number(summary.read ?? 0),
      } : item));
      showToast("Fila retomada e disparo concluído.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível retomar a fila.");
    } finally {
      setSending(false);
      setProgress(0);
    }
  }

  async function addLeader(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("leaderName") || "").trim();
    const email = String(form.get("leaderEmail") || "").trim();
    const newRole = String(form.get("leaderRole") || "leader");
    if (demo) {
      setLeaderSheet(false);
      showToast(`Convite de demonstração preparado para ${name}.`);
      return;
    }
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role: newRole }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível liberar o acesso.");
      setLeaderSheet(false);
      showToast(`Acesso liberado para ${name}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível liberar o acesso.");
    }
  }

  return (
    <div className="app-shell">
      {demo && (
        <div className="demo-banner">
          <span><Sparkles size={15} /> Você está na demonstração</span>
          <Link href="/">Entrar no sistema</Link>
        </div>
      )}

      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span><strong>Rede</strong><small>de Lideranças</small></span>
        </div>
        <div className="header-actions">
          <button className="icon-button" aria-label="Notificações"><Bell size={20} /></button>
          <button className="avatar" aria-label={`Perfil de ${firstName}`}>{initials(userName)}</button>
        </div>
      </header>

      <main className="app-main">
        {loading && <div className="sync-line"><LoaderCircle size={15} /> Sincronizando a rede…</div>}
        {sending && !campaignSheet && <div className="sync-line"><LoaderCircle size={15} /> Processando fila oficial… {progress}%</div>}
        {tab === "inicio" && (
          <HomeView
            firstName={firstName}
            activeTotal={activeTotal}
            campaign={campaigns.find((item) => item.status === "agendado")}
            onAddContact={() => setContactSheet(true)}
            onNewCampaign={() => setCampaignSheet(true)}
            onNavigate={setTab}
            whatsappConnected={whatsappConnected}
            canSend={role === "admin"}
            onBlockedAction={() => showToast("Somente administradoras podem criar disparos.")}
          />
        )}

        {tab === "contatos" && (
          <ContactsView
            contacts={filteredContacts}
            search={search}
            onSearch={setSearch}
            filter={filter}
            onFilter={setFilter}
            onAdd={() => setContactSheet(true)}
          />
        )}

        {tab === "disparos" && (
          <CampaignsView campaigns={campaigns} canSend={role === "admin"} onNew={() => role === "admin" ? setCampaignSheet(true) : showToast("Somente administradoras podem criar disparos.")} onResume={resumeCampaign} />
        )}

        {tab === "mais" && (
          <MoreView userName={userName} userEmail={userEmail} role={role} onInstall={installApp} onManageLeaders={() => role === "admin" ? setLeaderSheet(true) : showToast("Somente administradoras gerenciam acessos.")} />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        <NavButton active={tab === "inicio"} onClick={() => setTab("inicio")} icon={<Home size={21} />} label="Início" />
        <NavButton active={tab === "contatos"} onClick={() => setTab("contatos")} icon={<ContactRound size={21} />} label="Contatos" />
        <NavButton active={tab === "disparos"} onClick={() => setTab("disparos")} icon={<MessagesSquare size={21} />} label="Disparos" />
        <NavButton active={tab === "mais"} onClick={() => setTab("mais")} icon={<Menu size={21} />} label="Mais" />
      </nav>

      {contactSheet && (
        <Sheet title="Novo contato" subtitle="Leva menos de um minuto" onClose={() => setContactSheet(false)}>
          <form className="sheet-form" onSubmit={addContact}>
            <label>
              Nome completo
              <input name="name" autoComplete="name" placeholder="Ex.: Maria de Fátima" required />
            </label>
            <label>
              WhatsApp
              <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(85) 9 9999-9999" required />
            </label>
            <label>
              Bairro
              <select name="neighborhood" defaultValue="">
                <option value="" disabled>Selecione o bairro</option>
                <option>Jangurussu</option>
                <option>Messejana</option>
                <option>Barroso</option>
                <option>Passaré</option>
                <option>Conjunto Palmeiras</option>
                <option>Outro</option>
              </select>
            </label>
            <label className="consent-box">
              <input name="consent" type="checkbox" required />
              <span>
                <strong>A pessoa autorizou o cadastro</strong>
                <small>Ela foi informada de que receberá comunicados no WhatsApp e poderá sair quando quiser.</small>
              </span>
            </label>
            <button className="button button--primary button--wide" type="submit">
              <Check size={19} /> Salvar contato
            </button>
          </form>
        </Sheet>
      )}

      {campaignSheet && (
        <Sheet title="Novo disparo" subtitle="Um comunicado para toda a rede ativa" onClose={() => !sending && setCampaignSheet(false)}>
          <form className="sheet-form" onSubmit={createCampaign}>
            <label>
              Nome interno
              <input name="title" defaultValue="Atualização da semana" required />
            </label>
            <label>
              Modelo aprovado no WhatsApp
              <select name="template" defaultValue="atualizacao_semanal">
                <option value="atualizacao_semanal">Atualização semanal</option>
                <option value="convite_encontro">Convite para encontro</option>
                <option value="agenda_bairro">Agenda no bairro</option>
              </select>
            </label>
            <div className="audience-card">
              <span className="audience-icon"><Users size={20} /></span>
              <span><strong>Todos os contatos ativos</strong><small>{formatNumber(activeTotal)} pessoas com consentimento</small></span>
              <CheckCircle2 size={20} />
            </div>
            <div className="phone-preview">
              <div className="phone-preview__top"><MessageCircle size={17} /> Prévia no WhatsApp</div>
              <div className="message-bubble">
                Olá, <strong>Maria</strong>! Aqui é a equipe da Deputada [Nome]. Temos uma atualização importante da nossa agenda para você.
                <small>10:42 ✓✓</small>
              </div>
              <div className="message-optout">Para não receber mais mensagens, responda SAIR.</div>
            </div>
            <label className="consent-box consent-box--compact">
              <input name="confirm" type="checkbox" required />
              <span><strong>Revisei remetente, conteúdo e descadastramento.</strong></span>
            </label>
            {sending ? (
              <div className="send-progress" aria-live="polite">
                <div><span>Preparando fila oficial</span><strong>{progress}%</strong></div>
                <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                <small>Pode deixar aberto. Se a internet cair, a fila continua salva.</small>
              </div>
            ) : (
              <button className="button button--primary button--wide" type="submit">
                <Send size={18} /> Confirmar e disparar
              </button>
            )}
          </form>
        </Sheet>
      )}

      {leaderSheet && (
        <Sheet title="Novo acesso" subtitle="Libere uma liderança pelo e-mail" onClose={() => setLeaderSheet(false)}>
          <form className="sheet-form" onSubmit={addLeader}>
            <label>
              Nome da liderança
              <input name="leaderName" autoComplete="name" placeholder="Ex.: Rafael Lima" required />
            </label>
            <label>
              E-mail de acesso
              <input name="leaderEmail" type="email" autoComplete="email" placeholder="lideranca@exemplo.com" required />
            </label>
            <label>
              Permissão
              <select name="leaderRole" defaultValue="leader">
                <option value="leader">Liderança — cadastra e vê seus contatos</option>
                <option value="admin">Administração — também realiza disparos</option>
              </select>
            </label>
            <div className="access-note"><ShieldCheck size={18} /><span><strong>Sem senha para decorar</strong><small>A pessoa entra com a própria conta e o sistema confere este e-mail.</small></span></div>
            <button className="button button--primary button--wide" type="submit"><UserPlus size={18} /> Liberar acesso</button>
          </form>
        </Sheet>
      )}

      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function HomeView({
  firstName,
  activeTotal,
  campaign,
  onAddContact,
  onNewCampaign,
  onNavigate,
  whatsappConnected,
  canSend,
  onBlockedAction,
}: {
  firstName: string;
  activeTotal: number;
  campaign?: Campaign;
  onAddContact: () => void;
  onNewCampaign: () => void;
  onNavigate: (tab: Tab) => void;
  whatsappConnected: boolean;
  canSend: boolean;
  onBlockedAction: () => void;
}) {
  return (
    <div className="view-stack home-view">
      <section className="welcome-row">
        <div><span>Bom dia, {firstName}</span><h1>Vamos movimentar a rede?</h1></div>
        <span className={`connection-pill ${whatsappConnected ? "" : "connection-pill--off"}`}><Wifi size={14} /> {whatsappConnected ? "WhatsApp conectado" : "Configuração pendente"}</span>
      </section>

      <section className="hero-card">
        <div className="hero-card__top">
          <span>Contatos ativos</span>
          <button aria-label="Ver detalhes" onClick={() => onNavigate("contatos")}><ChevronRight size={20} /></button>
        </div>
        <strong className="hero-number">{formatNumber(activeTotal)}</strong>
        <div className="hero-trend"><span>+86</span> nesta semana</div>
        <div className="hero-spark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      </section>

      <section className="quick-actions" aria-label="Ações rápidas">
        <button className="quick-action quick-action--primary" onClick={onAddContact}>
          <span><UserPlus size={22} /></span><strong>Cadastrar<br />contato</strong><Plus size={18} />
        </button>
        <button className="quick-action" onClick={canSend ? onNewCampaign : onBlockedAction}>
          <span><Send size={22} /></span><strong>Novo<br />disparo</strong><ChevronRight size={18} />
        </button>
      </section>

      {campaign && (
        <section className="section-card upcoming-card">
          <div className="section-heading">
            <div><span className="eyebrow">Próximo disparo</span><h2>{campaign.title}</h2></div>
            <span className="status status--scheduled"><Clock3 size={13} /> Agendado</span>
          </div>
          <div className="upcoming-meta">
            <span><CalendarClock size={18} /><small>Quando<strong>{campaign.date}</strong></small></span>
            <span><Users size={18} /><small>Destinatários<strong>{formatNumber(campaign.recipients)}</strong></small></span>
          </div>
          <button className="text-button" onClick={() => onNavigate("disparos")}>Ver detalhes <ChevronRight size={17} /></button>
        </section>
      )}

      <section className="section-card pulse-card">
        <div className="section-heading">
          <div><span className="eyebrow">Pulso da rede</span><h2>Uma semana forte</h2></div>
          <span className="pulse-score">92%</span>
        </div>
        <p>Dos contatos cadastrados, 92% seguem ativos e recebendo as atualizações.</p>
        <div className="mini-bars" aria-label="Novos contatos nos últimos sete dias">
          {[36, 52, 47, 78, 64, 91, 72].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
        </div>
        <div className="mini-bars__labels"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div>
      </section>
    </div>
  );
}

function ContactsView({
  contacts,
  search,
  onSearch,
  filter,
  onFilter,
  onAdd,
}: {
  contacts: Contact[];
  search: string;
  onSearch: (value: string) => void;
  filter: string;
  onFilter: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="page-title-row">
        <div><span className="eyebrow">Sua base</span><h1>Contatos</h1><p>{contacts.length} exibidos</p></div>
        <button className="round-add" onClick={onAdd} aria-label="Adicionar contato"><Plus size={24} /></button>
      </section>

      <label className="search-box">
        <Search size={19} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar nome, telefone ou bairro" />
      </label>

      <div className="filter-scroll" aria-label="Filtrar por bairro">
        {neighborhoods.map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => onFilter(item)}>{item}</button>
        ))}
      </div>

      <section className="contact-list section-card section-card--flush">
        {contacts.map((contact) => (
          <article className="contact-row" key={contact.id}>
            <span className="contact-avatar">{initials(contact.name)}</span>
            <span className="contact-main"><strong>{contact.name}</strong><small>{contact.phone} · {contact.neighborhood}</small><em>Cadastrado por {contact.leader} · {contact.createdAt}</em></span>
            <span className={`contact-state ${contact.status === "saiu" ? "contact-state--off" : ""}`}>{contact.status === "ativo" ? "Ativo" : "Saiu"}</span>
          </article>
        ))}
        {contacts.length === 0 && <div className="empty-state"><Search size={28} /><strong>Nenhum contato encontrado</strong><span>Tente outro nome ou bairro.</span></div>}
      </section>
    </div>
  );
}

function CampaignsView({ campaigns, canSend, onNew, onResume }: { campaigns: Campaign[]; canSend: boolean; onNew: () => void; onResume: (campaign: Campaign) => void }) {
  return (
    <div className="view-stack">
      <section className="page-title-row">
        <div><span className="eyebrow">Comunicação</span><h1>Disparos</h1><p>Histórico e próximos envios</p></div>
        {canSend && <button className="round-add" onClick={onNew} aria-label="Criar disparo"><Plus size={24} /></button>}
      </section>

      <button className="new-campaign-card" onClick={onNew}>
        <span><Send size={24} /></span>
        <div><strong>{canSend ? "Criar novo disparo" : "Envios pela administração"}</strong><small>{canSend ? "Use um modelo aprovado e envie para toda a rede ativa." : "Você acompanha o histórico; a administração cuida dos envios."}</small></div>
        <ChevronRight size={20} />
      </button>

      <section className="campaign-list">
        <h2>Todos os disparos</h2>
        {campaigns.map((campaign) => (
          <article className="campaign-card" key={campaign.id}>
            <div className="campaign-card__head">
              <span className={`campaign-icon campaign-icon--${campaign.status}`}>
                {campaign.status === "agendado" ? <FileClock size={21} /> : campaign.status === "enviado" ? <CheckCircle2 size={21} /> : <MessagesSquare size={21} />}
              </span>
              <div><strong>{campaign.title}</strong><small>{campaign.date}</small></div>
              <button aria-label="Mais opções"><MoreHorizontal size={20} /></button>
            </div>
            <div className="campaign-metrics">
              <span><small>Destinatários</small><strong>{formatNumber(campaign.recipients)}</strong></span>
              <span><small>Entregues</small><strong>{campaign.delivered ? formatNumber(campaign.delivered) : "—"}</strong></span>
              <span><small>Lidos</small><strong>{campaign.read ? formatNumber(campaign.read) : "—"}</strong></span>
            </div>
            <div className="campaign-footer">
              <span className={`status status--${campaign.status}`}>{campaign.status === "agendado" ? "Agendado" : campaign.status === "enviado" ? "Concluído" : "Rascunho"}</span>
              <button onClick={() => campaign.status === "agendado" && canSend ? onResume(campaign) : undefined}>
                {campaign.status === "agendado" && canSend ? "Continuar envio" : "Detalhes"} <ChevronRight size={16} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function MoreView({ userName, userEmail, role, onInstall, onManageLeaders }: { userName: string; userEmail: string; role: AppRole; onInstall: () => void; onManageLeaders: () => void }) {
  const items = [
    { icon: <Users size={20} />, title: "Lideranças e acessos", note: "Convites, funções e permissões" },
    { icon: <MessageCircle size={20} />, title: "Integração do WhatsApp", note: "Número, modelos e conexão" },
    { icon: <ShieldCheck size={20} />, title: "Consentimento e privacidade", note: "Registros, saídas e exclusões" },
    { icon: <Download size={20} />, title: "Exportar relatórios", note: "Contatos e histórico de operações" },
    { icon: <Settings size={20} />, title: "Configurações da rede", note: "Nome, identidade e notificações" },
    { icon: <CircleHelp size={20} />, title: "Ajuda", note: "Guia rápido para lideranças" },
  ];
  return (
    <div className="view-stack">
      <section className="profile-card">
        <span className="profile-avatar">{initials(userName)}</span>
        <div><span className="eyebrow">{role === "admin" ? "Administradora" : "Liderança"}</span><h1>{userName}</h1><p>{userEmail}</p></div>
      </section>

      <button className="install-card" onClick={onInstall}>
        <span><Smartphone size={22} /></span>
        <div><strong>Instalar no celular</strong><small>Abra como aplicativo, sem precisar de loja.</small></div>
        <Download size={19} />
      </button>

      <section className="settings-list section-card section-card--flush">
        {items.map((item, index) => (
          <button key={item.title} onClick={index === 0 ? onManageLeaders : undefined}>
            <span className="settings-icon">{item.icon}</span>
            <span><strong>{item.title}</strong><small>{item.note}</small></span>
            <ChevronRight size={19} />
          </button>
        ))}
      </section>

      <a className="logout-button" href="/signout-with-chatgpt?return_to=/"><LogOut size={18} /> Sair da conta</a>
      <p className="version-note">Rede de Lideranças · versão piloto</p>
    </div>
  );
}

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.body.classList.add("sheet-open");
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("sheet-open");
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div className="sheet-layer" role="presentation">
      <button className="sheet-backdrop" onClick={onClose} aria-label="Fechar" />
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-handle" />
        <header><div><h2 id="sheet-title">{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="Fechar"><X size={22} /></button></header>
        {children}
      </section>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function mapApiContact(item: Record<string, unknown>): Contact {
  return {
    id: Number(item.id),
    name: String(item.name ?? "Contato"),
    phone: String(item.phone ?? item.phoneDisplay ?? ""),
    neighborhood: String(item.neighborhood ?? "Não informado"),
    leader: String(item.leader ?? "Liderança"),
    createdAt: formatDate(item.createdAt),
    status: item.status === "active" ? "ativo" : "saiu",
  };
}

function mapApiCampaign(item: Record<string, unknown>): Campaign {
  const rawStatus = String(item.status ?? "queued");
  return {
    id: Number(item.id),
    title: String(item.title ?? "Comunicado"),
    date: rawStatus === "queued" || rawStatus === "sending" ? "Na fila" : formatDate(item.completedAt ?? item.createdAt),
    recipients: Number(item.totalRecipients ?? 0),
    delivered: Number(item.deliveredCount ?? 0),
    read: Number(item.readCount ?? 0),
    status: rawStatus === "completed" ? "enviado" : rawStatus === "draft" ? "rascunho" : "agendado",
  };
}

function formatDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(Number(value));
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
