require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createPool({
  host: process.env.DB_HOST || 'impostor-spygamedb-r1nysg',
  port: process.env.DB_PORT || 3306, // Puerto configurable
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'spywere',
  database: process.env.DB_NAME || 'spy_game_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = connection.promise();
