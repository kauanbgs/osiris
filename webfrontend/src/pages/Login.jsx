
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, KeyRound } from "lucide-react";

import DotField from "@/components/DotField";
import { useAuth } from "@/contexts/AuthContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    const normalizedEmail = email.trim();

    // Validação dos campos obrigatórios
    if (!normalizedEmail || !password.trim()) {
      setError("E-mail e senha são obrigatórios.");
      return;
    }

    // Validação do formato do e-mail
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Digite um e-mail válido.");
      return;
    }

    try {
      setLoading(true);

      // Realiza o login utilizando o AuthContext
      await login(normalizedEmail, password);

      // Redireciona o usuário após autenticação
      navigate("/home", { replace: true });
    } catch (error) {
      // Extrai a mensagem corretamente da resposta da API
      const apiMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        error.response?.data?.message;

      // Tradução das mensagens de erro
      const messages = {
        "Invalid email or password.":
          "E-mail ou senha incorretos.",
        "Informe um e-mail válido.":
          "Digite um e-mail válido.",
        "E-mail e senha são obrigatórios.":
          "E-mail e senha são obrigatórios.",
      };

      // Garante que apenas textos sejam exibidos
      const message = !error.response
        ? "Não foi possível conectar à API. Verifique sua conexão e tente novamente."
        : messages[
            typeof apiMessage === "string" ? apiMessage : ""
          ] ||
          (typeof apiMessage === "string"
            ? apiMessage
            : "Não foi possível realizar o login.");

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 flex items-center justify-center px-4 py-12 overflow-hidden">

      {/* Fundo animado */}
      <div className="absolute inset-0 pointer-events-none">
        <DotField
          dotRadius={1.5}
          dotSpacing={14}
          bulgeStrength={67}
          glowRadius={160}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={500}
          cursorForce={0.1}
          bulgeOnly
          gradientFrom="#A855F7"
          gradientTo="#B497CF"
          glowColor="#120F17"
        />
      </div>

      <div className="relative z-10 w-full max-w-md">

        {/* Título */}
        <h1 className="font-mono text-6xl font-bold text-zinc-100 text-center mb-10">
          Osíris
        </h1>

        {/* Formulário de login */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8"
        >

          {/* Campo de e-mail */}
          <div className="mb-6">
            <label
              htmlFor="login-email"
              className="flex items-center gap-2 font-mono text-sm text-zinc-200 mb-2"
            >
              <Mail size={16} strokeWidth={1.75} />
              E-mail
            </label>

            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@gmail.com"
              autoComplete="email"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Campo de senha */}
          <div className="mb-4">
            <label
              htmlFor="login-password"
              className="flex items-center gap-2 font-mono text-sm text-zinc-200 mb-2"
            >
              <KeyRound size={16} strokeWidth={1.75} />
              Senha
            </label>

            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Mensagem de erro */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3"
            >
              <p className="font-mono text-sm text-red-400">
                {error}
              </p>
            </div>
          )}

          {/* Botão de login */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-3 font-mono font-semibold text-white transition-colors"
          >
            {loading ? "Entrando..." : "Iniciar Sessão"}
          </button>
        </form>

        {/* Link para cadastro */}
        <p className="text-center font-mono text-sm text-zinc-400 mt-6">
          Não tem conta?{" "}
          <Link
            to="/cadastro"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            se cadastre!
          </Link>
        </p>
      </div>
    </div>
  );
}
