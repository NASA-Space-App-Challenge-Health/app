"""Simulated xEMU suit sensors. Moved from backend/mock_sensors.py.

ler_sensores_traje() is unchanged. The API stores a sample in Postgres and
compares cabin CO2 with NASA-STD-3001 (3 mmHg, one-hour average), not the
0.5% note in this generator.
"""

import random
import time

def ler_sensores_traje():
    """
    Simula a leitura dos sensores do xEMU.
    Retorna um dicionário com os dados do WHRM e PLSS.
    """
    # 1. Simula o WHRM (Monitor Cardíaco Com Fio)
    # Batimento normal em repouso: 65 a 100 bpm.
    fc_bpm = random.randint(65, 100)
    
    # 15% de chance de simular um pico (ex: o astronauta começou a se exercitar)
    if random.random() > 0.85: 
        fc_bpm = random.randint(120, 160)

    # 2. Simula o PLSS (Sistema de Suporte à Vida)
    # Saturação de O2 normal: > 95%
    spo2 = random.randint(93, 100) 
    
    # Nível de CO2 normal: < 0.5%. Vamos simular entre 0.2 e 0.8
    co2_percentual = round(random.uniform(0.2, 0.8), 2) 

    return {
        "fc_bpm": fc_bpm,
        "spo2": spo2,
        "co2_percentual": co2_percentual
    }

# Bloco de teste: roda apenas se executarmos este arquivo diretamente
if __name__ == "__main__":
    print("Iniciando simulação de sensores do traje (xEMU)...")
    print("-" * 40)
    
    # Faz 5 leituras para testar
    for i in range(5):
        dados = ler_sensores_traje()
        print(f"Leitura {i+1}:")
        print(f"  - Frequência Cardíaca: {dados['fc_bpm']} bpm")
        print(f"  - Saturação de O2 (SpO2): {dados['spo2']}%")
        print(f"  - CO2 Exalado: {dados['co2_percentual']}%")
        print("-" * 40)
        time.sleep(1) # Espera 1 segundo entre as leituras