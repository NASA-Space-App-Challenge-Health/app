import sqlite3
from database import DB_NAME

def avaliar_saude(dados_sensores):
    """
    Compara os dados dos sensores com o histórico médico do banco.
    Retorna o status, a ação recomendada, a previsão e se é emergência.
    """
    # 1. Conecta ao banco local e puxa os limites do astronauta
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT fc_repouso_max, spo2_minimo, co2_maximo_percentual FROM perfil_astronauta WHERE id=1")
    limites = cursor.fetchone()
    conn.close()

    if not limites:
        return {"status": "ERRO", "acao": "Histórico médico não encontrado no banco local."}

    # Desempacota os limites
    max_fc, min_spo2, max_co2 = limites

    # Pega os dados atuais
    fc = dados_sensores['fc_bpm']
    spo2 = dados_sensores['spo2']
    co2 = dados_sensores['co2_percentual']

    # 2. Valores padrão
    status = "Normal"
    acao = "Manter rotina da missão. Todos os sinais vitais estão estáveis."
    emergencia = False
    previsao = "Estável"

    # 3. Lógica de Avaliação (Motor de Regras)
    # Condição Crítica (Ex: FC muito alta, O2 muito baixo, CO2 muito alto)
    if fc > (max_fc + 40) or spo2 < (min_spo2 - 3) or co2 > (max_co2 + 0.3):
        status = "CRÍTICO"
        acao = "AÇÃO IMEDIATA: Reduzir esforço físico, checar sistema de suporte à vida (PLSS) e contatar a base."
        emergencia = True
        previsao = "Risco iminente de falha fisiológica."
        
    # Condição de Atenção (Ex: passou do limite, mas não é grave ainda)
    elif fc > max_fc or spo2 < min_spo2 or co2 > max_co2:
        status = "ATENÇÃO"
        acao = "Ação recomendada: Realizar exercício de respiração profunda e beber água."
        
        # Lógica Preditiva Simples para o requisito 6
        if fc > max_fc:
            previsao = "Tendência de fadiga cardiovascular nas próximas 2 horas."
        elif co2 > max_co2:
            previsao = "Possível acúmulo de CO2 no traje. Ventilação pode falhar."

    # 4. Retorna o pacote completo para a interface e para o banco
    return {
        "status": status,
        "acao": acao,
        "previsao": previsao,
        "emergencia_override": emergencia, 
        "dados": dados_sensores
    }