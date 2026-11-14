"""SQLite prototype. Moved from backend/database.py.

Not used by the FastAPI app. The live store is Postgres. The .db file is gitignored.
"""

import sqlite3

DB_NAME = "space_health.db"

def init_db():
    """Inicializa o banco de dados e cria as tabelas se não existirem."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Tabela 1: Histórico Médico do Astronauta
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS perfil_astronauta (
            id INTEGER PRIMARY KEY,
            nome TEXT,
            fc_repouso_min INTEGER,
            fc_repouso_max INTEGER,
            spo2_minimo INTEGER,
            co2_maximo_percentual REAL
        )
    ''')

    # Tabela 2: Logs de Telemetria
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            fc_bpm INTEGER,
            spo2 INTEGER,
            co2_percentual REAL,
            status TEXT
        )
    ''')

    # Inserir dados fictícios do astronauta
    cursor.execute('SELECT COUNT(*) FROM perfil_astronauta')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO perfil_astronauta (nome, fc_repouso_min, fc_repouso_max, spo2_minimo, co2_maximo_percentual)
            VALUES ('Cmdr. Silva', 60, 90, 95, 0.5)
        ''')
        print("Perfil do astronauta 'Cmdr. Silva' inserido no banco.")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Banco de dados local 'space_health.db' inicializado com sucesso!")