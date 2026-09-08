// Set test environment variables before requiring the app
process.env.NODE_ENV = "test";
process.env.PORT = "5000";
process.env.JWT_SECRET = "test_jwt_secret_key_for_testing_purposes";
process.env.JWT_EXPIRES_IN = "1h";
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "3306";
process.env.DB_USER = "osiris";
process.env.DB_PASSWORD = "osiris";
process.env.DB_NAME = "osiris";
process.env.CORS_ORIGIN = "http://localhost:5173";

// Suppress dotenv-safe logs during tests
process.env.DOTENV_CONFIG_SILENT = "true";
