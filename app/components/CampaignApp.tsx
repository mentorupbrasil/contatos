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
  Trophy,
  UserPlus,
  Users,
  Wifi,
  X,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatContactPlace, IMPERATRIZ_NEIGHBORHOODS, OTHER_CITY_OPTION } from "../../lib/locations";

type Tab = "inicio" | "contatos" | "disparos" | "mais";
type MaisPanel = "menu" | "ranking" | "acessos" | "whatsapp" | "privacidade" | "ajuda";
type AppRole = "admin" | "leader";
type ContactStatus = "ativo" | "saiu";
type CampaignStatus = "agendado" | "enviado" | "rascunho";

type Contact = {
  id: number;
  name: string;
  phone: string;
  neighborhood: string;
  city: string;
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

type RankingRow = {
  leaderId: number;
  name: string;
  role: AppRole;
  total: number;
  active: number;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function CampaignApp({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("inicio");
  const [maisPanel, setMaisPanel] = useState<MaisPanel>("menu");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [activeBase, setActiveBase] = useState(0);
  const [role, setRole] = useState<AppRole>("leader");
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactSheet, setContactSheet] = useState(false);
  const [campaignSheet, setCampaignSheet] = useState(false);
  const [leaderSheet, setLeaderSheet] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [otherCity, setOtherCity] = useState(false);

  const firstName = userName.split(" ")[0] || "Liderança";
  const activeTotal = activeBase;

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const result = (await response.json()) as {
          error?: string;
          user?: { role: AppRole };
          stats?: { activeContacts: number };
          contacts?: Array<Record<string, unknown>>;
          campaigns?: Array<Record<string, unknown>>;
          ranking?: Array<Record<string, unknown>>;
          whatsappConfigured?: boolean;
        };
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar a rede.");
        if (cancelled) return;
        setRole(result.user?.role ?? "leader");
        setActiveBase(Number(result.stats?.activeContacts ?? 0));
        setContacts((result.contacts ?? []).map(mapApiContact));
        setCampaigns((result.campaigns ?? []).map(mapApiCampaign));
        setRanking(
          (result.ranking ?? []).map((row) => ({
            leaderId: Number(row.leaderId),
            name: String(row.name ?? "Liderança"),
            role: row.role === "admin" ? "admin" : "leader",
            total: Number(row.total ?? 0),
            active: Number(row.active ?? 0),
          })),
        );
        setWhatsappConnected(Boolean(result.whatsappConfigured));
      } catch (error) {
        if (!cancelled) {
          setToast(error instanceof Error ? error.message : "Não foi possível carregar a rede.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (tab !== "mais") setMaisPanel("menu");
  }, [tab]);

  const filterOptions = useMemo(() => {
    const places = new Set<string>(["Todos"]);
    for (const contact of contacts) {
      places.add(contact.city === "Imperatriz" ? contact.neighborhood : contact.city);
    }
    return Array.from(places);
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return contacts.filter((contact) => {
      const place = contact.city === "Imperatriz" ? contact.neighborhood : contact.city;
      const matchesFilter = filter === "Todos" || place === filter;
      const matchesSearch =
        !term ||
        `${contact.name} ${contact.phone} ${contact.neighborhood} ${contact.city}`
          .toLocaleLowerCase("pt-BR")
          .includes(term);
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
    const place = String(form.get("place") || "");
    const cityName = String(form.get("cityName") || "").trim();
    if (!name || !phone) return;

    const isOther = place === OTHER_CITY_OPTION || otherCity;
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          neighborhood: isOther ? "—" : place,
          city: isOther ? cityName : "Imperatriz",
          otherCity: isOther,
          consentConfirmed: true,
        }),
      });
      const result = (await response.json()) as { error?: string; contact?: Record<string, unknown> };
      if (!response.ok || !result.contact) throw new Error(result.error || "Não foi possível salvar o contato.");
      setContacts((current) => [mapApiContact(result.contact as Record<string, unknown>), ...current]);
      setActiveBase((current) => current + 1);
      setContactSheet(false);
      setOtherCity(false);
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
      const result = (await response.json()) as {
        error?: string;
        complete?: boolean;
        summary?: typeof finalSummary;
      };
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
      const createResult = (await createResponse.json()) as {
        error?: string;
        campaign?: { id: number; totalRecipients: number };
      };
      if (!createResponse.ok || !createResult.campaign) {
        throw new Error(createResult.error || "Não foi possível criar o disparo.");
      }
      createdCampaign = createResult.campaign;
      setCampaigns((current) => [
        {
          id: createdCampaign!.id,
          title,
          date: "Na fila",
          recipients: createdCampaign!.totalRecipients,
          status: "agendado",
        },
        ...current,
      ]);
      const summary = await processCampaignQueue(createdCampaign.id, createdCampaign.totalRecipients);
      setCampaigns((current) =>
        current.map((item) =>
          item.id === createdCampaign!.id
            ? {
                ...item,
                date: "Agora",
                status: "enviado",
                delivered: Number(summary.delivered ?? summary.sent ?? 0),
                read: Number(summary.read ?? 0),
              }
            : item,
        ),
      );
      setProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 380));
      setCampaignSheet(false);
      setTab("disparos");
      showToast("Disparo concluído pela fila oficial do WhatsApp.");
    } catch (error) {
      setCampaignSheet(false);
      setTab("disparos");
      showToast(
        `${createdCampaign ? "Disparo salvo. " : ""}${error instanceof Error ? error.message : "Não foi possível iniciar o envio."}`,
      );
    } finally {
      setSending(false);
      setProgress(0);
    }
  }

  async function resumeCampaign(campaign: Campaign) {
    setSending(true);
    setProgress(8);
    try {
      const summary = await processCampaignQueue(campaign.id, campaign.recipients);
      setCampaigns((current) =>
        current.map((item) =>
          item.id === campaign.id
            ? {
                ...item,
                date: "Agora",
                status: "enviado",
                delivered: Number(summary.delivered ?? summary.sent ?? 0),
                read: Number(summary.read ?? 0),
              }
            : item,
        ),
      );
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
    const password = String(form.get("leaderPassword") || "");
    const newRole = String(form.get("leaderRole") || "leader");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role: newRole, password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível liberar o acesso.");
      setLeaderSheet(false);
      setMaisPanel("acessos");
      showToast(`Acesso liberado para ${name}. Entregue e-mail e senha.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível liberar o acesso.");
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <Image src="/brand/luzia-logo.svg" alt="Luzia Mary" width={38} height={38} className="brand-logo" unoptimized />
          <span>
            <strong>Luzia Mary</strong>
            <small>Rede de Lideranças</small>
          </span>
        </div>
        <div className="header-actions">
          <button className="icon-button" aria-label="Notificações" type="button">
            <Bell size={20} />
          </button>
          <button className="avatar" aria-label={`Perfil de ${firstName}`} type="button">
            {initials(userName)}
          </button>
        </div>
      </header>

      <main className="app-main">
        {loading && (
          <div className="sync-line">
            <LoaderCircle size={15} /> Sincronizando a rede…
          </div>
        )}
        {sending && !campaignSheet && (
          <div className="sync-line">
            <LoaderCircle size={15} /> Processando fila oficial… {progress}%
          </div>
        )}

        {tab === "inicio" && (
          <HomeView
            firstName={firstName}
            activeTotal={activeTotal}
            campaign={campaigns.find((item) => item.status === "agendado")}
            ranking={ranking}
            onAddContact={() => setContactSheet(true)}
            onNewCampaign={() => setCampaignSheet(true)}
            onNavigate={setTab}
            onOpenRanking={() => {
              setTab("mais");
              setMaisPanel("ranking");
            }}
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
            filters={filterOptions}
            onAdd={() => setContactSheet(true)}
          />
        )}

        {tab === "disparos" && (
          <CampaignsView
            campaigns={campaigns}
            canSend={role === "admin"}
            onNew={() =>
              role === "admin"
                ? setCampaignSheet(true)
                : showToast("Somente administradoras podem criar disparos.")
            }
            onResume={resumeCampaign}
          />
        )}

        {tab === "mais" && (
          <MoreView
            panel={maisPanel}
            onPanel={setMaisPanel}
            userName={userName}
            userEmail={userEmail}
            role={role}
            ranking={ranking}
            whatsappConnected={whatsappConnected}
            onInstall={installApp}
            onManageLeaders={() => {
              if (role !== "admin") {
                showToast("Somente administradoras gerenciam acessos.");
                return;
              }
              setLeaderSheet(true);
            }}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        <NavButton active={tab === "inicio"} onClick={() => setTab("inicio")} icon={<Home size={21} />} label="Início" />
        <NavButton
          active={tab === "contatos"}
          onClick={() => setTab("contatos")}
          icon={<ContactRound size={21} />}
          label="Contatos"
        />
        <NavButton
          active={tab === "disparos"}
          onClick={() => setTab("disparos")}
          icon={<MessagesSquare size={21} />}
          label="Disparos"
        />
        <NavButton active={tab === "mais"} onClick={() => setTab("mais")} icon={<Menu size={21} />} label="Mais" />
      </nav>

      {contactSheet && (
        <Sheet title="Novo contato" subtitle="Leva menos de um minuto" onClose={() => { setContactSheet(false); setOtherCity(false); }}>
          <form className="sheet-form" onSubmit={addContact}>
            <label>
              Nome completo
              <input name="name" autoComplete="name" placeholder="Ex.: Maria de Fátima" required />
            </label>
            <label>
              WhatsApp
              <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(99) 9 9999-9999" required />
            </label>
            <label>
              Local
              <select
                name="place"
                defaultValue=""
                required={!otherCity}
                onChange={(event) => setOtherCity(event.target.value === OTHER_CITY_OPTION)}
              >
                <option value="" disabled>
                  Selecione o bairro (Imperatriz)
                </option>
                {IMPERATRIZ_NEIGHBORHOODS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                <option value={OTHER_CITY_OPTION}>Outro município (só cidade)</option>
              </select>
            </label>
            {otherCity && (
              <label>
                Cidade
                <input name="cityName" placeholder="Ex.: Açailândia" required />
              </label>
            )}
            <label className="consent-box">
              <input name="consent" type="checkbox" required />
              <span>
                <strong>A pessoa autorizou o cadastro</strong>
                <small>
                  Ela foi informada de que receberá comunicados no WhatsApp e poderá sair quando quiser.
                </small>
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
              <span className="audience-icon">
                <Users size={20} />
              </span>
              <span>
                <strong>Todos os contatos ativos</strong>
                <small>{formatNumber(activeTotal)} pessoas com consentimento</small>
              </span>
              <CheckCircle2 size={20} />
            </div>
            <label className="consent-box consent-box--compact">
              <input name="confirm" type="checkbox" required />
              <span>
                <strong>Revisei remetente, conteúdo e descadastramento.</strong>
              </span>
            </label>
            {sending ? (
              <div className="send-progress" aria-live="polite">
                <div>
                  <span>Preparando fila oficial</span>
                  <strong>{progress}%</strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${progress}%` }} />
                </div>
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
        <Sheet title="Novo acesso" subtitle="Crie login e senha da liderança" onClose={() => setLeaderSheet(false)}>
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
              Senha inicial
              <input name="leaderPassword" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" required minLength={6} />
            </label>
            <label>
              Permissão
              <select name="leaderRole" defaultValue="leader">
                <option value="leader">Liderança — cadastra e vê seus contatos</option>
                <option value="admin">Administração — também realiza disparos</option>
              </select>
            </label>
            <div className="access-note">
              <ShieldCheck size={18} />
              <span>
                <strong>Login + senha</strong>
                <small>Entregue e-mail e senha para a pessoa entrar no painel.</small>
              </span>
            </div>
            <button className="button button--primary button--wide" type="submit">
              <UserPlus size={18} /> Liberar acesso
            </button>
          </form>
        </Sheet>
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

function HomeView({
  firstName,
  activeTotal,
  campaign,
  ranking,
  onAddContact,
  onNewCampaign,
  onNavigate,
  onOpenRanking,
  whatsappConnected,
  canSend,
  onBlockedAction,
}: {
  firstName: string;
  activeTotal: number;
  campaign?: Campaign;
  ranking: RankingRow[];
  onAddContact: () => void;
  onNewCampaign: () => void;
  onNavigate: (tab: Tab) => void;
  onOpenRanking: () => void;
  whatsappConnected: boolean;
  canSend: boolean;
  onBlockedAction: () => void;
}) {
  return (
    <div className="view-stack home-view">
      <section className="welcome-row">
        <div>
          <span>Olá, {firstName}</span>
          <h1>Vamos movimentar a rede?</h1>
        </div>
        <span className={`connection-pill ${whatsappConnected ? "" : "connection-pill--off"}`}>
          <Wifi size={14} /> {whatsappConnected ? "WhatsApp conectado" : "Configuração pendente"}
        </span>
      </section>

      <section className="hero-card">
        <div className="hero-card__top">
          <span>Seus contatos ativos</span>
          <button aria-label="Ver contatos" type="button" onClick={() => onNavigate("contatos")}>
            <ChevronRight size={20} />
          </button>
        </div>
        <strong className="hero-number">{formatNumber(activeTotal)}</strong>
        <div className="hero-trend">Base da rede Luzia Mary</div>
      </section>

      <section className="quick-actions" aria-label="Ações rápidas">
        <button className="quick-action quick-action--primary" type="button" onClick={onAddContact}>
          <span>
            <UserPlus size={22} />
          </span>
          <strong>
            Cadastrar
            <br />
            contato
          </strong>
          <Plus size={18} />
        </button>
        <button className="quick-action" type="button" onClick={canSend ? onNewCampaign : onBlockedAction}>
          <span>
            <Send size={22} />
          </span>
          <strong>
            Novo
            <br />
            disparo
          </strong>
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Ranking</span>
            <h2>Lideranças</h2>
          </div>
          <button className="text-button" type="button" onClick={onOpenRanking}>
            Ver tudo <ChevronRight size={17} />
          </button>
        </div>
        <RankingList ranking={ranking.slice(0, 5)} compact />
      </section>

      {campaign && (
        <section className="section-card upcoming-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Próximo disparo</span>
              <h2>{campaign.title}</h2>
            </div>
            <span className="status status--scheduled">
              <Clock3 size={13} /> Agendado
            </span>
          </div>
          <div className="upcoming-meta">
            <span>
              <CalendarClock size={18} />
              <small>
                Quando<strong>{campaign.date}</strong>
              </small>
            </span>
            <span>
              <Users size={18} />
              <small>
                Destinatários<strong>{formatNumber(campaign.recipients)}</strong>
              </small>
            </span>
          </div>
          <button className="text-button" type="button" onClick={() => onNavigate("disparos")}>
            Ver detalhes <ChevronRight size={17} />
          </button>
        </section>
      )}
    </div>
  );
}

function RankingList({ ranking, compact }: { ranking: RankingRow[]; compact?: boolean }) {
  if (ranking.length === 0) {
    return (
      <div className="empty-state" style={{ padding: compact ? "24px 8px" : undefined }}>
        <Trophy size={28} />
        <strong>Ainda sem ranking</strong>
        <span>Cadastre contatos para aparecer aqui.</span>
      </div>
    );
  }
  return (
    <ol className={`ranking-list ${compact ? "ranking-list--compact" : ""}`}>
      {ranking.map((row, index) => (
        <li key={row.leaderId}>
          <span className="ranking-pos">{index + 1}º</span>
          <span className="ranking-main">
            <strong>{row.name}</strong>
            <small>{row.role === "admin" ? "Administração" : "Liderança"}</small>
          </span>
          <span className="ranking-score">
            <strong>{formatNumber(row.active)}</strong>
            <small>ativos</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function ContactsView({
  contacts,
  search,
  onSearch,
  filter,
  onFilter,
  filters,
  onAdd,
}: {
  contacts: Contact[];
  search: string;
  onSearch: (value: string) => void;
  filter: string;
  onFilter: (value: string) => void;
  filters: string[];
  onAdd: () => void;
}) {
  return (
    <div className="view-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">Sua base</span>
          <h1>Contatos</h1>
          <p>{contacts.length} exibidos</p>
        </div>
        <button className="round-add" onClick={onAdd} aria-label="Adicionar contato" type="button">
          <Plus size={24} />
        </button>
      </section>

      <label className="search-box">
        <Search size={19} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar nome, telefone ou bairro"
        />
      </label>

      <div className="filter-scroll" aria-label="Filtrar por local">
        {filters.map((item) => (
          <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => onFilter(item)}>
            {item}
          </button>
        ))}
      </div>

      <section className="contact-list section-card section-card--flush">
        {contacts.map((contact) => (
          <article className="contact-row" key={contact.id}>
            <span className="contact-avatar">{initials(contact.name)}</span>
            <span className="contact-main">
              <strong>{contact.name}</strong>
              <small>
                {contact.phone} · {formatContactPlace(contact.city, contact.neighborhood)}
              </small>
              <em>
                Cadastrado por {contact.leader} · {contact.createdAt}
              </em>
            </span>
            <span className={`contact-state ${contact.status === "saiu" ? "contact-state--off" : ""}`}>
              {contact.status === "ativo" ? "Ativo" : "Saiu"}
            </span>
          </article>
        ))}
        {contacts.length === 0 && (
          <div className="empty-state">
            <Search size={28} />
            <strong>Nenhum contato encontrado</strong>
            <span>Cadastre o primeiro ou ajuste o filtro.</span>
          </div>
        )}
      </section>
    </div>
  );
}

function CampaignsView({
  campaigns,
  canSend,
  onNew,
  onResume,
}: {
  campaigns: Campaign[];
  canSend: boolean;
  onNew: () => void;
  onResume: (campaign: Campaign) => void;
}) {
  return (
    <div className="view-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">Comunicação</span>
          <h1>Disparos</h1>
          <p>Histórico e próximos envios</p>
        </div>
        {canSend && (
          <button className="round-add" onClick={onNew} aria-label="Criar disparo" type="button">
            <Plus size={24} />
          </button>
        )}
      </section>

      <button className="new-campaign-card" type="button" onClick={onNew}>
        <span>
          <Send size={24} />
        </span>
        <div>
          <strong>{canSend ? "Criar novo disparo" : "Envios pela administração"}</strong>
          <small>
            {canSend
              ? "Use um modelo aprovado e envie para toda a rede ativa."
              : "Você acompanha o histórico; a administração cuida dos envios."}
          </small>
        </div>
        <ChevronRight size={20} />
      </button>

      <section className="campaign-list">
        <h2>Todos os disparos</h2>
        {campaigns.length === 0 && (
          <div className="empty-state section-card">
            <MessagesSquare size={28} />
            <strong>Nenhum disparo ainda</strong>
            <span>Quando houver envios, o histórico aparece aqui.</span>
          </div>
        )}
        {campaigns.map((campaign) => (
          <article className="campaign-card" key={campaign.id}>
            <div className="campaign-card__head">
              <span className={`campaign-icon campaign-icon--${campaign.status}`}>
                {campaign.status === "agendado" ? (
                  <FileClock size={21} />
                ) : campaign.status === "enviado" ? (
                  <CheckCircle2 size={21} />
                ) : (
                  <MessagesSquare size={21} />
                )}
              </span>
              <div>
                <strong>{campaign.title}</strong>
                <small>{campaign.date}</small>
              </div>
              <button aria-label="Mais opções" type="button">
                <MoreHorizontal size={20} />
              </button>
            </div>
            <div className="campaign-metrics">
              <span>
                <small>Destinatários</small>
                <strong>{formatNumber(campaign.recipients)}</strong>
              </span>
              <span>
                <small>Entregues</small>
                <strong>{campaign.delivered ? formatNumber(campaign.delivered) : "—"}</strong>
              </span>
              <span>
                <small>Lidos</small>
                <strong>{campaign.read ? formatNumber(campaign.read) : "—"}</strong>
              </span>
            </div>
            <div className="campaign-footer">
              <span className={`status status--${campaign.status}`}>
                {campaign.status === "agendado"
                  ? "Agendado"
                  : campaign.status === "enviado"
                    ? "Concluído"
                    : "Rascunho"}
              </span>
              <button
                type="button"
                onClick={() => (campaign.status === "agendado" && canSend ? onResume(campaign) : undefined)}
              >
                {campaign.status === "agendado" && canSend ? "Continuar envio" : "Detalhes"}{" "}
                <ChevronRight size={16} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function MoreView({
  panel,
  onPanel,
  userName,
  userEmail,
  role,
  ranking,
  whatsappConnected,
  onInstall,
  onManageLeaders,
}: {
  panel: MaisPanel;
  onPanel: (panel: MaisPanel) => void;
  userName: string;
  userEmail: string;
  role: AppRole;
  ranking: RankingRow[];
  whatsappConnected: boolean;
  onInstall: () => void;
  onManageLeaders: () => void;
}) {
  if (panel === "ranking") {
    return (
      <div className="view-stack">
        <button className="text-button" type="button" onClick={() => onPanel("menu")}>
          ← Voltar
        </button>
        <section className="page-title-row">
          <div>
            <span className="eyebrow">Rede</span>
            <h1>Ranking</h1>
            <p>Quem mais cadastrou contatos ativos</p>
          </div>
        </section>
        <section className="section-card">
          <RankingList ranking={ranking} />
        </section>
      </div>
    );
  }

  if (panel === "acessos") {
    return (
      <div className="view-stack">
        <button className="text-button" type="button" onClick={() => onPanel("menu")}>
          ← Voltar
        </button>
        <section className="page-title-row">
          <div>
            <span className="eyebrow">Administração</span>
            <h1>Acessos</h1>
            <p>Login e senha das lideranças</p>
          </div>
          {role === "admin" && (
            <button className="round-add" type="button" onClick={onManageLeaders} aria-label="Novo acesso">
              <Plus size={24} />
            </button>
          )}
        </section>
        <section className="section-card">
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            {role === "admin"
              ? "Toque no + para liberar e-mail e senha de uma liderança. Cada uma vê só os próprios contatos e também o ranking geral."
              : "Somente a administração libera novos acessos."}
          </p>
          {role === "admin" && (
            <button className="button button--primary button--wide" type="button" style={{ marginTop: 16 }} onClick={onManageLeaders}>
              <UserPlus size={18} /> Liberar liderança
            </button>
          )}
        </section>
      </div>
    );
  }

  if (panel === "whatsapp") {
    return (
      <div className="view-stack">
        <button className="text-button" type="button" onClick={() => onPanel("menu")}>
          ← Voltar
        </button>
        <section className="page-title-row">
          <div>
            <span className="eyebrow">Canal</span>
            <h1>WhatsApp</h1>
            <p>Status da integração oficial</p>
          </div>
        </section>
        <section className="section-card">
          <p style={{ margin: "0 0 12px", fontSize: 14 }}>
            {whatsappConnected
              ? "Credenciais configuradas. Disparos usam a Cloud API oficial."
              : "Ainda faltam variáveis WHATSAPP_* no ambiente."}
          </p>
          <span className={`status ${whatsappConnected ? "status--enviado" : "status--scheduled"}`}>
            {whatsappConnected ? "Conectado" : "Pendente"}
          </span>
        </section>
      </div>
    );
  }

  if (panel === "privacidade") {
    return (
      <div className="view-stack">
        <button className="text-button" type="button" onClick={() => onPanel("menu")}>
          ← Voltar
        </button>
        <section className="page-title-row">
          <div>
            <span className="eyebrow">LGPD</span>
            <h1>Consentimento</h1>
          </div>
        </section>
        <section className="section-card">
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            Todo cadastro exige autorização. Respostas SAIR, PARAR, CANCELAR ou DESCADASTRAR no WhatsApp
            interrompem novos envios imediatamente.
          </p>
        </section>
      </div>
    );
  }

  if (panel === "ajuda") {
    return (
      <div className="view-stack">
        <button className="text-button" type="button" onClick={() => onPanel("menu")}>
          ← Voltar
        </button>
        <section className="page-title-row">
          <div>
            <span className="eyebrow">Suporte</span>
            <h1>Ajuda rápida</h1>
          </div>
        </section>
        <section className="section-card">
          <ol style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>
            <li>Cadastre só com consentimento verbal.</li>
            <li>Em Imperatriz, escolha o bairro. Em outra cidade, informe só o município.</li>
            <li>O ranking mostra quantos contatos ativos cada liderança tem.</li>
            <li>Disparos ficam com a administração.</li>
          </ol>
        </section>
      </div>
    );
  }

  const items = [
    { id: "ranking" as const, icon: <Trophy size={20} />, title: "Ranking de lideranças", note: "Quantos contatos cada uma tem" },
    { id: "acessos" as const, icon: <Users size={20} />, title: "Lideranças e acessos", note: "Login, senha e permissões" },
    { id: "whatsapp" as const, icon: <MessageCircle size={20} />, title: "Integração do WhatsApp", note: "Status da conexão oficial" },
    { id: "privacidade" as const, icon: <ShieldCheck size={20} />, title: "Consentimento e privacidade", note: "Registros e saídas" },
    { id: "ajuda" as const, icon: <CircleHelp size={20} />, title: "Ajuda", note: "Guia rápido para lideranças" },
  ];

  return (
    <div className="view-stack">
      <section className="profile-card">
        <span className="profile-avatar">{initials(userName)}</span>
        <div>
          <span className="eyebrow">{role === "admin" ? "Administradora" : "Liderança"}</span>
          <h1>{userName}</h1>
          <p>{userEmail}</p>
        </div>
      </section>

      <button className="install-card" type="button" onClick={onInstall}>
        <span>
          <Smartphone size={22} />
        </span>
        <div>
          <strong>Instalar no celular</strong>
          <small>Abra como aplicativo, sem precisar de loja.</small>
        </div>
        <Download size={19} />
      </button>

      <section className="settings-list section-card section-card--flush">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onPanel(item.id)}>
            <span className="settings-icon">{item.icon}</span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.note}</small>
            </span>
            <ChevronRight size={19} />
          </button>
        ))}
        <button type="button" onClick={() => onPanel("whatsapp")}>
          <span className="settings-icon">
            <Settings size={20} />
          </span>
          <span>
            <strong>Configurações da rede</strong>
            <small>Identidade Luzia Mary</small>
          </span>
          <ChevronRight size={19} />
        </button>
      </section>

      <a className="logout-button" href="/api/auth/logout">
        <LogOut size={18} /> Sair da conta
      </a>
      <p className="version-note">Luzia Mary · Rede de Lideranças</p>
    </div>
  );
}

function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
      <button className="sheet-backdrop" onClick={onClose} aria-label="Fechar" type="button" />
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-handle" />
        <header>
          <div>
            <h2 id="sheet-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" type="button">
            <X size={22} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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
    city: String(item.city ?? "Imperatriz"),
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
    date:
      rawStatus === "queued" || rawStatus === "sending"
        ? "Na fila"
        : formatDate(item.completedAt ?? item.createdAt),
    recipients: Number(item.totalRecipients ?? 0),
    delivered: Number(item.deliveredCount ?? 0),
    read: Number(item.readCount ?? 0),
    status: rawStatus === "completed" ? "enviado" : rawStatus === "draft" ? "rascunho" : "agendado",
  };
}

function formatDate(value: unknown) {
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") date = new Date(value);
  else if (typeof value === "string") date = new Date(value);
  else return "Agora";
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
