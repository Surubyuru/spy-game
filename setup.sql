CREATE DATABASE IF NOT EXISTS spy_game_db;
USE spy_game_db;

CREATE TABLE IF NOT EXISTS words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    word VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar 100 palabras por defecto
INSERT IGNORE INTO words (word, category) VALUES 
('Avión', 'Transporte'), ('Tren', 'Transporte'), ('Barco', 'Transporte'), ('Submarino', 'Transporte'), ('Helicóptero', 'Transporte'),
('Coche', 'Transporte'), ('Bicicleta', 'Transporte'), ('Monopatín', 'Transporte'), ('Autobús', 'Transporte'), ('Taxi', 'Transporte'),
('Manzana', 'Comida'), ('Banana', 'Comida'), ('Naranja', 'Comida'), ('Uva', 'Comida'), ('Fresa', 'Comida'),
('Pizza', 'Comida'), ('Hamburguesa', 'Comida'), ('Sushi', 'Comida'), ('Tacos', 'Comida'), ('Pasta', 'Comida'),
('Perro', 'Animales'), ('Gato', 'Animales'), ('León', 'Animales'), ('Tigre', 'Animales'), ('Elefante', 'Animales'),
('Jirafa', 'Animales'), ('Delfín', 'Animales'), ('Tiburón', 'Animales'), ('Águila', 'Animales'), ('Pingüino', 'Animales'),
('Fútbol', 'Deportes'), ('Baloncesto', 'Deportes'), ('Tenis', 'Deportes'), ('Golf', 'Deportes'), ('Natación', 'Deportes'),
('Voleibol', 'Deportes'), ('Béisbol', 'Deportes'), ('Rugby', 'Deportes'), ('Boxeo', 'Deportes'), ('Esquí', 'Deportes'),
('Guitarra', 'Música'), ('Piano', 'Música'), ('Batería', 'Música'), ('Violín', 'Música'), ('Flauta', 'Música'),
('Trompeta', 'Música'), ('Saxofón', 'Música'), ('Micrófono', 'Música'), ('Auriculares', 'Música'), ('Altavoz', 'Música'),
('Playa', 'Lugares'), ('Montaña', 'Lugares'), ('Bosque', 'Lugares'), ('Desierto', 'Lugares'), ('Selva', 'Lugares'),
('Ciudad', 'Lugares'), ('Pueblo', 'Lugares'), ('Escuela', 'Lugares'), ('Hospital', 'Lugares'), ('Aeropuerto', 'Lugares'),
('Médico', 'Profesiones'), ('Profesor', 'Profesiones'), ('Policía', 'Profesiones'), ('Bombero', 'Profesiones'), ('Ingeniero', 'Profesiones'),
('Abogado', 'Profesiones'), ('Cocinero', 'Profesiones'), ('Carpintero', 'Profesiones'), ('Astronauta', 'Profesiones'), ('Actor', 'Profesiones'),
('Rojo', 'Colores'), ('Azul', 'Colores'), ('Verde', 'Colores'), ('Amarillo', 'Colores'), ('Negro', 'Colores'),
('Blanco', 'Colores'), ('Rosa', 'Colores'), ('Morado', 'Colores'), ('Naranja', 'Colores'), ('Gris', 'Colores'),
('Camisa', 'Ropa'), ('Pantalón', 'Ropa'), ('Zapatos', 'Ropa'), ('Sombrero', 'Ropa'), ('Abrigo', 'Ropa'),
('Vestido', 'Ropa'), ('Falda', 'Ropa'), ('Calcetines', 'Ropa'), ('Guantes', 'Ropa'), ('Bufanda', 'Ropa'),
('Ordenador', 'Tecnología'), ('Teléfono', 'Tecnología'), ('Tablet', 'Tecnología'), ('Reloj', 'Tecnología'), ('Cámara', 'Tecnología'),
('Televisión', 'Tecnología'), ('Radio', 'Tecnología'), ('Teclado', 'Tecnología'), ('Ratón', 'Tecnología'), ('Impresora', 'Tecnología');
