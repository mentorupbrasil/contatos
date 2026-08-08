"use client";

import { ArrowRight, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password }),
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
        E-mail
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="username"
          placeholder="voce@exemplo.com"
          required
        />
      </label>
      <label>
        Senha
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          minLength={6}
        />
      </label>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button--primary button--wide" type="submit" disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
        <ArrowRight size={19} aria-hidden="true" />
      </button>
    </form>
  );
}

export function LoginBrand() {
  return (
    <div className="login-brand">
      <Image
        src="/brand/luzia-logo-clear.png"
        alt="Luzia Mary"
        width={168}
        height={22}
        className="brand-wordmark"
        priority
        unoptimized
      />
      <p className="login-brand-sub">Rede de Lideranças</p>
    </div>
  );
}

export function LoginTrust() {
  return (
    <div className="trust-row" aria-label="Recursos de segurança">
      <span>
        <LockKeyhole size={16} /> Login por senha
      </span>
      <span>
        <ShieldCheck size={16} /> Consentimento registrado
      </span>
      <span>
        <MessageCircle size={16} /> WhatsApp oficial
      </span>
    </div>
  );
}
