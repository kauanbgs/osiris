require('dotenv-safe').config({ path: '.env.example' });

const request = require('supertest');
const app = require('../index');

describe('API Health Check', () => {
  it('deve retornar status ok no endpoint de health', async () => {
    const response = await request(app)
      .get('/api/osiris/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('Rotas de Autenticação', () => {
  describe('POST /api/osiris/auth/register', () => {
    it('deve retornar erro se dados estiverem faltando', async () => {
      const response = await request(app)
        .post('/api/osiris/auth/register')
        .send({})
        .expect('Content-Type', /json/);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/osiris/auth/login', () => {
    it('deve retornar erro se credenciais estiverem faltando', async () => {
      const response = await request(app)
        .post('/api/osiris/auth/login')
        .send({})
        .expect('Content-Type', /json/);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/osiris/auth/me', () => {
    it('deve retornar erro 401 sem token JWT', async () => {
      const response = await request(app)
        .get('/api/osiris/auth/me')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 401 com token inválido', async () => {
      const response = await request(app)
        .get('/api/osiris/auth/me')
        .set('Authorization', 'Bearer token_invalido')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Rota não encontrada', () => {
  it('deve retornar 404 para rotas inexistentes', async () => {
    const response = await request(app)
      .get('/rota/inexistente')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Rota não encontrada.');
  });
});
