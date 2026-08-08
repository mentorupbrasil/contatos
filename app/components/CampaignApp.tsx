"use client";

import {
  Bell,
  CalendarClock,
  Camera,
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
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  MapPin,
  Trophy,
  UserPlus,
  Users,
  Wifi,
  X,
} from "lucide-react";
import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatContactPlace, IMPERATRIZ_NEIGHBORHOODS, OTHER_CITY_OPTION } from "../../lib/locations";

type Tab = "inicio" | "contatos" | "disparos" | "mais";
type MaisPanel = "menu" | "ranking" | "acessos" | "whatsapp" | "privacidade" | "ajuda";
type RankingKind = "liderancas" | "bairros" | "municipios";
type AppRole = "admin" | "leader";
type ContactStatus = "ativo" | "saiu";
type CampaignStatus = "agendado" | "enviado" | "rascunho";

type AppNotification = {
  id: string;
  kind: "contact" | "optout" | "campaign" | "system" | "tip";
  title: string;
  body: string;
  createdAt: string;
  href?: Tab;
};

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

type PlaceRow = {
  key: string;
  label: string;
  detail?: string;
  active: number;
};

type NetworkUser = {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  status: "active" | "inactive";
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const NOTIFY_READ_KEY = "luzia-notify-read";

export function CampaignApp({
  userName,
  userEmail,
  avatarUrl: initialAvatarUrl = null,
}: {
  userName: string;
  userEmail: string;
  avatarUrl?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("inicio");
  const [maisPanel, setMaisPanel] = useState<MaisPanel>("menu");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingByCity, setRankingByCity] = useState<PlaceRow[]>([]);
  const [rankingByNeighborhood, setRankingByNeighborhood] = useState<PlaceRow[]>([]);
  const [rankingKind, setRankingKind] = useState<RankingKind>("bairros");
  const [activeBase, setActiveBase] = useState(0);
  const [role, setRole] = useState<AppRole>("leader");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactSheet, setContactSheet] = useState(false);
  const [campaignSheet, setCampaignSheet] = useState(false);
  const [leaderSheet, setLeaderSheet] = useState(false);
  const [notifySheet, setNotifySheet] = useState(false);
  const [profileSheet, setProfileSheet] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [editUser, setEditUser] = useState<NetworkUser | null>(null);
  const [networkUsers, setNetworkUsers] = useState<NetworkUser[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [otherCity, setOtherCity] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const firstName = userName.split(" ")[0] || "Liderança";
  const activeTotal = activeBase;
  const unreadCount = notifications.filter(
    (item) => item.kind !== "tip" && !readNotificationIds.includes(item.id),
  ).length;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTIFY_READ_KEY);
      if (raw) setReadNotificationIds(JSON.parse(raw) as string[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      try {
        const [dashResponse, notifyResponse] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/notifications", { cache: "no-store" }),
        ]);
        const result = (await dashResponse.json()) as {
          error?: string;
          user?: { role: AppRole; avatarUrl?: string | null };
          stats?: { activeContacts: number };
          contacts?: Array<Record<string, unknown>>;
          campaigns?: Array<Record<string, unknown>>;
          ranking?: Array<Record<string, unknown>>;
          rankingByCity?: Array<Record<string, unknown>>;
          rankingByNeighborhood?: Array<Record<string, unknown>>;
          whatsappConfigured?: boolean;
        };
        if (!dashResponse.ok) throw new Error(result.error || "Não foi possível carregar a rede.");
        if (cancelled) return;
        setRole(result.user?.role ?? "leader");
        if (typeof result.user?.avatarUrl === "string") setAvatarUrl(result.user.avatarUrl);
        else if (result.user?.avatarUrl === null) setAvatarUrl(null);
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
        setRankingByCity(
          (result.rankingByCity ?? []).map((row) => ({
            key: String(row.city ?? "Cidade"),
            label: String(row.city ?? "Cidade"),
            detail: "Município",
            active: Number(row.active ?? 0),
          })),
        );
        setRankingByNeighborhood(
          (result.rankingByNeighborhood ?? []).map((row) => ({
            key: `${row.city}-${row.neighborhood}`,
            label: String(row.neighborhood ?? "Bairro"),
            detail: String(row.city ?? "Imperatriz"),
            active: Number(row.active ?? 0),
          })),
        );
        setWhatsappConnected(Boolean(result.whatsappConfigured));

        if (notifyResponse.ok) {
          const notifyResult = (await notifyResponse.json()) as {
            notifications?: AppNotification[];
          };
          setNotifications(notifyResult.notifications ?? []);
        }
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

  function markNotificationsRead(ids: string[]) {
    setReadNotificationIds((prev) => {
      const next = Array.from(new Set([...prev, ...ids]));
      try {
        window.localStorage.setItem(NOTIFY_READ_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function openNotifications() {
    setNotifySheet(true);
    markNotificationsRead(notifications.map((item) => item.id));
  }

  async function saveAvatar(nextUrl: string | null) {
    setAvatarBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: nextUrl }),
      });
      const result = (await response.json()) as {
        error?: string;
        user?: { avatarUrl?: string | null };
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar a foto.");
      setAvatarUrl(result.user?.avatarUrl ?? null);
      showToast(nextUrl ? "Foto de perfil atualizada." : "Foto removida.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Escolha um arquivo de imagem.");
      return;
    }
    try {
      const dataUrl = await compressAvatar(file);
      await saveAvatar(dataUrl);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível ler a imagem.");
    }
  }

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

  async function loadNetworkUsers() {
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const result = (await response.json()) as {
        error?: string;
        users?: Array<Record<string, unknown>>;
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os acessos.");
      setNetworkUsers(
        (result.users ?? []).map((row) => ({
          id: Number(row.id),
          name: String(row.name ?? ""),
          email: String(row.email ?? ""),
          role: row.role === "admin" ? "admin" : "leader",
          status: row.status === "inactive" ? "inactive" : "active",
        })),
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível carregar os acessos.");
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
      await loadNetworkUsers();
      showToast(`Acesso liberado para ${name}. Entregue e-mail e senha.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível liberar o acesso.");
    }
  }

  async function saveUserEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editUser) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("leaderName") || "").trim();
    const email = String(form.get("leaderEmail") || "").trim();
    const password = String(form.get("leaderPassword") || "");
    const newRole = String(form.get("leaderRole") || "leader");
    const status = String(form.get("leaderStatus") || "active");
    try {
      const response = await fetch(`/api/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role: newRole,
          status,
          password: password || undefined,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o acesso.");
      setEditUser(null);
      await loadNetworkUsers();
      showToast(`Acesso de ${name} atualizado.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar o acesso.");
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <Image
            src="/brand/luzia-logo-clear.png"
            alt="Luzia Mary"
            width={120}
            height={16}
            className="brand-wordmark brand-wordmark--header"
            unoptimized
          />
          <small>Rede de Lideranças</small>
        </div>
        <div className="header-actions">
          <button className="icon-button" aria-label="Notificações" type="button" onClick={openNotifications}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="notify-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
          <button
            className="avatar"
            aria-label={`Perfil de ${firstName}`}
            type="button"
            onClick={() => setProfileSheet(true)}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="avatar-image" />
            ) : (
              initials(userName)
            )}
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
            rankingByNeighborhood={rankingByNeighborhood}
            onAddContact={() => setContactSheet(true)}
            onNewCampaign={() => setCampaignSheet(true)}
            onNavigate={setTab}
            onOpenRanking={(kind) => {
              setRankingKind(kind);
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
            onPanel={(next) => {
              setMaisPanel(next);
              if (next === "acessos" && role === "admin") {
                void loadNetworkUsers();
              }
            }}
            userName={userName}
            userEmail={userEmail}
            avatarUrl={avatarUrl}
            role={role}
            networkUsers={networkUsers}
            ranking={ranking}
            rankingByCity={rankingByCity}
            rankingByNeighborhood={rankingByNeighborhood}
            rankingKind={rankingKind}
            onRankingKind={setRankingKind}
            whatsappConnected={whatsappConnected}
            onInstall={installApp}
            onManageLeaders={() => {
              if (role !== "admin") {
                showToast("Somente administradoras gerenciam acessos.");
                return;
              }
              setLeaderSheet(true);
            }}
            onEditUser={(user) => {
              if (role !== "admin") {
                showToast("Somente administradoras gerenciam acessos.");
                return;
              }
              setEditUser(user);
            }}
            onOpenProfile={() => setProfileSheet(true)}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        <NavButton
          active={tab === "inicio"}
          onClick={() => setTab("inicio")}
          icon={<Home size={20} strokeWidth={1.85} />}
          label="Início"
        />
        <NavButton
          active={tab === "contatos"}
          onClick={() => setTab("contatos")}
          icon={<ContactRound size={20} strokeWidth={1.85} />}
          label="Contatos"
        />
        <NavButton
          active={tab === "disparos"}
          onClick={() => setTab("disparos")}
          icon={<MessagesSquare size={20} strokeWidth={1.85} />}
          label="Disparos"
        />
        <NavButton
          active={tab === "mais"}
          onClick={() => setTab("mais")}
          icon={<MoreHorizontal size={20} strokeWidth={1.85} />}
          label="Mais"
        />
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
                <span className="consent-title">A pessoa autorizou o cadastro</span>
                <small>
                  Foi informada de que receberá comunicados no WhatsApp e pode sair quando quiser.
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
                <span className="audience-title">Todos os contatos ativos</span>
                <small>{formatNumber(activeTotal)} pessoas com consentimento</small>
              </span>
              <CheckCircle2 size={20} />
            </div>
            <label className="consent-box consent-box--compact">
              <input name="confirm" type="checkbox" required />
              <span>
                <span className="consent-title">Revisei remetente, conteúdo e descadastramento</span>
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
                <span className="access-title">Login e senha</span>
                <small>Entregue e-mail e senha para a pessoa entrar no painel.</small>
              </span>
            </div>
            <button className="button button--primary button--wide" type="submit">
              <UserPlus size={18} /> Liberar acesso
            </button>
          </form>
        </Sheet>
      )}

      {editUser && (
        <Sheet
          title="Editar acesso"
          subtitle="Atualize login, senha e permissão"
          onClose={() => setEditUser(null)}
        >
          <form className="sheet-form" onSubmit={saveUserEdit} key={editUser.id}>
            <label>
              Nome
              <input name="leaderName" defaultValue={editUser.name} autoComplete="name" required />
            </label>
            <label>
              E-mail de acesso
              <input
                name="leaderEmail"
                type="email"
                defaultValue={editUser.email}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Nova senha
              <input
                name="leaderPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Deixe em branco para manter"
              />
            </label>
            <label>
              Permissão
              <select name="leaderRole" defaultValue={editUser.role}>
                <option value="leader">Liderança — cadastra e vê seus contatos</option>
                <option value="admin">Administração — também realiza disparos</option>
              </select>
            </label>
            <label>
              Status
              <select name="leaderStatus" defaultValue={editUser.status}>
                <option value="active">Ativo</option>
                <option value="inactive">Desativado</option>
              </select>
            </label>
            <button className="button button--primary button--wide" type="submit">
              <Check size={19} /> Salvar alterações
            </button>
          </form>
        </Sheet>
      )}

      {notifySheet && (
        <Sheet title="Notificações" subtitle="Alertas úteis da sua rede" onClose={() => setNotifySheet(false)}>
          <div className="notify-list">
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: "28px 8px" }}>
                <Bell size={28} />
                <span className="empty-title">Sem avisos agora</span>
                <span>Quando houver novidades, elas aparecem aqui.</span>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notify-item notify-item--${item.kind}`}
                  onClick={() => {
                    setNotifySheet(false);
                    if (item.href) {
                      setTab(item.href);
                      if (item.href === "mais") setMaisPanel("whatsapp");
                    }
                  }}
                >
                  <span className="notify-icon">{notificationIcon(item.kind)}</span>
                  <span className="notify-copy">
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                    <em>{formatRelativeTime(item.createdAt)}</em>
                  </span>
                  {item.href && <ChevronRight size={16} />}
                </button>
              ))
            )}
          </div>
        </Sheet>
      )}

      {profileSheet && (
        <Sheet title="Seu perfil" subtitle="Foto e dados de quem está logado" onClose={() => setProfileSheet(false)}>
          <div className="profile-sheet">
            <div className="profile-sheet-avatar">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" />
              ) : (
                <span>{initials(userName)}</span>
              )}
            </div>
            <div className="profile-sheet-meta">
              <strong>{userName}</strong>
              <small>{userEmail}</small>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={onAvatarFile}
            />
            <button
              className="button button--primary button--wide"
              type="button"
              disabled={avatarBusy}
              onClick={() => avatarInputRef.current?.click()}
            >
              <Camera size={18} /> {avatarBusy ? "Enviando…" : "Trocar foto"}
            </button>
            {avatarUrl && (
              <button
                className="button button--ghost button--wide"
                type="button"
                disabled={avatarBusy}
                onClick={() => void saveAvatar(null)}
              >
                Remover foto
              </button>
            )}
          </div>
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
  rankingByNeighborhood,
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
  rankingByNeighborhood: PlaceRow[];
  onAddContact: () => void;
  onNewCampaign: () => void;
  onNavigate: (tab: Tab) => void;
  onOpenRanking: (kind: RankingKind) => void;
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
            <span className="eyebrow">Por local</span>
            <h2>Bairros com mais contatos</h2>
          </div>
          <button className="text-button" type="button" onClick={() => onOpenRanking("bairros")}>
            Ver tudo <ChevronRight size={17} />
          </button>
        </div>
        <PlaceRankingList
          rows={rankingByNeighborhood.slice(0, 5)}
          emptyTitle="Ainda sem bairros"
          emptyNote="Cadastre contatos de Imperatriz para ver o mapa da rede."
          compact
        />
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Equipe</span>
            <h2>Lideranças</h2>
          </div>
          <button className="text-button" type="button" onClick={() => onOpenRanking("liderancas")}>
            Ver tudo <ChevronRight size={17} />
          </button>
        </div>
        <LeaderRankingList ranking={ranking.slice(0, 5)} compact />
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
                Quando<span className="meta-value">{campaign.date}</span>
              </small>
            </span>
            <span>
              <Users size={18} />
              <small>
                Destinatários<span className="meta-value">{formatNumber(campaign.recipients)}</span>
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

function LeaderRankingList({ ranking, compact }: { ranking: RankingRow[]; compact?: boolean }) {
  if (ranking.length === 0) {
    return (
      <div className="empty-state" style={{ padding: compact ? "24px 8px" : undefined }}>
        <Trophy size={28} />
        <span className="empty-title">Ainda sem ranking</span>
        <span>Cadastre contatos para aparecer aqui.</span>
      </div>
    );
  }
  return (
    <ol className={`ranking-list ${compact ? "ranking-list--compact" : ""}`}>
      {ranking.map((row, index) => (
        <li key={row.leaderId}>
          <span className="ranking-pos">{index + 1}</span>
          <span className="ranking-main">
            <span className="ranking-name">{row.name}</span>
            <small>{row.role === "admin" ? "Administração" : "Liderança"}</small>
          </span>
          <span className="ranking-score">
            <span className="ranking-count">{formatNumber(row.active)}</span>
            <small>ativos</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function PlaceRankingList({
  rows,
  emptyTitle,
  emptyNote,
  compact,
}: {
  rows: PlaceRow[];
  emptyTitle: string;
  emptyNote: string;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty-state" style={{ padding: compact ? "24px 8px" : undefined }}>
        <MapPin size={28} />
        <span className="empty-title">{emptyTitle}</span>
        <span>{emptyNote}</span>
      </div>
    );
  }
  return (
    <ol className={`ranking-list ${compact ? "ranking-list--compact" : ""}`}>
      {rows.map((row, index) => (
        <li key={row.key}>
          <span className="ranking-pos">{index + 1}</span>
          <span className="ranking-main">
            <span className="ranking-name">{row.label}</span>
            {row.detail && <small>{row.detail}</small>}
          </span>
          <span className="ranking-score">
            <span className="ranking-count">{formatNumber(row.active)}</span>
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
  avatarUrl,
  role,
  networkUsers,
  ranking,
  rankingByCity,
  rankingByNeighborhood,
  rankingKind,
  onRankingKind,
  whatsappConnected,
  onInstall,
  onManageLeaders,
  onEditUser,
  onOpenProfile,
}: {
  panel: MaisPanel;
  onPanel: (panel: MaisPanel) => void;
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  role: AppRole;
  networkUsers: NetworkUser[];
  ranking: RankingRow[];
  rankingByCity: PlaceRow[];
  rankingByNeighborhood: PlaceRow[];
  rankingKind: RankingKind;
  onRankingKind: (kind: RankingKind) => void;
  whatsappConnected: boolean;
  onInstall: () => void;
  onManageLeaders: () => void;
  onEditUser: (user: NetworkUser) => void;
  onOpenProfile: () => void;
}) {
  if (panel === "ranking") {
    return (
      <div className="view-stack">
        <button className="text-button" type="button" onClick={() => onPanel("menu")}>
          ← Voltar
        </button>
        <section className="page-title-row">
          <div>
            <span className="eyebrow">Mapa da rede</span>
            <h1>Rankings</h1>
            <p>Quantos contatos ativos em cada lugar e liderança</p>
          </div>
        </section>

        <div className="rank-tabs" role="tablist" aria-label="Tipo de ranking">
          <button
            type="button"
            className={rankingKind === "bairros" ? "active" : ""}
            onClick={() => onRankingKind("bairros")}
          >
            Bairros
          </button>
          <button
            type="button"
            className={rankingKind === "municipios" ? "active" : ""}
            onClick={() => onRankingKind("municipios")}
          >
            Municípios
          </button>
          <button
            type="button"
            className={rankingKind === "liderancas" ? "active" : ""}
            onClick={() => onRankingKind("liderancas")}
          >
            Lideranças
          </button>
        </div>

        <section className="section-card">
          {rankingKind === "bairros" && (
            <PlaceRankingList
              rows={rankingByNeighborhood}
              emptyTitle="Nenhum bairro ainda"
              emptyNote="Contatos de Imperatriz aparecem aqui por bairro."
            />
          )}
          {rankingKind === "municipios" && (
            <PlaceRankingList
              rows={rankingByCity}
              emptyTitle="Nenhum município ainda"
              emptyNote="Imperatriz e outras cidades cadastradas aparecem aqui."
            />
          )}
          {rankingKind === "liderancas" && <LeaderRankingList ranking={ranking} />}
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
        {role !== "admin" ? (
          <section className="section-card">
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              Somente a administração libera e edita acessos.
            </p>
          </section>
        ) : (
          <>
            <section className="section-card">
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                Crie ou edite e-mail, senha e permissão. Só entra quem a administração liberar.
              </p>
              <button
                className="button button--primary button--wide"
                type="button"
                style={{ marginTop: 16 }}
                onClick={onManageLeaders}
              >
                <UserPlus size={18} /> Liberar liderança
              </button>
            </section>
            <section className="section-card section-card--flush">
              {networkUsers.length === 0 ? (
                <div className="empty-state" style={{ padding: "28px 16px" }}>
                  <Users size={28} />
                  <span className="empty-title">Nenhum acesso listado</span>
                  <span>Libere a primeira liderança pelo botão acima.</span>
                </div>
              ) : (
                networkUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="access-row"
                    onClick={() => onEditUser(user)}
                  >
                    <span className="access-avatar">{initials(user.name)}</span>
                    <span className="access-main">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                      <span className="access-meta">
                        {user.role === "admin" ? "Administração" : "Liderança"}
                        {" · "}
                        {user.status === "active" ? "Ativo" : "Desativado"}
                      </span>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))
              )}
            </section>
          </>
        )}
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
            <li>Os rankings mostram contatos ativos por bairro, município e liderança.</li>
            <li>Disparos ficam com a administração.</li>
          </ol>
        </section>
      </div>
    );
  }

  const items = [
    { id: "ranking" as const, icon: <Trophy size={20} />, title: "Rankings da rede", note: "Bairros, municípios e lideranças" },
    { id: "acessos" as const, icon: <Users size={20} />, title: "Lideranças e acessos", note: "Login, senha e permissões" },
    { id: "whatsapp" as const, icon: <MessageCircle size={20} />, title: "Integração do WhatsApp", note: "Status da conexão oficial" },
    { id: "privacidade" as const, icon: <ShieldCheck size={20} />, title: "Consentimento e privacidade", note: "Registros e saídas" },
    { id: "ajuda" as const, icon: <CircleHelp size={20} />, title: "Ajuda", note: "Guia rápido para lideranças" },
  ];

  return (
    <div className="view-stack">
      <section className="profile-card">
        <button type="button" className="profile-avatar" onClick={onOpenProfile} aria-label="Trocar foto de perfil">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            initials(userName)
          )}
          <span className="profile-avatar-edit">
            <Camera size={14} />
          </span>
        </button>
        <div>
          <span className="eyebrow">{role === "admin" ? "Administradora" : "Liderança"}</span>
          <h1>{userName}</h1>
          <p>{userEmail}</p>
          <button className="text-button" type="button" onClick={onOpenProfile} style={{ marginTop: 6 }}>
            Trocar foto
          </button>
        </div>
      </section>

      <button className="install-card" type="button" onClick={onInstall}>
        <span>
          <Smartphone size={22} />
        </span>
        <div>
          <strong>Instalar no celular</strong>
          <small>Abra como aplicativo, sem loja.</small>
        </div>
        <Download size={19} />
      </button>

      <section className="settings-list section-card section-card--flush">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onPanel(item.id)}>
            <span className="settings-icon">{item.icon}</span>
          <span>
            <span className="settings-title">{item.title}</span>
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
            <span className="settings-title">Configurações da rede</span>
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
      <span className="nav-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="nav-label">{label}</span>
    </button>
  );
}

function notificationIcon(kind: AppNotification["kind"]) {
  if (kind === "contact") return <UserPlus size={18} />;
  if (kind === "optout") return <ShieldCheck size={18} />;
  if (kind === "campaign") return <Send size={18} />;
  if (kind === "system") return <Settings size={18} />;
  return <CheckCircle2 size={18} />;
}

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Há ${days} d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

async function compressAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;
  ctx.fillStyle = "#ecfdf5";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (dataUrl.length > 180_000) {
    throw new Error("A foto ficou grande demais. Tente outra imagem.");
  }
  return dataUrl;
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
