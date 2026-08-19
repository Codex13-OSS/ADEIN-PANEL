import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PROPERTIES_API } from '../lib/runtimeConfig';

type PropertyRecord = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  lotCount: number;
  availableLotCount: number;
  minAvailablePrice: number | null;
};

type LotRecord = {
  id: string;
  propertyId: string;
  lotCode: string;
  status: string;
  totalPrice: number | null;
  currency: string;
};

type ListingRecord = {
  id: string;
  title: string;
  description: string | null;
  publicationStatus: 'draft' | 'published' | 'unpublished';
  features: { id: string; featureKey: string; label: string; featureValue: string | null }[];
  images: { id: string; storageKey: string; altText: string | null; isCover: boolean }[];
};

type Props = {
  token: string;
};

const money = (value: number | null, currency = 'MXN') => {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function PropertiesPage({ token }: Props) {
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [lots, setLots] = useState<LotRecord[]>([]);
  const [propertyName, setPropertyName] = useState('');
  const [propertyLocation, setPropertyLocation] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [lotPrice, setLotPrice] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState<ListingRecord | null>(null);
  const [listingTitle, setListingTitle] = useState('');
  const [listingDescription, setListingDescription] = useState('');
  const [listingFeatureLabel, setListingFeatureLabel] = useState('');
  const [listingFeatureValue, setListingFeatureValue] = useState('');
  const [listingImageStorageKey, setListingImageStorageKey] = useState('');
  const [listingImageAltText, setListingImageAltText] = useState('');

  const ownerFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    headers.set('X-ADEIN-Owner-Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    return fetch(input, { ...init, headers });
  }, [token]);

  const loadProperties = useCallback(async () => {
    const response = await ownerFetch(PROPERTIES_API);
    if (!response.ok) throw new Error('No fue posible cargar propiedades.');
    const payload = await response.json() as { ok?: boolean; properties?: PropertyRecord[] };
    const next = Array.isArray(payload.properties) ? payload.properties : [];
    setProperties(next);
    setSelectedPropertyId((current) => current || next[0]?.id || '');
  }, [ownerFetch]);

  const loadLots = useCallback(async (propertyId: string) => {
    if (!propertyId) {
      setLots([]);
      return;
    }
    const response = await ownerFetch(`${PROPERTIES_API}/${propertyId}/lots`);
    if (!response.ok) throw new Error('No fue posible cargar los lotes.');
    const payload = await response.json() as { ok?: boolean; lots?: LotRecord[] };
    setLots(Array.isArray(payload.lots) ? payload.lots : []);
  }, [ownerFetch]);

  const loadListing = useCallback(async (propertyId: string) => {
    if (!propertyId) { setListing(null); return; }
    const response = await ownerFetch(`${PROPERTIES_API}/${propertyId}/listing`);
    if (!response.ok) throw new Error('No fue posible cargar la publicación.');
    const payload = await response.json() as { listing?: ListingRecord | null };
    setListing(payload.listing || null);
    setListingTitle(payload.listing?.title || '');
    setListingDescription(payload.listing?.description || '');
  }, [ownerFetch]);

  useEffect(() => {
    void loadProperties().catch((error) => setMessage(error.message));
  }, [loadProperties]);

  useEffect(() => {
    void loadLots(selectedPropertyId).catch((error) => setMessage(error.message));
  }, [selectedPropertyId, loadLots]);

  useEffect(() => {
    void loadListing(selectedPropertyId).catch((error) => setMessage(error.message));
  }, [selectedPropertyId, loadListing]);

  const createProperty = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await ownerFetch(PROPERTIES_API, {
        method: 'POST',
        body: JSON.stringify({
          name: propertyName,
          location: propertyLocation || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible crear la propiedad.');
      setPropertyName('');
      setPropertyLocation('');
      await loadProperties();
      if (payload.property?.id) setSelectedPropertyId(String(payload.property.id));
      setMessage('Propiedad creada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al crear propiedad.');
    } finally {
      setBusy(false);
    }
  };

  const createLot = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPropertyId) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await ownerFetch(`${PROPERTIES_API}/${selectedPropertyId}/lots`, {
        method: 'POST',
        body: JSON.stringify({
          lotCode,
          totalPrice: lotPrice === '' ? null : Number(lotPrice),
          currency: 'MXN',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible crear el lote.');
      setLotCode('');
      setLotPrice('');
      await Promise.all([loadLots(selectedPropertyId), loadProperties()]);
      setMessage('Lote agregado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al crear lote.');
    } finally {
      setBusy(false);
    }
  };

  const setPropertyStatus = async (property: PropertyRecord, status: string) => {
    setBusy(true);
    setMessage('');
    try {
      const response = await ownerFetch(`${PROPERTIES_API}/${property.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible actualizar la propiedad.');
      await loadProperties();
      setMessage('Estado de propiedad actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al actualizar propiedad.');
    } finally {
      setBusy(false);
    }
  };

  const setLotStatus = async (lot: LotRecord, status: string) => {
    setBusy(true);
    setMessage('');
    try {
      const response = await ownerFetch(
        `${PROPERTIES_API}/${lot.propertyId}/lots/${lot.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible actualizar el lote.');
      await Promise.all([loadLots(lot.propertyId), loadProperties()]);
      setMessage('Estado del lote actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al actualizar lote.');
    } finally {
      setBusy(false);
    }
  };

  const saveListing = async (publicationStatus?: ListingRecord['publicationStatus']) => {
    if (!selectedPropertyId) return;
    setBusy(true); setMessage('');
    try {
      const response = await ownerFetch(`${PROPERTIES_API}/${selectedPropertyId}/listing`, {
        method: listing ? 'PATCH' : 'POST',
        body: JSON.stringify(listing ? { title: listingTitle, description: listingDescription, ...(publicationStatus ? { publicationStatus } : {}) } : { slug: `qa-${selectedPropertyId}-${Date.now()}`, title: listingTitle, description: listingDescription }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible guardar la publicación.');
      setListing(payload.listing); setMessage('Publicación actualizada.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Error de publicación.'); } finally { setBusy(false); }
  };

  const addListingResource = async (kind: 'features' | 'images') => {
    if (!selectedPropertyId || !listing) return;
    setBusy(true); setMessage('');
    try {
      const input = kind === 'features'
        ? { featureKey: `manual-${Date.now()}`, label: listingFeatureLabel, featureValue: listingFeatureValue || null }
        : { storageKey: listingImageStorageKey, altText: listingImageAltText || null };
      const response = await ownerFetch(`${PROPERTIES_API}/${selectedPropertyId}/listing/${kind}`, {
        method: 'POST', body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible agregar el recurso de publicación.');
      setListing(payload.listing);
      if (kind === 'features') { setListingFeatureLabel(''); setListingFeatureValue(''); }
      else { setListingImageStorageKey(''); setListingImageAltText(''); }
      setMessage(kind === 'features' ? 'Característica agregada.' : 'Referencia de imagen agregada.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Error de publicación.'); } finally { setBusy(false); }
  };
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) || null;
  const publicationStatus = listing?.publicationStatus || 'draft';
  const publicationLabel = publicationStatus === 'published'
    ? 'Publicada'
    : publicationStatus === 'unpublished'
      ? 'Despublicada'
      : 'Borrador';
  const publicationReadiness = [
    { label: 'Título público', complete: Boolean(listingTitle.trim()), required: true },
    { label: 'Descripción', complete: Boolean(listingDescription.trim()), required: false },
    { label: 'Fotografía', complete: Boolean(listing?.images.length), required: false },
  ];

  return (
    <div className="properties-page">
      <section className="properties-toolbar-card">
        <div>
          <span className="properties-eyebrow">Administración inmobiliaria</span>
          <h2>Propiedades</h2>
          <p>
            Guarda primero la propiedad, completa su ficha pública y publícala cuando esté lista.
          </p>
        </div>
        <div className="properties-kpis">
          <div><strong>{properties.length}</strong><span>Propiedades</span></div>
          <div>
            <strong>{properties.reduce((sum, property) => sum + property.lotCount, 0)}</strong>
            <span>Lotes</span>
          </div>
          <div>
            <strong>{properties.reduce((sum, property) => sum + property.availableLotCount, 0)}</strong>
            <span>Disponibles</span>
          </div>
        </div>
      </section>

      {message && <div className="properties-message">{message}</div>}

      <div className="properties-layout">
        <section className="properties-card">
          <div className="properties-card-heading">
            <div>
              <span className="properties-eyebrow">Paso 1</span>
              <h3>Datos principales</h3>
              <p>Crea y selecciona la propiedad que deseas administrar.</p>
            </div>
          </div>

          <form className="properties-form" onSubmit={createProperty}>
            <label>
              Nombre de la propiedad
              <input value={propertyName} onChange={(event) => setPropertyName(event.target.value)} placeholder="Ej. Residencial La Joaya" maxLength={180} required />
            </label>
            <label>
              Ubicación
              <input value={propertyLocation} onChange={(event) => setPropertyLocation(event.target.value)} placeholder="Ciudad, estado o zona" maxLength={220} />
            </label>
            <button type="submit" disabled={busy}>Guardar propiedad</button>
          </form>

          <div className="properties-list">
            {properties.length === 0 && (
              <div className="properties-empty">Aún no hay propiedades registradas.</div>
            )}

            {properties.map((property) => (
              <button
                type="button"
                key={property.id}
                className={`property-row ${selectedPropertyId === property.id ? 'selected' : ''}`}
                onClick={() => setSelectedPropertyId(property.id)}
              >
                <div>
                  <strong>{property.name}</strong>
                  <span>{property.location || 'Ubicación por definir'}</span>
                </div>
                <div className="property-row-meta">
                  <span className={`inventory-status status-${property.status}`}>
                    {property.status}
                  </span>
                  <small>{property.availableLotCount}/{property.lotCount} disponibles</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="properties-card">
          <div className="properties-card-heading">
            <div>
              <span className="properties-eyebrow">Propiedad seleccionada</span>
              <h3>{selectedProperty?.name || 'Selecciona una propiedad'}</h3>
              {selectedProperty && (
                <p>
                  Desde {money(selectedProperty.minAvailablePrice)} ·
                  {' '}{selectedProperty.availableLotCount} disponibles
                </p>
              )}
            </div>

            {selectedProperty && (
              <button
                type="button"
                className="properties-secondary-action"
                disabled={busy}
                onClick={() => setPropertyStatus(
                  selectedProperty,
                  selectedProperty.status === 'active' ? 'inactive' : 'active',
                )}
              >
                {selectedProperty.status === 'active' ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>

          {selectedProperty && <>
            <section className="property-workflow">
              <div className="publication-summary">
                <div>
                  <span className="properties-eyebrow">Paso 2 · Ficha pública</span>
                  <h4>Prepara la publicación</h4>
                  <p>Guardar la ficha conserva un borrador. Sólo una ficha publicada aparece en el sitio.</p>
                </div>
                <span className={`inventory-status status-${publicationStatus}`}>{publicationLabel}</span>
              </div>

              <div className="publication-readiness" aria-label="Estado de preparación de la publicación">
                {publicationReadiness.map((item) => <span key={item.label} className={item.complete ? 'complete' : ''}>
                  {item.complete ? '✓' : '○'} {item.label}{item.required ? ' · requerida' : ' · recomendada'}
                </span>)}
              </div>

              <div className="publication-fields">
                <label>Título que verá el público
                  <input value={listingTitle} onChange={(event) => setListingTitle(event.target.value)} placeholder="Título claro de la propiedad" maxLength={220} required />
                </label>
                <label>Descripción pública
                  <textarea value={listingDescription} onChange={(event) => setListingDescription(event.target.value)} placeholder="Ubicación, tipo de propiedad y los detalles principales." rows={4} />
                </label>
              </div>

              <div className="publication-actions">
                <button type="button" disabled={busy || !listingTitle.trim()} onClick={() => void saveListing()}>Guardar borrador</button>
                {listing && <button type="button" className="properties-secondary-action" disabled={busy || !listingTitle.trim()} onClick={() => void saveListing(listing.publicationStatus === 'published' ? 'unpublished' : 'published')}>
                  {listing.publicationStatus === 'published' ? 'Despublicar del sitio' : 'Publicar en el sitio'}
                </button>}
              </div>

              {listing && <div className="publication-resources">
                <div className="properties-listing-resources">
                  <strong>Características que verá el público</strong>
                  <p>{listing.features.length ? 'Se muestran en la tarjeta pública.' : 'Agrega los datos destacados de la propiedad.'}</p>
                  <div className="resource-tags">{listing.features.map((feature) => <span key={feature.id}>{feature.label}{feature.featureValue ? `: ${feature.featureValue}` : ''}</span>)}</div>
                  <div className="resource-form">
                    <input value={listingFeatureLabel} onChange={(event) => setListingFeatureLabel(event.target.value)} placeholder="Ej. Superficie" maxLength={160} />
                    <input value={listingFeatureValue} onChange={(event) => setListingFeatureValue(event.target.value)} placeholder="Ej. 120 m²" maxLength={220} />
                    <button type="button" disabled={busy || !listingFeatureLabel.trim()} onClick={() => void addListingResource('features')}>Agregar</button>
                  </div>
                </div>
                <div className="properties-listing-resources">
                  <strong>Fotografías</strong>
                  <p>{listing.images.length ? `${listing.images.length} imagen${listing.images.length === 1 ? '' : 'es'} lista${listing.images.length === 1 ? '' : 's'} para el catálogo.` : 'Aún no hay fotografías asociadas.'}</p>
                  <div className="resource-tags">{listing.images.map((image) => <span key={image.id}>{image.altText || 'Imagen de la propiedad'}</span>)}</div>
                  <div className="resource-form">
                    <input value={listingImageStorageKey} onChange={(event) => setListingImageStorageKey(event.target.value)} placeholder="URL o referencia de imagen" maxLength={500} />
                    <input value={listingImageAltText} onChange={(event) => setListingImageAltText(event.target.value)} placeholder="Descripción de la foto" maxLength={255} />
                    <button type="button" disabled={busy || !listingImageStorageKey.trim()} onClick={() => void addListingResource('images')}>Agregar</button>
                  </div>
                </div>
              </div>}
            </section>

            <details className="property-lots">
              <summary>Inventario de lotes <span>{lots.length} registrado{lots.length === 1 ? '' : 's'}</span></summary>
              <form className="properties-form lot-form" onSubmit={createLot}>
                <input value={lotCode} onChange={(event) => setLotCode(event.target.value)} placeholder="Clave de lote" maxLength={100} required />
                <input type="number" min="0" step="0.01" value={lotPrice} onChange={(event) => setLotPrice(event.target.value)} placeholder="Precio total" />
                <button type="submit" disabled={busy}>Agregar lote</button>
              </form>
              <div className="lots-table">
                <div className="lots-table-head"><span>Lote</span><span>Precio</span><span>Estado</span><span>Acción</span></div>
                {lots.length === 0 && <div className="properties-empty">Esta propiedad todavía no tiene lotes.</div>}
                {lots.map((lot) => <div className="lots-table-row" key={lot.id}>
                  <strong>{lot.lotCode}</strong><span>{money(lot.totalPrice, lot.currency)}</span><span className={`inventory-status status-${lot.status}`}>{lot.status}</span>
                  <select aria-label={`Estado del lote ${lot.lotCode}`} value={lot.status} disabled={busy} onChange={(event) => void setLotStatus(lot, event.target.value)}>
                    <option value="available">Disponible</option><option value="reserved">Apartado</option><option value="sold">Vendido</option><option value="blocked">Bloqueado</option>
                  </select>
                </div>)}
              </div>
            </details>
          </>}
        </section>
      </div>
    </div>
  );
}
