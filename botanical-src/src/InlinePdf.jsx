import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import pdfPages from './content/pdf-pages.json';
import { useLanguage } from './i18n.jsx';
import './inline-pdf.css';

let enginePromise;
function prepareEngine(){
  if(!enginePromise)enginePromise=import('pdfjs-dist').then(async pdfjs=>{
    pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
    const worker=new pdfjs.PDFWorker({name:'portfolio-reader'});
    await worker.promise;
    return {pdfjs,worker};
  }).catch(error=>{enginePromise=null;throw error;});
  return enginePromise;
}

function PdfSheet({frame,number,title}) {
  const {t}=useLanguage();
  const canvas=useRef(null);
  useLayoutEffect(()=>{
    if(!frame||!canvas.current)return;
    const target=canvas.current;target.width=frame.width;target.height=frame.height;
    target.getContext('2d',{alpha:false}).drawImage(frame,0,0);
  },[frame]);
  return <div className="inline-pdf-sheet" data-page={number}>
    {frame?<canvas ref={canvas} role="img" aria-label={t(`${title}, page ${number}`,`${title}，第 ${number} 页`)} />:<span className="inline-pdf-page-loading" role="status">{t(`Preparing page ${number}…`,`正在准备第 ${number} 页…`)}</span>}
    <span className="inline-pdf-sheet-shade" aria-hidden="true" />
  </div>;
}

/** At most the current PDF page and its two neighbours are rendered/cached. */
export function InlinePdf({src,cover,title,direction='horizontal'}) {
  const {t}=useLanguage();
  const vertical=direction==='vertical';
  const [opened,setOpened]=useState(false),[pdf,setPdf]=useState(null),[page,setPage]=useState(1);
  const [version,setVersion]=useState(0),[width,setWidth]=useState(0),[error,setError]=useState('');
  const [retry,setRetry]=useState(0),[expanded,setExpanded]=useState(false),[progress,setProgress]=useState(null);
  const viewport=useRef(null),readerRef=useRef(null),cache=useRef(new Map()),pending=useRef(new Map());
  const allowed=useRef(new Set([1,2])),generation=useRef(0),alive=useRef(true);
  const animation=useRef(null),turning=useRef(false),navigation=useRef(0),tasks=useRef(new Set());
  const latest=useRef({page,pdf,width});latest.current={page,pdf,width};
  const reduced=useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pages=pdf?[page-1,page,page+1].filter(number=>number>0&&number<=pdf.numPages):[1];
  allowed.current=new Set(pages);

  useEffect(()=>{
    alive.current=true;
    return()=>{alive.current=false;navigation.current++;turning.current=false;if(animation.current)cancelAnimationFrame(animation.current);};
  },[]);

  // Warm only the reader engine while the cover is visible. PDF bytes remain
  // on demand; visiting one project never downloads the complete portfolio.
  useEffect(()=>{
    const timer=setTimeout(()=>prepareEngine().catch(()=>{}),180);
    return()=>clearTimeout(timer);
  },[]);

  useEffect(()=>{
    if(!opened)return;
    let cancelled=false,task;
    setError('');setProgress(null);setPdf(null);setPage(1);cache.current.clear();pending.current.clear();generation.current++;
    (async()=>{
      const {pdfjs,worker}=await prepareEngine();
      if(cancelled)return;
      const pageUrls=pdfPages[src]?.pages;
      if(pageUrls?.length){setPdf({numPages:pageUrls.length,pageUrls,pdfjs,worker});return;}
      task=pdfjs.getDocument({url:src,worker,disableAutoFetch:true,disableStream:true,rangeChunkSize:1048576,useSystemFonts:true});
      task.onProgress=({loaded,total})=>{if(!cancelled&&total)setProgress(Math.min(100,Math.round(loaded/total*100)));};
      const document=await task.promise;
      if(!cancelled)setPdf(document);
    })().catch(cause=>{if(!cancelled){console.error('PDF loading failed',cause);setError('The portfolio could not load. Please try again.');}});
    return()=>{cancelled=true;generation.current++;task?.destroy().catch(()=>{});for(const pendingTask of tasks.current)pendingTask.destroy().catch(()=>{});tasks.current.clear();};
  },[opened,src,retry]);

  useLayoutEffect(()=>{
    if(!opened||!viewport.current)return;
    const element=viewport.current;
    const measure=()=>setWidth(Math.round(element.clientWidth));
    measure();
    const observer=new ResizeObserver(measure);observer.observe(element);
    return()=>observer.disconnect();
  },[opened,expanded]);

  const ensureFrame=useCallback(async number=>{
    const {pdf:document,width:cssWidth}=latest.current;
    if(!document||!cssWidth||number<1||number>document.numPages)return null;
    const pixelWidth=Math.min(2600,Math.round(cssWidth*Math.min(devicePixelRatio||1,2)));
    const key=`${pixelWidth}:${number}`;
    if(cache.current.has(key))return cache.current.get(key);
    if(pending.current.has(key))return pending.current.get(key);
    const token=generation.current;
    const work=(async()=>{
      let pageTask;
      try{
      // Each derived one-page PDF retains the original encoded image/font
      // streams. Fetching it avoids serial ranges through a 58 MB document.
      if(document.pageUrls){
        pageTask=document.pdfjs.getDocument({url:document.pageUrls[number-1],worker:document.worker,disableRange:true,useSystemFonts:true});
        tasks.current.add(pageTask);
      }
      const sourceDocument=pageTask?await pageTask.promise:document;
      const sourcePage=await sourceDocument.getPage(document.pageUrls?1:number);
      const base=sourcePage.getViewport({scale:1});
      const size=sourcePage.getViewport({scale:pixelWidth/base.width});
      const canvas=window.document.createElement('canvas');
      canvas.width=Math.ceil(size.width);canvas.height=Math.ceil(size.height);
      await sourcePage.render({canvas,canvasContext:canvas.getContext('2d',{alpha:false}),viewport:size}).promise;
      sourcePage.cleanup();
      const currentPixels=Math.min(2600,Math.round(latest.current.width*Math.min(devicePixelRatio||1,2)));
      if(!alive.current||token!==generation.current||currentPixels!==pixelWidth){canvas.width=0;canvas.height=0;return null;}
      if(allowed.current.has(number)){
        cache.current.set(key,canvas);
        for(const [entry,old] of cache.current){const [entryWidth,entryPage]=entry.split(':').map(Number);if(entryWidth!==pixelWidth||!allowed.current.has(entryPage)){cache.current.delete(entry);old.width=0;old.height=0;}}
        setVersion(value=>value+1);
      }
      return canvas;
      }finally{if(pageTask){tasks.current.delete(pageTask);await pageTask.destroy().catch(()=>{});}}
    })();
    pending.current.set(key,work);
    try{return await work;}finally{pending.current.delete(key);}
  },[]);

  useEffect(()=>{
    if(!pdf||!width)return;
    let cancelled=false;
    setError('');
    ensureFrame(page).then(()=>{
      if(cancelled)return;
      for(const neighbour of [page-1,page+1])if(neighbour>0&&neighbour<=pdf.numPages)ensureFrame(neighbour).catch(()=>{});
    }).catch(cause=>{if(!cancelled){console.error('PDF rendering failed',cause);setError('This page could not render. Try loading the portfolio again.');}});
    return()=>{cancelled=true;};
  },[pdf,page,width,ensureFrame]);

  const extent=()=>vertical?viewport.current?.clientHeight:viewport.current?.clientWidth;
  const offset=()=>vertical?viewport.current?.scrollTop:viewport.current?.scrollLeft;
  const scroll=value=>{if(viewport.current){if(vertical)viewport.current.scrollTop=value;else viewport.current.scrollLeft=value;}};
  const currentSlot=pages.indexOf(page);

  useLayoutEffect(()=>{
    navigation.current++;
    if(animation.current)cancelAnimationFrame(animation.current);
    animation.current=null;turning.current=false;
    viewport.current?.classList.remove('is-turning');
    if(!opened||!pdf||!viewport.current)return;
    scroll(currentSlot*extent());
  },[opened,pdf,page,width,expanded]);

  const turnTo=async target=>{
    const {pdf:document,page:current}=latest.current;
    if(!document||target===current||target<1||target>document.numPages||turning.current)return;
    const nearby=[current-1,current,current+1].filter(value=>value>0&&value<=document.numPages);
    const index=nearby.indexOf(target);if(index<0)return;
    turning.current=true;
    const token=++navigation.current;
    try{await ensureFrame(target);}catch{if(token===navigation.current){turning.current=false;setError('This page could not render. Try loading the portfolio again.');}return;}
    if(token!==navigation.current||!alive.current||!viewport.current)return;
    const from=offset(),to=index*extent();
    const finish=()=>{animation.current=null;turning.current=false;viewport.current?.classList.remove('is-turning');setPage(target);};
    if(reduced.current){scroll(to);finish();return;}
    const start=performance.now();
    viewport.current.classList.add('is-turning');
    const tick=now=>{if(token!==navigation.current||!alive.current)return;const p=Math.min(1,(now-start)/420),ease=1-Math.pow(1-p,3);scroll(from+(to-from)*ease);if(p<1)animation.current=requestAnimationFrame(tick);else finish();};
    animation.current=requestAnimationFrame(tick);
  };

  const onScroll=()=>{
    if(!viewport.current)return;
    const size=extent(),position=offset();
    viewport.current.querySelectorAll('.inline-pdf-sheet').forEach((sheet,index)=>{
      const distance=Math.max(-1,Math.min(1,(index*size-position)/size));
      sheet.style.setProperty('--page-distance',Math.abs(distance));
      sheet.style.setProperty('--page-tilt',`${distance*(vertical?-3:5)}deg`);
    });
  };
  const onKeyDown=event=>{
    if(event.key==='Escape'&&expanded){event.preventDefault();setExpanded(false);return;}
    if(event.key===(vertical?'ArrowDown':'ArrowRight')){event.preventDefault();turnTo(page+1);}
    if(event.key===(vertical?'ArrowUp':'ArrowLeft')){event.preventDefault();turnTo(page-1);}
    if(event.key==='Tab'&&expanded){const targets=readerRef.current?.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]');if(!targets?.length)return;const first=targets[0],last=targets[targets.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  };

  const wasExpanded=useRef(false);
  useEffect(()=>{if(expanded)readerRef.current?.focus();else if(wasExpanded.current)readerRef.current?.querySelector('[data-expand-portfolio]')?.focus({preventScroll:true});wasExpanded.current=expanded;},[expanded]);
  useEffect(()=>{if(pdf&&opened&&!expanded)viewport.current?.focus({preventScroll:true});},[pdf,opened]);
  const pixelWidth=Math.min(2600,Math.round(width*Math.min(devicePixelRatio||1,2)));
  const reader=<section ref={readerRef} className={`inline-pdf inline-pdf--${direction} ${expanded?'is-expanded':''}`} role={expanded?'dialog':undefined} aria-modal={expanded||undefined} aria-label={t(`${title} portfolio reader`,`${title} 作品集阅读器`)} tabIndex={expanded?-1:undefined} onKeyDown={onKeyDown}>
    <div className="inline-pdf-actions">
      {opened&&<button type="button" onClick={()=>setExpanded(!expanded)} data-expand-portfolio aria-label={expanded?t('Return to side-by-side layout','返回并排布局'):t('Expand portfolio','展开作品集')}>{expanded?t('MINIMIZE −','收起 −'):t('EXPAND +','展开 +')}</button>}
      <a href={src} target="_blank" rel="noreferrer">{t('ORIGINAL PDF ↗','原始 PDF ↗')}</a>
    </div>
    {!opened?<button className="inline-pdf-cover" type="button" aria-label={t(`Read ${title} PDF`,`阅读 ${title} PDF`)} onPointerEnter={()=>prepareEngine().catch(()=>{})} onFocus={()=>prepareEngine().catch(()=>{})} onClick={()=>setOpened(true)}><img src={cover} alt={t(`${title} portfolio cover`,`${title} 作品集封面`)} draggable="false" /><span>{t('OPEN PORTFOLIO','打开作品集')} <b>+</b></span></button>:<>
      <div className="inline-pdf-window">
      <div ref={viewport} className="inline-pdf-stage" tabIndex={0} role="region" aria-label={t(`${title} PDF pages`,`${title} PDF 页面`)} onScroll={onScroll}>
        {pdf&&!error?pages.map(number=><PdfSheet key={number} number={number} title={title} frame={cache.current.get(`${pixelWidth}:${number}`)} version={version}/>):<div className="inline-pdf-status" role={error?'alert':'status'}>{error?<><p>{t(error,error.includes('could not load')?'作品集未能载入，请重试':'当前页未能显示，请重新载入作品集')}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{t('TRY AGAIN','重试')}</button></>:<>{t('Opening portfolio…','正在打开作品集…')}{progress!==null&&<small>{progress}%</small>}</>}</div>}
      </div>
      {pdf&&!error&&<div className="inline-pdf-hit-zones"><button className="inline-pdf-turn-zone is-previous" type="button" aria-label={t(`Click ${vertical?'upper':'left'} half for previous page of ${title}`,`点击${vertical?'上半':'左半'}区域查看 ${title} 上一页`)} title={vertical?t('Previous page · click upper half','上一页 · 点击上半区域'):t('Previous page · click left half','上一页 · 点击左半区域')} disabled={page===1} onClick={()=>turnTo(page-1)} /><button className="inline-pdf-turn-zone is-next" type="button" aria-label={t(`Click ${vertical?'lower':'right'} half for next page of ${title}`,`点击${vertical?'下半':'右半'}区域查看 ${title} 下一页`)} title={vertical?t('Next page · click lower half','下一页 · 点击下半区域'):t('Next page · click right half','下一页 · 点击右半区域')} disabled={page===pdf.numPages} onClick={()=>turnTo(page+1)} /></div>}
      </div>
      {pdf&&!error&&<div className="inline-pdf-controls"><button type="button" aria-label={t(`Previous page of ${title}`,`${title} 上一页`)} disabled={page===1} onClick={()=>turnTo(page-1)}>{vertical?'↑':'←'}</button><span aria-live="polite">{String(page).padStart(2,'0')} / {String(pdf.numPages).padStart(2,'0')}</span><button type="button" aria-label={t(`Next page of ${title}`,`${title} 下一页`)} disabled={page===pdf.numPages} onClick={()=>turnTo(page+1)}>{vertical?'↓':'→'}</button></div>}
    </>}
  </section>;
  return expanded?createPortal(reader,document.body):reader;
}
