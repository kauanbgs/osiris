import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import Cadastro from './Cadastro';
import { AuthContext } from '@/contexts/AuthContext';

function renderWithAuth(ui, authValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Fluxos de autenticação', () => {
  it('mostra alerta quando login é enviado em branco', async () => {
    const user = userEvent.setup();
    const login = vi.fn();

    renderWithAuth(<Login />, { login, register: vi.fn(), user: null, loading: false, isAuthenticated: false, logout: vi.fn() });

    await user.click(screen.getByRole('button', { name: /iniciar sessão/i }));

    expect(screen.getByText('E-mail e senha são obrigatórios.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('mostra alerta quando o e-mail do login está em formato inválido', async () => {
    const user = userEvent.setup();
    const login = vi.fn();

    renderWithAuth(<Login />, { login, register: vi.fn(), user: null, loading: false, isAuthenticated: false, logout: vi.fn() });

    await user.type(screen.getByPlaceholderText('seuemail@gmail.com'), 'email-invalido');
    await user.type(screen.getByPlaceholderText('••••••••'), '123456');
    await user.click(screen.getByRole('button', { name: /iniciar sessão/i }));

    expect(screen.getByText('Digite um e-mail válido.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('mostra alerta quando cadastro é enviado em branco', async () => {
    const user = userEvent.setup();
    const register = vi.fn();

    renderWithAuth(<Cadastro />, { login: vi.fn(), register, user: null, loading: false, isAuthenticated: false, logout: vi.fn() });

    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(screen.getByText('Nome, e-mail e senha são obrigatórios.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('mostra alerta quando o cadastro envia e-mail inválido', async () => {
    const user = userEvent.setup();
    const register = vi.fn();

    renderWithAuth(<Cadastro />, { login: vi.fn(), register, user: null, loading: false, isAuthenticated: false, logout: vi.fn() });

    await user.type(screen.getByPlaceholderText('Seu nome completo'), 'João');
    await user.type(screen.getByPlaceholderText('seuemail@gmail.com'), 'email-invalido');
    await user.type(screen.getByPlaceholderText('••••••••'), '123456');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(screen.getByText('Digite um e-mail válido.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});
