import SectionCard from '../components/SectionCard';

export default function SettingsPage() {
  return (
    <div className="page-grid">
      <SectionCard title="Configuración (mock)">
        <div className="analysis-grid">
          {[
            ['Empresa', 'Datos institucionales y lineamientos visuales.'],
            ['Usuarios', 'Gestión de perfiles comerciales y administrativos.'],
            ['Documental externo', 'Integración separada en /documentos.'],
            ['IA pendiente', 'Asistente de análisis comercial en fase mock.'],
            ['WhatsApp API futura', 'Canal operativo planeado en fases siguientes.'],
          ].map((item) => <article key={item[0]} className="analysis-item"><h4>{item[0]}</h4><p>{item[1]}</p></article>)}
        </div>
      </SectionCard>
    </div>
  );
}
