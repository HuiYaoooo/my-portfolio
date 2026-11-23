import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import manifest from './content/photography.json';
import { useLanguage } from './i18n.jsx';
import './photography.css';

const photoUrl = path => new URL(path, 'https://yaohui.me/').href;
const cities = Object.entries(manifest.cityCounts).map(([id, count]) => ({
  id, count, name: manifest.photos.find(photo => photo.city === id).cityEn, nameZh: manifest.photos.find(photo => photo.city === id).cityZh,
}));

function PhotoLightbox({ photo, index, count, onMove, onClose }) {
  const {t}=useLanguage();
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
      <h2 id="photography-lightbox-title">{t(photo.labelEn,photo.labelZh)}</h2>
      <button type="button" onClick={() => dialog.current.close()} aria-label={t("Close photograph","关闭照片")}>{t("CLOSE ×","关闭 ×")}</button>
    </header>
    <figure className={`photography-lightbox-figure ${failed ? 'is-error' : ''}`}>
      {loading && <span className="photography-image-status" role="status">{t("LOADING PHOTOGRAPH…","正在载入照片…")}</span>}
      <img key={photo.id} src={photoUrl(photo.large)} alt={t(photo.altEn,photo.altZh)}
        width={photo.width} height={photo.height} decoding="async"
        onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} />
      {failed && <p className="photography-image-status">{t("Unable to load this photograph.","暂时无法载入这张照片")}<br /><a href={photoUrl(photo.large)} target="_blank" rel="noreferrer">{t("Open photograph in a new tab","在新标签页打开照片")}</a></p>}
    </figure>
    <footer className="photography-lightbox-tools">
      <button type="button" onClick={() => onMove(-1)} aria-label={t("Previous photograph","上一张照片")}>{t("← PREVIOUS","← 上一张")}</button>
      <span aria-live="polite">{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
      <button type="button" onClick={() => onMove(1)} aria-label={t("Next photograph","下一张照片")}>{t("NEXT →","下一张 →")}</button>
    </footer>
  </dialog>, document.body);
}

export function PhotographyGallery() {
  const {t}=useLanguage();
  const [city, setCity] = useState('all');
  const [selected, setSelected] = useState(null);
  const photos = useMemo(() => city === 'all' ? manifest.photos : manifest.photos.filter(photo => photo.city === city), [city]);
  return <div className="photography-gallery">
    <nav className="photography-city-filter" aria-label={t("Photography locations","摄影地点")}>
      <button type="button" aria-pressed={city === 'all'} onClick={() => { setCity('all'); setSelected(null); }}>{t('All','全部')} <span>{manifest.count}</span></button>
      {cities.map(item => <button type="button" key={item.id} aria-pressed={city === item.id}
        onClick={() => { setCity(item.id); setSelected(null); }}>{t(item.name,item.nameZh)} <span>{item.count}</span></button>)}
    </nav>
    <p className="photography-collection-count" aria-live="polite">{t(`${photos.length} photographs`,`${photos.length} 张照片`)}{city === 'all' ? t(' / Five places',' / 五个地点') : ` / ${t(cities.find(item => item.id === city).name,cities.find(item => item.id === city).nameZh)}`}</p>
    <div className="photography-grid">
      {photos.map((photo, index) => <button type="button" key={photo.id} className="photography-thumbnail"
        aria-label={t(`Open ${photo.labelEn}`,`打开 ${photo.labelZh}`)} onClick={() => setSelected(index)}>
        <img src={photoUrl(photo.thumb)} alt={t(photo.altEn,photo.altZh)} width={photo.thumbWidth} height={photo.thumbHeight}
          loading="lazy" decoding="async" />
        <span className="photography-thumbnail-caption"><span>{t(photo.labelEn,photo.labelZh)}</span><span aria-hidden="true">{t("VIEW +","查看 +")}</span></span>
      </button>)}
    </div>
    <p className="photography-collection-count">{t("© Hui Yao · For personal viewing only","© 惠尧 · 仅供个人欣赏")}</p>
    {selected !== null && <PhotoLightbox photo={photos[selected]} index={selected} count={photos.length}
      onMove={direction => setSelected(index => (index + direction + photos.length) % photos.length)}
      onClose={() => setSelected(null)} />}
  </div>;
}
