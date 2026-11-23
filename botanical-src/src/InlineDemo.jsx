import { useEffect, useMemo, useRef, useState } from 'react';
import './inline-demo.css';
import { useLanguage } from './i18n.jsx';

const IPHONE = { width: 511, height: 968 };

// Both existing demos use the same phone-stage / phone-device shell. Override
// only that shell, keeping the bezel asset, screen geometry and app UI intact.
const transparentShell = `
  :root, html, body, #root, .phone-stage, .phone-scale-box, .phone-device {
    background: transparent !important;
    background-color: transparent !important;
  }
  html, body, #root { width:100% !important; height:100% !important; margin:0 !important; padding:0 !important; }
  html { color-scheme:dark !important; }
  .phone-device, .device-screen { color-scheme:light !important; }
  body { min-width:0 !important; overflow:hidden !important; }
  .phone-stage { padding:0 !important; min-height:0 !important; width:100% !important; height:100% !important; display:grid !important; place-items:center !important; }
  .device-menu-bar { display:none !important; }
  .phone-scale-box { width:var(--portfolio-device-width) !important; height:var(--portfolio-device-height) !important; }
  .phone-device { transform:scale(1) !important; transform-origin:0 0 !important; }
`;

function localDemoSource(src, kind) {
  const defaultPath = kind === 'mood' ? '/mood-demo/index.html' : '/hihi-demo/index.html';
  try {
    const url = new URL(src || defaultPath, window.location.href);
    // Keep access same-origin so the existing demo's exterior can be made
    // transparent in development (proxy) and on the deployed portfolio.
    if (/^\/(?:hihi-demo|mood-demo)(?:\/|$)/.test(url.pathname)) return url.pathname + url.search + url.hash;
    return url.href;
  } catch { return defaultPath; }
}

export function InlineDemo({ src, title = 'Interactive demo', kind = 'hihi' }) {
  const {t}=useLanguage();
  const container = useRef(null);
  const iframe = useRef(null);
  const frameCleanup = useRef(() => {});
  const [width, setWidth] = useState(0);
  const [device, setDevice] = useState(IPHONE);
  const [version, setVersion] = useState(0);
  const source = useMemo(() => localDemoSource(src, kind), [src, kind]);
  const frameKey = `${source}-${version}`;
  const currentFrameKey = useRef(frameKey);
  currentFrameKey.current = frameKey;
  const [loadState, setLoadState] = useState(() => ({ key: frameKey, status: 'loading' }));
  const status = loadState.key === frameKey ? loadState.status : 'loading';
  const setStatus = next => {
    if (currentFrameKey.current === frameKey) setLoadState({ key: frameKey, status: next });
  };

  useEffect(() => {
    const element = container.current;
    const measure = () => setWidth(element?.getBoundingClientRect().width || 0);
    measure();
    const observer = new ResizeObserver(measure);
    if (element) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // StrictMode replays effects while the iframe remains mounted. Cancelling
    // its pending observer at that point can strand an already loaded document.
    return () => { if (!iframe.current) frameCleanup.current(); };
  }, []);

  function prepareDemo() {
    frameCleanup.current();
    let doc;
    try { doc = iframe.current?.contentDocument; }
    catch { setStatus('external'); return; }
    if (!doc) { setStatus('external'); return; }

    const style = doc.createElement('style');
    style.dataset.portfolioDemoShell = 'true';
    style.textContent = transparentShell;
    doc.head.appendChild(style);
    let stopWatching = () => {};
    let timeout;

    const fitPhone = () => {
      const phone = doc.querySelector('.phone-device, [data-testid="phone-frame"]');
      if (!phone) return false;
      const nativeWidth = Number.parseFloat(phone.style.width) || phone.offsetWidth || IPHONE.width;
      const nativeHeight = Number.parseFloat(phone.style.height) || phone.offsetHeight || IPHONE.height;
      const next = { width: nativeWidth, height: nativeHeight };
      doc.documentElement.style.setProperty('--portfolio-device-width', `${nativeWidth}px`);
      doc.documentElement.style.setProperty('--portfolio-device-height', `${nativeHeight}px`);
      setDevice(previous => previous.width === next.width && previous.height === next.height ? previous : next);
      setStatus('ready');
      return true;
    };

    if (!fitPhone()) {
      const observer = new MutationObserver(() => {
        if (fitPhone()) { observer.disconnect(); clearTimeout(timeout); }
      });
      observer.observe(doc.documentElement, { childList: true, subtree: true });
      stopWatching = () => observer.disconnect();
      timeout = setTimeout(() => { observer.disconnect(); setStatus('unavailable'); }, 12000);
    }
    frameCleanup.current = () => { clearTimeout(timeout); stopWatching(); };
  }

  const scale = width ? width / device.width : 1;
  const retry = () => { setStatus('loading'); setVersion(value => value + 1); };
  const unavailable = status === 'external' || status === 'unavailable';

  return <section className={`inline-demo inline-demo--${kind}`} aria-label={title} data-ready={status === 'ready'}>
    <div className="inline-demo-viewport" ref={container} style={{ aspectRatio: `${device.width} / ${device.height}` }}>
      <iframe key={frameKey} ref={iframe} src={source} title={title}
        className={status === 'ready' ? 'is-ready' : ''}
        style={{ width: device.width, height: device.height, transform: `scale(${scale})` }}
        onLoad={prepareDemo} onError={() => setStatus('unavailable')}
        loading="eager" />
      {status === 'loading' && <p className="inline-demo-status" role="status">{t('Loading demo…','正在载入演示…')}</p>}
      {unavailable && <div className="inline-demo-status" role="status"><p>{t('Open the demo to continue.','打开完整演示以继续体验')}</p><a href={source} target="_blank" rel="noreferrer">{t('OPEN DEMO ↗','打开演示 ↗')}</a><button type="button" onClick={retry}>{t('TRY AGAIN','重试')}</button></div>}
    </div>
    <div className="inline-demo-tools"><button type="button" onClick={retry} aria-label={t(`Reset ${title}`,`重置 ${title}`)}>{t('RESET','重置')}</button><a href={source} target="_blank" rel="noreferrer">{t('OPEN DEMO ↗','打开演示 ↗')}</a></div>
  </section>;
}
