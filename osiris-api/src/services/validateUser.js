const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ nome, email, senha } = {}) {
  if (!nome || !email || !senha) {
    return "Nome, e-mail e senha são obrigatórios.";
  }

  if (nome.trim().length < 2) {
    return "O nome deve ter pelo menos 2 caracteres.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Informe um e-mail válido.";
  }

  if (senha.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }

  return null;
}

function validateLogin({ email, senha } = {}) {
  if (!email || !senha) {
    return "E-mail e senha são obrigatórios.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Informe um e-mail válido.";
  }

  return null;
}

module.exports = { validateRegistration, validateLogin };

