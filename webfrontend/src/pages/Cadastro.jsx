
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, KeyRound, User } from "lucide-react";

import DotField from "@/components/DotField";
import { useAuth } from "@/contexts/AuthContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Cadastro() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();

    // Verifica os campos obrigatórios
    if (!normalizedName || !normalizedEmail || !password.trim()) {
      setError("Nome, e-mail e senha são obrigatórios.");
      return;
    }

    // Validação do nome
    if (normalizedName.length < 2) {
      setError("O nome deve ter pelo menos 2 caracteres.");
      return;
    }

    // Validação do e-mail
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Digite um e-mail válido.");
      return;
    }

    // Validação de senha conforme a API
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    try {
      setLoading(true);

      // Realiza o cadastro com o AuthContext
      await register(
        normalizedName,
        normalizedEmail,
        password
      );

      // Exibe a mensagem de sucesso
      setSuccess("Usuário cadastrado com sucesso!");

      // Redireciona para o login
      setTimeout(() => {
        navigate("/login");
      }, 1000);

    } catch (error) {
      // Extrai a mensagem da API
      const apiMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        error.response?.data?.message;

      // Traduz mensagens conhecidas
      const messages = {
        "Email already registered.":
          "Este e-mail já está cadastrado.",
        "Nome, e-mail e senha são obrigatórios.":
          "Nome, e-mail e senha são obrigatórios.",
        "O nome deve ter pelo menos 2 caracteres.":
          "O nome deve ter pelo menos 2 caracteres.",
        "Informe um e-mail válido.":
          "Digite um e-mail válido.",
        "A senha deve ter pelo menos 8 caracteres.":
          "A senha deve ter pelo menos 8 caracteres.",
      };

      // Evita que objetos de erro causem tela preta
      const message = !error.response
        ? "Não foi possível conectar à API. Verifique sua conexão e tente novamente."
        : messages[
            typeof apiMessage === "string" ? apiMessage : ""
          ] ||
          (typeof apiMessage === "string"
            ? apiMessage
            : "Não foi possível realizar o cadastro.");

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

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8"
        >

          {/* Nome completo */}
          <div className="mb-6">
            <label
              htmlFor="cadastro-name"
              className="flex items-center gap-2 font-mono text-sm text-zinc-200 mb-2"
            >
              <User size={16} strokeWidth={1.75} />
              Nome Completo
            </label>

            <input
              id="cadastro-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome completo"
              autoComplete="name"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* E-mail */}
          <div className="mb-6">
            <label
              htmlFor="cadastro-email"
              className="flex items-center gap-2 font-mono text-sm text-zinc-200 mb-2"
            >
              <Mail size={16} strokeWidth={1.75} />
              E-mail
            </label>

            <input
              id="cadastro-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@gmail.com"
              autoComplete="email"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Senha */}
          <div className="mb-4">
            <label
              htmlFor="cadastro-password"
              className="flex items-center gap-2 font-mono text-sm text-zinc-200 mb-2"
            >
              <KeyRound size={16} strokeWidth={1.75} />
              Senha
            </label>

            <input
              id="cadastro-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Mensagem de erro */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3"
            >
              <p className="font-mono text-sm text-red-400">
                {error}
              </p>
            </div>
          )}

          {/* Mensagem de sucesso */}
          {success && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
            >
              <p className="font-mono text-sm text-emerald-400">
                {success}
              </p>
            </div>
          )}

          {/* Botão de cadastro */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-3 font-mono font-semibold text-white transition-colors"
          >
            {loading ? "Criando..." : "Criar Conta"}
          </button>
        </form>

        {/* Link para o login */}
        <p className="text-center font-mono text-sm text-zinc-400 mt-6">
          Já tem uma conta?{" "}
          <Link
            to="/login"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            iniciar sessão
          </Link>
        </p>
      </div>
    </div>
  );
}
