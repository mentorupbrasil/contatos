"use client";

import { ArrowRight, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label>
        Seu nome
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          placeholder="Ex.: Ana Paula"
        />
      </label>
      <label>
        E-mail liberado
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          required
        />
      </label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="button button--primary button--wide" type="submit" disabled={loading}>
        {loading ? "Entrando…" : "Entrar na rede"}
        <ArrowRight size={19} aria-hidden="true" />
      </button>
      <Link className="button button--ghost button--wide" href="/demo">
        Ver demonstração
      </Link>
    </form>
  );
}

export function LoginTrust() {
  return (
    <div className="trust-row" aria-label="Recursos de segurança">
      <span>
        <LockKeyhole size={16} /> Acesso protegido
      </span>
      <span>
        <ShieldCheck size={16} /> Consentimento registrado
      </span>
      <span>
        <MessageCircle size={16} /> API oficial
      </span>
    </div>
  );
}
