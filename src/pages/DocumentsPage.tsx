import SectionCard from '../components/SectionCard';

const DOCUMENTS_URL = '/documentos';

export default function DocumentsPage() {
  return (
    <div className="page-grid">
      <SectionCard title="Sistema documental externo">
        <p>El sistema documental se mantiene separado para proteger contratos, pagarés, PDFs, QR, folios e impresión.</p>
        <button className="btn-primary" onClick={() => window.open(DOCUMENTS_URL, '_blank')}>Abrir sistema documental</button>
      </SectionCard>
    </div>
  );
}
