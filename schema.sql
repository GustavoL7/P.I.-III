-- Tabela para atender ao requisito de Gestão de Usuários [cite: 31]
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Tabela para Gestão de Tarefas/Ordens de Serviço [cite: 32, 33]
CREATE TABLE tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,
    equipamento TEXT NOT NULL,
    descricao TEXT,
    status TEXT DEFAULT 'A fazer', -- Colunas para o Kanban: A fazer, Em andamento, Concluído [cite: 34]
    prazo DATE, -- Coluna para a integração com Calendário [cite: 35]
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
);