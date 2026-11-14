import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Activity, Heart, Wind, AlertTriangle } from 'lucide-react';

const API_URL = "http://127.0.0.1:8000/api/telemetria/atual";

export default function Dashboard() {
  const { categoria } = useParams();
  const [dados, setDados] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(API_URL);
        setDados(response.data);
      } catch (error) {
        console.error("Erro na API", error);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!dados) return <div className="text-accent animate-pulse text-xl">Carregando telemetria do traje...</div>;

  if (!categoria) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6 text-white">Resumo Geral da Saúde</h1>
        
        <div className={`p-6 rounded-xl border mb-6 flex items-center justify-between ${
          dados.status === 'CRÍTICO' ? 'bg-red-900/30 border-red-500' : 
          dados.status === 'ATENÇÃO' ? 'bg-yellow-900/30 border-yellow-500' : 'bg-green-900/30 border-green-500'
        }`}>
          <div>
            <h2 className="text-2xl font-bold text-white">Status: {dados.status}</h2>
            <p className="text-gray-400 text-sm mt-1">Última avaliação: Agora mesmo</p>
          </div>
          {dados.emergencia_override && (
            <div className="bg-red-600 px-4 py-2 rounded-lg font-bold animate-pulse text-white">
              EMERGÊNCIA ATIVADA
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-panel p-6 rounded-xl border border-gray-800">
            <Heart className="text-red-500 mb-3" size={28} />
            <p className="text-3xl font-bold text-white">{dados.dados.fc_bpm} <span className="text-sm font-normal text-gray-400">bpm</span></p>
            <p className="text-sm text-gray-400 mt-1">Freq. Cardíaca</p>
          </div>
          <div className="bg-panel p-6 rounded-xl border border-gray-800">
            <Activity className="text-blue-500 mb-3" size={28} />
            <p className="text-3xl font-bold text-white">{dados.dados.spo2}<span className="text-sm font-normal text-gray-400">%</span></p>
            <p className="text-sm text-gray-400 mt-1">Oxigenação</p>
          </div>
          <div className="bg-panel p-6 rounded-xl border border-gray-800">
            <Wind className="text-gray-400 mb-3" size={28} />
            <p className="text-3xl font-bold text-white">{dados.dados.co2_percentual}<span className="text-sm font-normal text-gray-400">%</span></p>
            <p className="text-sm text-gray-400 mt-1">CO2</p>
          </div>
        </div>

        <div className="bg-panel p-6 rounded-xl border border-gray-800">
          <h2 className="text-xl font-bold text-accent mb-4">Assistente de Decisão</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Ação Recomendada:</p>
              <p className="text-lg font-medium text-white">{dados.acao}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Análise Preditiva:</p>
              <p className="text-lg font-medium text-yellow-400">{dados.previsao}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center opacity-70 mt-20">
      <AlertTriangle size={64} className="text-yellow-500 mb-4" />
      <h1 className="text-3xl font-bold mb-2 capitalize text-white">Módulo {categoria}</h1>
      <p className="text-gray-400">Integração de sensores desta área em desenvolvimento pela equipe.</p>
    </div>
  );
}