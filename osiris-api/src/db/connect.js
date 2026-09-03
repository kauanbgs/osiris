const mysql = require("mysql2")
const jwt = require("jsonwebtoken");

const pool = mysql.createPool({
    connectionLimit:10,
    host:process.env.DB_HOST, // Mude para o seu host (IP)
    user:process.env.DB_USER, // Mude para o seu User do Mysql aluno
    password:process.env.DB_PASSWORD, // Mude para a senha do seu User senai@604
    database: process.env.DB_NAME // Mude para o seu database JÁ criado
})

module.exports = pool;
