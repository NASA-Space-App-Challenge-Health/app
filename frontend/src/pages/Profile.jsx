export default function Profile() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-white">Perfil do Astronauta</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-panel p-6 rounded-xl border border-gray-800">
          <h2 className="text-xl text-accent mb-4">Dados Pessoais</h2>
          <p className="text-gray-300 mb-2"><strong>Nome:</strong> Cmdr. Silva</p>
          <p className="text-gray-300 mb-2"><strong>Idade:</strong> 42 anos</p>
          <p className="text-gray-300"><strong>Missão:</strong> Artemis VII</p>
        </div>
        <div className="bg-panel p-6 rounded-xl border border-gray-800">
          <h2 className="text-xl text-accent mb-4">Histórico Médico Base</h2>
          <p className="text-gray-300 mb-2"><strong>FC Máxima:</strong> 90 bpm</p>
          <p className="text-gray-300 mb-2"><strong>SpO2 Mínimo:</strong> 95%</p>
          <p className="text-gray-300"><strong>Check-up:</strong> Há 30 dias</p>
        </div>
      </div>
    </div>
  );
}