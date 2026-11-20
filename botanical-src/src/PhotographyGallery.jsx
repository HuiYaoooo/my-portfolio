import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import manifest from './content/photography.json';
import './photography.css';

const photoUrl = path => new URL(path, 'https://yaohui.me/').href;
const cities = Object.entries(manifest.cityCounts).map(([id, count]) => ({
  id, count, name: manifest.photos.find(photo => photo.city === id).cityEn,
}));

function PhotoLightbox({ photo, index, count, onMove, onClose }) {
  const dialog = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current;
    if (!element.open) element.showModal();
    return () => {
      opener?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { setLoading(true); setFailed(false); }, [photo.id]);
  return createPortal(<dialog className="photography-lightbox" ref={dialog}
    aria-labelledby="photography-lightbox-title" onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); onMove(event.key === 'ArrowLeft' ? -1 : 1);
      }
    }}>
    <header className="photography-lightbox-head">
      <h2 id="photography-lightbox-title">{photo.labelEn}</h2>
      <button type="button" onClick={() => dialog.current.close()} aria-label="Close photograph">CLOSE ×</button>
    </header>
    <figure className={`photography-lightbox-figure ${failed ? 'is-error' : ''}`}>
      {loading && <span className="photography-image-status" role="status">LOADING PHOTOGRAPH…</span>}
      <img key={photo.id} src={photoUrl(photo.large)} alt={photo.altEn}
        width={photo.width} height={photo.height} decoding="async"
        onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} />
      {failed && <p className="photography-image-status">Unable to load this photograph.<br /><a href={photoUrl(photo.large)} target="_blank" rel="noreferrer">Open photograph in a new tab</a></p>}
    </figure>
    <footer className="photography-lightbox-tools">
      <button type="button" onClick={() => onMove(-1)} aria-label="Previous photograph">← PREVIOUS</button>
      <span aria-live="polite">{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
      <button type="button" onClick={() => onMove(1)} aria-label="Next photograph">NEXT →</button>
    </footer>
  </dialog>, document.body);
}

export function PhotographyGallery() {
  const [city, setCity] = useState('all');
  const [selected, setSelected] = useState(null);
  const photos = useMemo(() => city === 'all' ? manifest.photos : manifest.photos.filter(photo => photo.city === city), [city]);
  return <div className="photography-gallery">
    <nav className="photography-city-filter" aria-label="Photography locations">
      <button type="button" aria-pressed={city === 'all'} onClick={() => { setCity('all'); setSelected(null); }}>All <span>{manifest.count}</span></button>
      {cities.map(item => <button type="button" key={item.id} aria-pressed={city === item.id}
        onClick={() => { setCity(item.id); setSelected(null); }}>{item.name} <span>{item.count}</span></button>)}
    </nav>
    <p className="photography-collection-count" aria-live="polite">{photos.length} photographs{city === 'all' ? ' / Five places' : ` / ${cities.find(item => item.id === city).name}`}</p>
    <div className="photography-grid">
      {photos.map((photo, index) => <button type="button" key={photo.id} className="photography-thumbnail"
        aria-label={`Open ${photo.labelEn}`} onClick={() => setSelected(index)}>
        <img src={photoUrl(photo.thumb)} alt={photo.altEn} width={photo.thumbWidth} height={photo.thumbHeight}
          loading="lazy" decoding="async" />
        <span className="photography-thumbnail-caption"><span>{photo.labelEn}</span><span aria-hidden="true">VIEW +</span></span>
      </button>)}
    </div>
    <p className="photography-collection-count">© Hui Yao · For personal viewing only</p>
    {selected !== null && <PhotoLightbox photo={photos[selected]} index={selected} count={photos.length}
      onMove={direction => setSelected(index => (index + direction + photos.length) % photos.length)}
      onClose={() => setSelected(null)} />}
  </div>;
}
