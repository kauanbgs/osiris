const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ name, email, password } = {}) {
  if (!name || !email || !password) {
    return "Nome, e-mail e senha são obrigatórios.";
  }

  if (name.trim().length < 2) {
    return "O nome deve ter pelo menos 2 caracteres.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Informe um e-mail válido.";
  }

  if (password.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }

  return null;
}

function validateLogin({ email, password } = {}) {
  if (!email || !password) {
    return "E-mail e senha são obrigatórios.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Informe um e-mail válido.";
  }

  return null;
}

module.exports = { validateRegistration, validateLogin };

