require('dotenv').config();
const mysql = require('mysql2');

console.log('--- DIAGNÓSTICO DE BASE DE DATOS ---');
console.log('Intentando conectar con los siguientes datos:');
console.log(`HOST: ${process.env.DB_HOST}`);
console.log(`USER: ${process.env.DB_USER}`);
console.log(`DB:   ${process.env.DB_NAME}`);
console.log('-------------------------------------');

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.connect((err) => {
    if (err) {
        console.error('❌ ERROR FATAL DE CONEXIÓN:');
        console.error(`Código: ${err.code}`);
        console.error(`Mensaje: ${err.message}`);
        if (err.code === 'ECONNREFUSED') {
            console.log('\n--> CONSEJO: ¿Está encendido XAMPP o tu servidor MySQL?');
            console.log('--> CONSEJO: Asegúrate de que MySQL corre en el puerto 3306.');
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n--> CONSEJO: Revisa tu usuario y contraseña en el archivo .env');
        } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_FAIL') {
            console.log('\n--> CONSEJO: El HOST es incorrecto. En local debería ser 127.0.0.1');
        }
    } else {
        console.log('✅ ¡CONEXIÓN EXITOSA!');
        console.log('La base de datos funciona perfectamente.');
        connection.query('SELECT COUNT(*) as count FROM words', (err, results) => {
            if (err) {
                console.error('Error consultando la tabla words:', err.message);
            } else {
                console.log(`Se encontraron ${results[0].count} palabras en la tabla.`);
            }
            connection.end();
        });
    }
});
