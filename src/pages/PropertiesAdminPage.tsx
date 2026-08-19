import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PROPERTIES_API } from '../lib/runtimeConfig';

type PropertyRecord = { id: string; name: string; location: string | null; status: string; lotCount: number; availableLotCount: number; minAvailablePrice: number | null };
type LotRecord = { id: string; propertyId: string; lotCode: string; status: string; totalPrice: number | null; currency: string };
type FeatureRecord = { id: string; featureKey: string; label: string; featureValue: string | null; sortOrder: number };
type ImageRecord = { id: string; storageKey: string; contentType: string | null; altText: string | null; isCover: boolean; sortOrder: number };
type ListingRecord = {
  id: string; title: string; description: string | null; propertyType: string | null; operation: string | null;
  locationKey: string | null; location: string | null; priceMode: string | null; price: number | null; currency: string | null;
  priceDisplay: string | null; badge: string | null; displayOrder: number; publicationStatus: 'draft' | 'published' | 'unpublished';
  features: FeatureRecord[]; images: ImageRecord[];
};
type Props = { token: string };
type ListingForm = { title: string; description: string; propertyType: string; operation: string; location: string; locationKey: string; priceMode: string; price: string; currency: string; priceDisplay: string; badge: string; displayOrder: string };

const emptyListing: ListingForm = { title: '', description: '', propertyType: 'terreno', operation: 'venta', location: '', locationKey: '', priceMode: 'amount', price: '', currency: 'MXN', priceDisplay: '', badge: '', displayOrder: '0' };
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'propiedad';
const money = (value: number | null, currency = 'MXN') => value === null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

export default function PropertiesAdminPage({ token }: Props) {
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [listing, setListing] = useState<ListingRecord | null>(null);
  const [lots, setLots] = useState<LotRecord[]>([]);
  const [general, setGeneral] = useState({ name: '', location: '', status: 'active' });
  const [draft, setDraft] = useState<ListingForm>(emptyListing);
  const [newProperty, setNewProperty] = useState({ name: '', location: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [newFeature, setNewFeature] = useState({ label: '', value: '' });
  const [featureDrafts, setFeatureDrafts] = useState<Record<string, { label: string; value: string }>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploadStatus, setUploadStatus] = useState('');
  const [lotDraft, setLotDraft] = useState({ code: '', price: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const ownerFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    headers.set('X-ADEIN-Owner-Authorization', `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
    return fetch(input, { ...init, headers });
  }, [token]);

  const expectJson = async (response: Response, fallback: string) => {
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || fallback);
    return payload;
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible completar la acción.'); }
    finally { setBusy(false); }
  };

  const loadProperties = useCallback(async () => {
    const payload = await expectJson(await ownerFetch(PROPERTIES_API), 'No fue posible cargar propiedades.');
    const next = Array.isArray(payload.properties) ? payload.properties as PropertyRecord[] : [];
    setProperties(next); setSelectedId((current) => current || next[0]?.id || '');
  }, [ownerFetch]);
  const applyListing = useCallback((next: ListingRecord | null) => {
    setListing(next);
    setDraft(next ? { title: next.title || '', description: next.description || '', propertyType: next.propertyType || 'terreno', operation: next.operation || 'venta', location: next.location || '', locationKey: next.locationKey || '', priceMode: next.priceMode || 'amount', price: next.price === null ? '' : String(next.price), currency: next.currency || 'MXN', priceDisplay: next.priceDisplay || '', badge: next.badge || '', displayOrder: String(next.displayOrder ?? 0) } : { ...emptyListing });
    setFeatureDrafts(Object.fromEntries((next?.features || []).map((feature) => [feature.id, { label: feature.label, value: feature.featureValue || '' }])));
  }, []);
  const loadSelected = useCallback(async (propertyId: string) => {
    if (!propertyId) return;
    const [listingResponse, lotsResponse] = await Promise.all([ownerFetch(`${PROPERTIES_API}/${propertyId}/listing`), ownerFetch(`${PROPERTIES_API}/${propertyId}/lots`)]);
    const listingPayload = await expectJson(listingResponse, 'No fue posible cargar la ficha.');
    const lotsPayload = await expectJson(lotsResponse, 'No fue posible cargar los lotes.');
    applyListing(listingPayload.listing || null); setLots(Array.isArray(lotsPayload.lots) ? lotsPayload.lots : []);
  }, [applyListing, ownerFetch]);

  useEffect(() => { void loadProperties().catch((error) => setMessage(error.message)); }, [loadProperties]);
  useEffect(() => {
    const selected = properties.find((property) => property.id === selectedId);
    if (selected) setGeneral({ name: selected.name, location: selected.location || '', status: selected.status });
    void loadSelected(selectedId).catch((error) => setMessage(error.message));
  }, [selectedId, properties, loadSelected]);
  useEffect(() => {
    let active = true; const urls: string[] = [];
    void Promise.all((listing?.images || []).map(async (image) => {
      const response = await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/images/${image.id}/content`);
      if (!response.ok) return;
      const url = URL.createObjectURL(await response.blob()); urls.push(url);
      if (active) setPreviews((current) => ({ ...current, [image.id]: url }));
    }));
    return () => { active = false; urls.forEach(URL.revokeObjectURL); setPreviews({}); };
  }, [listing?.images, ownerFetch, selectedId]);

  const selected = properties.find((property) => property.id === selectedId) || null;
  const statusLabel = listing?.publicationStatus === 'published' ? 'PUBLICADO' : listing?.publicationStatus === 'unpublished' ? 'NO PUBLICADO' : 'BORRADOR';
  const listingBody = useMemo(() => ({ title: draft.title.trim(), description: draft.description.trim() || null, propertyType: draft.propertyType, operation: draft.operation, location: draft.location.trim() || null, locationKey: draft.locationKey || slugify(draft.location), priceMode: draft.priceMode, price: draft.price === '' ? null : Number(draft.price), currency: draft.currency, priceDisplay: draft.priceDisplay.trim() || null, badge: draft.badge.trim() || null, displayOrder: Number(draft.displayOrder || 0) }), [draft]);

  const createProperty = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    const payload = await expectJson(await ownerFetch(PROPERTIES_API, { method: 'POST', body: JSON.stringify({ name: newProperty.name, location: newProperty.location || null }) }), 'No fue posible crear la propiedad.');
    setNewProperty({ name: '', location: '' }); setShowCreate(false); await loadProperties(); setSelectedId(String(payload.property.id)); setMessage('Propiedad creada. Completa ahora su ficha pública.');
  }); };
  const saveGeneral = () => void run(async () => {
    await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}`, { method: 'PATCH', body: JSON.stringify(general) }), 'No fue posible guardar los datos generales.'); await loadProperties(); setMessage('Datos generales guardados.');
  });
  const saveListing = (publicationStatus?: ListingRecord['publicationStatus']) => void run(async () => {
    if (!draft.title.trim()) throw new Error('Escribe el título público antes de guardar.');
    if (!listing) await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing`, { method: 'POST', body: JSON.stringify({ title: listingBody.title, description: listingBody.description, slug: `${slugify(draft.title)}-${selectedId}` }) }), 'No fue posible crear la ficha.');
    const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing`, { method: 'PATCH', body: JSON.stringify({ ...listingBody, ...(publicationStatus ? { publicationStatus } : {}) }) }), 'No fue posible guardar la ficha.');
    applyListing(payload.listing); setMessage(publicationStatus === 'published' ? 'Propiedad publicada.' : publicationStatus === 'unpublished' ? 'Propiedad despublicada.' : 'Cambios guardados.');
  });

  const addFeature = () => void run(async () => {
    if (!listing) { await saveListing(); return; }
    const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/features`, { method: 'POST', body: JSON.stringify({ featureKey: `feature-${Date.now()}`, label: newFeature.label, featureValue: newFeature.value || null }) }), 'No fue posible agregar la característica.');
    setNewFeature({ label: '', value: '' }); applyListing(payload.listing); setMessage('Característica agregada.');
  });
  const updateFeature = (featureId: string) => void run(async () => {
    const values = featureDrafts[featureId]; const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/features/${featureId}`, { method: 'PATCH', body: JSON.stringify({ label: values.label, featureValue: values.value || null }) }), 'No fue posible editar la característica.'); applyListing(payload.listing); setMessage('Característica actualizada.');
  });
  const deleteFeature = (featureId: string) => void run(async () => { const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/features/${featureId}`, { method: 'DELETE' }), 'No fue posible eliminar la característica.'); applyListing(payload.listing); setMessage('Característica eliminada.'); });
  const moveFeature = (index: number, direction: -1 | 1) => void run(async () => {
    if (!listing) return; const ids = listing.features.map((feature) => feature.id); const target = index + direction; if (target < 0 || target >= ids.length) return; [ids[index], ids[target]] = [ids[target], ids[index]];
    const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/features/${ids[0]}/order`, { method: 'PATCH', body: JSON.stringify({ featureIds: ids }) }), 'No fue posible reordenar.'); applyListing(payload.listing);
  });

  const uploadImages = (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files || []); event.target.value = ''; if (!files.length || !listing) return; void run(async () => {
    let next = listing; for (const [index, file] of files.entries()) { setUploadStatus(`Subiendo ${index + 1} de ${files.length}…`); const form = new FormData(); form.set('image', file); form.set('altText', draft.title || selected?.name || 'Fotografía de propiedad'); const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/images/upload`, { method: 'POST', body: form }), `No fue posible subir ${file.name}.`); next = payload.listing; }
    applyListing(next); setUploadStatus('Fotografías listas.'); setMessage(`${files.length} fotografía${files.length === 1 ? '' : 's'} subida${files.length === 1 ? '' : 's'}.`);
  }); };
  const setCover = (imageId: string) => void run(async () => { const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/images/${imageId}/cover`, { method: 'PATCH', body: '{}' }), 'No fue posible cambiar la portada.'); applyListing(payload.listing); });
  const deleteImage = (imageId: string) => void run(async () => { const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/images/${imageId}`, { method: 'DELETE' }), 'No fue posible eliminar la fotografía.'); applyListing(payload.listing || { ...listing!, images: listing!.images.filter((image) => image.id !== imageId) }); setMessage('Fotografía eliminada.'); });
  const moveImage = (index: number, direction: -1 | 1) => void run(async () => { if (!listing) return; const ids = listing.images.map((image) => image.id); const target = index + direction; if (target < 0 || target >= ids.length) return; [ids[index], ids[target]] = [ids[target], ids[index]]; const payload = await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/listing/images/${ids[0]}/order`, { method: 'PATCH', body: JSON.stringify({ imageIds: ids }) }), 'No fue posible reordenar fotografías.'); applyListing(payload.listing); });

  const createLot = (event: FormEvent) => { event.preventDefault(); void run(async () => { await expectJson(await ownerFetch(`${PROPERTIES_API}/${selectedId}/lots`, { method: 'POST', body: JSON.stringify({ lotCode: lotDraft.code, totalPrice: lotDraft.price === '' ? null : Number(lotDraft.price), currency: 'MXN' }) }), 'No fue posible agregar el lote.'); setLotDraft({ code: '', price: '' }); await Promise.all([loadSelected(selectedId), loadProperties()]); }); };

  return <div className="properties-page properties-admin-v2">
    <section className="properties-toolbar-card"><div><span className="properties-eyebrow">Inventario inmobiliario</span><h2>Propiedades</h2><p>Administra cada ficha, sus fotografías y su publicación desde un solo lugar.</p></div><div className="properties-kpis"><div><strong>{properties.length}</strong><span>Propiedades</span></div><div><strong>{properties.filter((item) => item.status === 'active').length}</strong><span>Activas</span></div><button type="button" className="properties-primary-action" onClick={() => setShowCreate((value) => !value)}>+ Nueva propiedad</button></div></section>
    {message && <div className="properties-message" role="status">{message}</div>}
    {showCreate && <section className="properties-card new-property-panel"><div><span className="properties-eyebrow">Nueva propiedad</span><h3>Comienza con los datos internos</h3></div><form className="properties-form" onSubmit={createProperty}><label>Nombre interno<input required maxLength={180} value={newProperty.name} onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })} placeholder="Ej. Terreno La Zapata" /></label><label>Ubicación interna<input maxLength={220} value={newProperty.location} onChange={(e) => setNewProperty({ ...newProperty, location: e.target.value })} placeholder="Zona, municipio o referencia" /></label><button disabled={busy}>Crear propiedad</button></form></section>}
    <div className="properties-admin-layout">
      <aside className="properties-card properties-selector"><div className="properties-card-heading"><div><span className="properties-eyebrow">Inventario</span><h3>Selecciona una propiedad</h3></div></div><div className="properties-list">{properties.map((property) => <button type="button" key={property.id} className={`property-row ${selectedId === property.id ? 'selected' : ''}`} onClick={() => setSelectedId(property.id)}><div><strong>{property.name}</strong><span>{property.location || 'Ubicación por definir'}</span></div><div className="property-row-meta"><span className={`inventory-status status-${property.status}`}>{property.status === 'active' ? 'Activa' : 'Inactiva'}</span><small>{property.lotCount} lotes</small></div></button>)}{!properties.length && <div className="properties-empty">Aún no hay propiedades.</div>}</div></aside>
      <main className="property-editor">{selected ? <>
        <header className="properties-card property-editor-header"><div><span className="properties-eyebrow">Editando propiedad</span><h3>{selected.name}</h3><p>{selected.location || 'Ubicación interna por definir'} · {money(selected.minAvailablePrice)}</p></div><span className={`inventory-status status-${listing?.publicationStatus || 'draft'}`}>{statusLabel}</span></header>
        <section className="properties-card editor-section"><div className="editor-section-title"><span>1</span><div><h4>Datos generales</h4><p>Información interna para organizar el inventario.</p></div></div><div className="editor-grid three"><label>Nombre interno<input value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} /></label><label>Ubicación interna<input value={general.location} onChange={(e) => setGeneral({ ...general, location: e.target.value })} /></label><label>Disponibilidad<select value={general.status} onChange={(e) => setGeneral({ ...general, status: e.target.value })}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label></div><div className="section-actions"><button type="button" onClick={saveGeneral} disabled={busy}>Guardar datos generales</button></div></section>
        <section className="properties-card editor-section"><div className="editor-section-title"><span>2</span><div><h4>Información pública</h4><p>Lo que verá una persona en el catálogo.</p></div></div><div className="editor-grid two"><label className="wide">Título público<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Título claro y comercial" /></label><label>Tipo de propiedad<select value={draft.propertyType} onChange={(e) => setDraft({ ...draft, propertyType: e.target.value })}><option value="terreno">Terreno</option><option value="finca">Finca</option></select></label><label>Ubicación pública<input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value, locationKey: slugify(e.target.value) })} placeholder="Ej. La Zapata, Chalco" /></label><label>Clave de ubicación<input value={draft.locationKey} onChange={(e) => setDraft({ ...draft, locationKey: slugify(e.target.value) })} placeholder="la-zapata-chalco" /><small>Se genera automáticamente y puedes ajustarla.</small></label><label className="wide">Descripción<textarea rows={5} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Describe ubicación, dimensiones y ventajas reales." /></label><label>Badge o promoción<input value={draft.badge} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} placeholder="Ej. Negociable" /></label><label>Orden de aparición<input type="number" min="0" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: e.target.value })} /></label></div></section>
        <section className="properties-card editor-section"><div className="editor-section-title"><span>3</span><div><h4>Precio y operación</h4><p>Condiciones comerciales principales.</p></div></div><div className="editor-grid three"><label>Operación<select value={draft.operation} onChange={(e) => setDraft({ ...draft, operation: e.target.value })}><option value="venta">Venta</option><option value="renta">Renta</option></select></label><label>Forma de mostrar precio<select value={draft.priceMode} onChange={(e) => setDraft({ ...draft, priceMode: e.target.value })}><option value="amount">Precio fijo</option><option value="from">Desde</option><option value="consult">Consultar</option></select></label><label>Precio<input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="1750000" /></label><label>Moneda<select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}><option value="MXN">MXN</option><option value="USD">USD</option></select></label><label className="wide">Texto público opcional<input value={draft.priceDisplay} onChange={(e) => setDraft({ ...draft, priceDisplay: e.target.value })} placeholder="$1,750,000 MXN · Negociable" /></label></div></section>
        <section className="properties-card editor-section"><div className="editor-section-title"><span>4</span><div><h4>Características</h4><p>Datos destacados; los lotes se administran aparte.</p></div></div>{listing ? <div className="feature-editor-list">{listing.features.map((feature, index) => <div className="feature-editor-row" key={feature.id}><div className="feature-order-controls"><button disabled={busy || index === 0} onClick={() => moveFeature(index, -1)} aria-label="Subir característica">↑</button><button disabled={busy || index === listing.features.length - 1} onClick={() => moveFeature(index, 1)} aria-label="Bajar característica">↓</button></div><input value={featureDrafts[feature.id]?.label || ''} onChange={(e) => setFeatureDrafts({ ...featureDrafts, [feature.id]: { ...featureDrafts[feature.id], label: e.target.value } })} aria-label="Característica" /><input value={featureDrafts[feature.id]?.value || ''} onChange={(e) => setFeatureDrafts({ ...featureDrafts, [feature.id]: { ...featureDrafts[feature.id], value: e.target.value } })} aria-label="Valor" /><button className="text-action" onClick={() => updateFeature(feature.id)}>Guardar</button><button className="danger-action" onClick={() => deleteFeature(feature.id)}>Eliminar</button></div>)}{!listing.features.length && <div className="properties-empty">Aún no hay características.</div>}<div className="feature-add-row"><input value={newFeature.label} onChange={(e) => setNewFeature({ ...newFeature, label: e.target.value })} placeholder="Ej. Superficie" /><input value={newFeature.value} onChange={(e) => setNewFeature({ ...newFeature, value: e.target.value })} placeholder="Ej. 350 m²" /><button disabled={busy || !newFeature.label.trim()} onClick={addFeature}>Agregar característica</button></div></div> : <div className="properties-empty">Guarda primero la información pública para agregar características.</div>}</section>
        <section className="properties-card editor-section photos-section"><div className="editor-section-title"><span>5</span><div><h4>Fotografías</h4><p>Sube imágenes listas para web. La primera será portada automáticamente.</p></div></div>{listing ? <><label className="photo-upload"><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={uploadImages} disabled={busy} /><strong>Subir fotografías</strong><span>JPEG, JPG, PNG o WEBP · máximo 5 MB por archivo</span></label>{uploadStatus && <p className="upload-status">{uploadStatus}</p>}<div className="photo-grid">{listing.images.map((image, index) => <article className={`photo-card ${image.isCover ? 'cover' : ''}`} key={image.id}>{previews[image.id] ? <img src={previews[image.id]} alt={image.altText || 'Fotografía de propiedad'} /> : <div className="photo-loading">Cargando vista previa…</div>}{image.isCover && <span className="cover-badge">Portada</span>}<div className="photo-card-actions"><button disabled={busy || index === 0} onClick={() => moveImage(index, -1)} aria-label="Mover foto a la izquierda">←</button><button disabled={busy || index === listing.images.length - 1} onClick={() => moveImage(index, 1)} aria-label="Mover foto a la derecha">→</button>{!image.isCover && <button onClick={() => setCover(image.id)}>Usar como portada</button>}<button className="danger-action" onClick={() => deleteImage(image.id)}>Eliminar</button></div></article>)}{!listing.images.length && <div className="properties-empty photo-empty">Aún no hay fotografías.</div>}</div></> : <div className="properties-empty">Guarda primero la ficha pública para subir fotografías.</div>}</section>
        <section className="properties-card editor-section publication-section"><div className="editor-section-title"><span>6</span><div><h4>Publicación</h4><p>Revisa la ficha y decide cuándo debe aparecer en el catálogo.</p></div></div>{general.status === 'inactive' && <div className="publication-warning">Esta propiedad está inactiva. Aunque la ficha figure como publicada, no será visible públicamente.</div>}<div className="publication-footer"><div><span className={`inventory-status status-${listing?.publicationStatus || 'draft'}`}>{statusLabel}</span><p>{listing ? `${listing.images.length} fotografías · ${listing.features.length} características` : 'La ficha pública todavía no se ha creado.'}</p></div><div className="publication-actions"><button type="button" className="properties-primary-action" onClick={() => saveListing()} disabled={busy || !draft.title.trim()}>{listing ? "Guardar cambios" : "Crear ficha pública"}</button>{listing?.publicationStatus === 'published' ? <button type="button" className="properties-secondary-action" onClick={() => saveListing('unpublished')} disabled={busy}>Despublicar</button> : <button type="button" onClick={() => saveListing('published')} disabled={busy || !draft.title.trim()}>Publicar</button>}</div></div></section>
        <details className="properties-card property-lots"><summary>Inventario de lotes <span>{lots.length} registrados · función secundaria</span></summary><form className="properties-form lot-form" onSubmit={createLot}><input required value={lotDraft.code} onChange={(e) => setLotDraft({ ...lotDraft, code: e.target.value })} placeholder="Clave del lote" /><input type="number" min="0" value={lotDraft.price} onChange={(e) => setLotDraft({ ...lotDraft, price: e.target.value })} placeholder="Precio" /><button disabled={busy}>Agregar lote</button></form><div className="lots-table">{lots.map((lot) => <div className="lots-table-row" key={lot.id}><strong>{lot.lotCode}</strong><span>{money(lot.totalPrice, lot.currency)}</span><span className={`inventory-status status-${lot.status}`}>{lot.status}</span><span>Inventario</span></div>)}</div></details>
      </> : <section className="properties-card properties-empty">Selecciona una propiedad o crea una nueva para comenzar.</section>}</main>
    </div>
  </div>;
}
