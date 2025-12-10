require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', // Asegúrate de configurar esto en .env
  database: process.env.DB_NAME || 'spy_game_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = connection.promise();
