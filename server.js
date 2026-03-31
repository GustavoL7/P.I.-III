const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json());

// Caminho para o banco de dados
const dbPath = path.resolve(__dirname, 'database.db');

// Conexão e criação automática do banco se não existir
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao SQLite:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    initializeDb();
  }
});

// Inicialização das tabelas com base no schema solicitado
function initializeDb() {
  db.serialize(() => {
    // Tabela usuarios
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `);

    // Tabela tarefas com os campos solicitados
    db.run(`
      CREATE TABLE IF NOT EXISTS tarefas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT NOT NULL,
        equipamento TEXT NOT NULL,
        descricao TEXT,
        status TEXT DEFAULT 'A fazer',
        prazo DATE,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabelas inicializadas com sucesso.');
  });
}

// Endpoints básicos de exemplo
app.get('/', (req, res) => {
  res.send('Servidor Node.js com SQLite funcionando!');
});

// Listar todos os usuários
app.get('/api/usuarios', (req, res) => {
  db.all('SELECT id, username FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Listar todas as tarefas
app.get('/api/tarefas', (req, res) => {
  db.all('SELECT * FROM tarefas', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Adicionar uma nova tarefa
app.post('/api/tarefas', (req, res) => {
  const { cliente, equipamento, descricao, status, prazo } = req.body;
  
  if (!cliente || !equipamento) {
    return res.status(400).json({ error: 'Cliente e Equipamento são obrigatórios.' });
  }

  const query = `INSERT INTO tarefas (cliente, equipamento, descricao, status, prazo) VALUES (?, ?, ?, ?, ?)`;
  const params = [cliente, equipamento, descricao, status || 'A fazer', prazo];

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ 
      id: this.lastID,
      message: 'Tarefa criada com sucesso!' 
    });
  });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
