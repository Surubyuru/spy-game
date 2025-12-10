// Admin Logic

const form = document.getElementById('add-word-form');
const container = document.getElementById('words-container');

// Load words on startup
fetchWords();

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wordInput = document.getElementById('new-word');
    const categoryInput = document.getElementById('new-category');

    const word = wordInput.value.trim();
    const category = categoryInput.value.trim();

    if (!word) return;

    try {
        const res = await fetch('/api/words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word, category })
        });

        if (res.ok) {
            wordInput.value = '';
            categoryInput.value = '';
            fetchWords(); // Refresh list
        } else {
            const err = await res.json();
            alert('Error: ' + err.error);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
});

async function fetchWords() {
    try {
        const res = await fetch('/api/words');
        const words = await res.json();
        renderWords(words);
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p>Error al cargar palabras.</p>';
    }
}

function renderWords(words) {
    container.innerHTML = '';
    words.forEach(w => {
        const div = document.createElement('div');
        div.className = 'word-chip glass-panel';
        div.innerHTML = `
            <div>
                <strong>${w.word}</strong><br>
                <small style="opacity: 0.6">${w.category}</small>
            </div>
            <button class="delete-btn" onclick="deleteWord(${w.id})">🗑️</button>
        `;
        container.appendChild(div);
    });
}

// Make deleteWord global so onclick works
window.deleteWord = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar esta palabra?')) return;

    try {
        const res = await fetch(`/api/words/${id}`, { method: 'DELETE' });
        if (res.ok) {
            fetchWords();
        } else {
            alert('Error al eliminar');
        }
    } catch (error) {
        console.error(error);
    }
};
