from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from contextlib import asynccontextmanager

# Importa nossos módulos criados anteriormente
from database import init_db, DB_NAME
from mock_sensors import ler_sensores_traje
from rule_engine import avaliar_saude

# Função para inicializar o banco quando o servidor subir
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db() # Garante que o banco existe
    yield

app = FastAPI(lifespan=lifespan)

# Configuração de CORS: Permite que o Frontend acesse a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, trocaríamos pelo domínio do app
    allow_methods=["*"],
    allow_headers=["*"],
)

# ROTA 1: Simula a leitura atual dos sensores, processa e salva no banco
@app.get("/api/telemetria/atual")
async def get_telemetria_atual():
    # 1. Pede a leitura para o "hardware" (Mock)
    dados_brutos = ler_sensores_traje()
    
    # 2. Passa pelo "cérebro" (Motor de Regras)
    resultado = avaliar_saude(dados_brutos)
    
    # 3. Salva a leitura no Banco de Dados Local
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO telemetria (fc_bpm, spo2, co2_percentual, status)
        VALUES (?, ?, ?, ?)
    ''', (resultado['dados']['fc_bpm'], resultado['dados']['spo2'], resultado['dados']['co2_percentual'], resultado['status']))
    conn.commit()
    conn.close()

    # 4. Retorna os dados processados em JSON para o Frontend
    return resultado

# ROTA 2: Puxa o histórico do banco para montar o gráfico de evolução
@app.get("/api/telemetria/historico")
async def get_historico():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Pega as últimas 20 leituras
    cursor.execute("SELECT timestamp, fc_bpm, spo2, co2_percentual, status FROM telemetria ORDER BY id DESC LIMIT 20")
    rows = cursor.fetchall()
    conn.close()
    
    historico = []
    for row in rows:
        historico.append({
            "timestamp": row[0],
            "fc_bpm": row[1],
            "spo2": row[2],
            "co2_percentual": row[3],
            "status": row[4]
        })
    
    # Inverte a lista para o gráfico ficar na ordem cronológica correta
    return historico[::-1]