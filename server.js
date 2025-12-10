const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROUTES ---

// Obtener todas las palabras
app.get('/api/words', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM words ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener palabras' });
    }
});

// Obtener una palabra aleatoria para el juego
app.get('/api/word/random', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT word FROM words ORDER BY RAND() LIMIT 1');
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'No hay palabras en la base de datos' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener palabra aleatoria' });
    }
});

// Añadir una nueva palabra
app.post('/api/words', async (req, res) => {
    const { word, category } = req.body;
    if (!word) return res.status(400).json({ error: 'La palabra es requerida' });

    try {
        const [result] = await db.query('INSERT INTO words (word, category) VALUES (?, ?)', [word, category || 'General']);
        res.json({ id: result.insertId, word, category });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'La palabra ya existe' });
        } else {
            res.status(500).json({ error: 'Error al guardar la palabra' });
        }
    }
});

// Eliminar una palabra
app.delete('/api/words/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM words WHERE id = ?', [id]);
        res.json({ message: 'Palabra eliminada' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar la palabra' });
    }
});

// --- FRONTEND ROUTES ---
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
