const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para JSON e arquivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

    // Criação de usuário padrão para teste
    db.run(`
      INSERT OR IGNORE INTO usuarios (username, password) 
      VALUES ('admin', 'admin123')
    `);

    // Inserção de dados de teste se a tabela estiver vazia
    db.get("SELECT COUNT(*) as count FROM tarefas", [], (err, row) => {
      if (row.count === 0) {
        const testTasks = [
          ['Artur Mendes', 'Precision T7920', 'Hardware Failure - Power Supply', 'A fazer', '2024-10-24'],
          ['Beatriz Rocha', 'MacBook Pro M2', 'System Cleanup & Optimization', 'Em andamento', '2024-10-27'],
          ['Carlos Pereira', 'Razer Blade 15', 'GPU Replacement - Artifacting', 'A fazer', '2024-10-09'],
          ['Daniel Souza', 'ThinkPad X1 Carbon', 'OS Reinstallation', 'Concluído', '2024-11-02'],
          ['Ana Júlia', 'MacBook Pro', 'Troca de Tela', 'Em andamento', '2024-04-15']
        ];
        const stmt = db.prepare("INSERT INTO tarefas (cliente, equipamento, descricao, status, prazo) VALUES (?, ?, ?, ?, ?)");
        testTasks.forEach(task => stmt.run(task));
        stmt.finalize();
        console.log('5 tarefas de teste adicionadas.');
      }
    });

    console.log('Tabelas inicializadas e usuário padrão verificado.');
  });
}

// --- ROTAS DE PÁGINAS ---

// Rota do Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// --- ROTAS DE API (USUÁRIOS) ---

// Rota de Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
  }

  const query = `SELECT * FROM usuarios WHERE username = ? AND password = ?`;
  db.get(query, [username, password], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    
    if (row) {
      res.json({ 
        success: true, 
        message: 'Login realizado com sucesso!',
        user: { id: row.id, username: row.username }
      });
    } else {
      res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
    }
  });
});

// Listar todos os usuários
app.get('/api/usuarios', (req, res) => {
  db.all('SELECT id, username FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- ROTAS DE API (TAREFAS / ORDENS DE SERVIÇO) ---

// Listar todas as tarefas
app.get('/api/tarefas', (req, res) => {
  db.all('SELECT * FROM tarefas ORDER BY data_criacao DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Buscar uma única tarefa
app.get('/api/tarefas/:id', (req, res) => {
  db.get('SELECT * FROM tarefas WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    res.json(row);
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

// Atualizar uma tarefa completa (PUT)
app.put('/api/tarefas/:id', (req, res) => {
  const { cliente, equipamento, descricao, status, prazo } = req.body;
  const query = `UPDATE tarefas SET cliente = ?, equipamento = ?, descricao = ?, status = ?, prazo = ? WHERE id = ?`;
  const params = [cliente, equipamento, descricao, status, prazo, req.params.id];

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    res.json({ message: 'Tarefa atualizada com sucesso!' });
  });
});

// Atualizar apenas o status (PATCH - Útil para o Kanban)
app.patch('/api/tarefas/:id/status', (req, res) => {
  const { status } = req.body;
  db.run('UPDATE tarefas SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    res.json({ message: 'Status atualizado!' });
  });
});

// Excluir uma tarefa
app.delete('/api/tarefas/:id', (req, res) => {
  db.run('DELETE FROM tarefas WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    res.json({ message: 'Tarefa excluída com sucesso!' });
  });
});

// --- ROTAS DE API (ESTATÍSTICAS) ---

app.get('/api/dashboard/stats', (req, res) => {
  const stats = {};
  db.serialize(() => {
    db.get("SELECT COUNT(*) as total FROM tarefas", (err, row) => { stats.total = row.total; });
    db.get("SELECT COUNT(*) as pending FROM tarefas WHERE status = 'A fazer'", (err, row) => { stats.pending = row.pending; });
    db.get("SELECT COUNT(*) as inProgress FROM tarefas WHERE status = 'Em andamento'", (err, row) => { stats.inProgress = row.inProgress; });
    db.get("SELECT COUNT(*) as completed FROM tarefas WHERE status = 'Concluído'", (err, row) => { 
      stats.completed = row.completed; 
      res.json(stats);
    });
  });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
