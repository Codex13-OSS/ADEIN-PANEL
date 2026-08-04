import { useEffect, useState } from 'react';
import { requestLiaLaunch } from '../lib/liaDocumentsClient.mjs';

export default function DocumentsPage() {
  const [launchUrl, setLaunchUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void requestLiaLaunch().then((url) => {
      if (active) setLaunchUrl(url);
    }).catch((requestError) => {
      if (active) setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar el generador documental local.');
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="documents-generator-panel">
      {launchUrl && <iframe className="documents-generator-frame" title="Generador de documentos LIA" src={launchUrl} />}
      {!launchUrl && !error && <p className="file-state" role="status">Cargando generador documental…</p>}
      {error && <p className="file-state error" role="alert">{error}</p>}
    </div>
  );
}
