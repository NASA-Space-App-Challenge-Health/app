import { useNavigate } from 'react-router-dom';
import { Fingerprint } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-space flex items-center justify-center">
      <div className="bg-panel p-10 rounded-2xl border border-gray-800 text-center max-w-md w-full shadow-2xl">
        <Fingerprint size={64} className="text-accent mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">Identificação Biométrica</h1>
        <p className="text-gray-400 mb-8">Aproxime o crachá ou use o reconhecimento facial (IA).</p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="w-full bg-accent text-black font-bold py-3 rounded-lg hover:bg-cyan-400 transition-colors"
        >
          Simular Acesso Autorizado
        </button>
      </div>
    </div>
  );
}