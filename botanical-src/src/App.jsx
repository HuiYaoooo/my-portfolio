import { useEffect, useRef, useState } from 'react';
import { createBotanicalScene } from './scene.js';
import { PortfolioPages } from './PortfolioPages.jsx';

const projects = [
  { title: 'Urban Wildlife', fullTitle:'Urban Wildlife Return Plan', category: 'PRODUCT · ECOLOGY', number: '01', cover: '/assets/wildlife.png', color: '#7399fd', route:'#project-wildlife', href:'/assets/project_urban_wildlife.pdf', pdf:'/assets/project_urban_wildlife.pdf', pdfDirection:'horizontal', demoKind:'urban', role:'Project Leader', summary:'A participatory design project exploring how people and wildlife can share Beijing’s urban spaces. Habitat installations, a community app, AR education and hands-on workshops connect wildlife discovery with opportunities to take part in conservation.' },
  { title: 'HiHi Companion', fullTitle:'AI-Driven Emotional Eating Companion System', category: 'PRODUCT · EMOTION', number: '02', cover: '/assets/hihi.png', color: '#d99cc1', route:'#project-hihi', href:'/assets/project_hihi_friends.pdf', pdf:'/assets/project_hihi_friends.pdf', pdfDirection:'vertical', demo:'/hihi-demo/index.html?v=20261026-1', demoKind:'hihi', role:'Core member · Independently built the product demo', summary:'HiHi is an AI dining companion for young people who often eat alone. Combining a character-based companion with an app, it brings together mood-aware food suggestions, mealtime conversation, and meal-and-emotion logging to make everyday dining feel more connected and attentive to personal feelings.' },
  { title: 'Emotional Journal', category: 'PRODUCT · WELLBEING', number: '03', cover: null, color: '#70c8ba', route:'#project-mood', href:'/mood-demo/', demo:'/mood-demo/index.html?v=20261031-1', demoKind:'mood', role:'Product design · Development · Deployment', summary:'A mobile-first emotional journal for recording feelings, recognizing triggers and finding a small act of self-care.' },
  { title: 'Plastic Waste Explorer', fullTitle:'Southeast Asia Plastic Waste Explorer', category:'RESEARCH · DATA', number:'04', cover:'/assets/research-preview.jpg', color:'#7399fd', route:'#project-research', href:'https://plasticwastedata.org/', site:'https://plasticwastedata.org/', role:'Research · Data modelling · Visualization', summary:'An evidence-led explorer tracing plastic-waste flows across ASEAN-10. It connects 2014–2024 bilateral trade data with 2022 source attribution and CSP-MFA v12.1, linking routes, polymer composition, material pathways, and impacts while keeping observed, estimated, and modelled evidence distinct.', features:['2014–2024 bilateral trade routes','2022 source and composition attribution','CSP-MFA v12.1 flows and impacts'] },
  { title:'Photography', fullTitle:'Fragments in Transit', category:'PHOTOGRAPHY', number:'05', color:'#7399fd', route:'#photography', gallery:true, summary:'A photographic notebook of places, weather, architecture, and moments in between.' },
];
const routeAliases={'#portfolio':'#home','#project-page-wildlife':'#project-wildlife','#project-page-hihi':'#project-hihi','#project-page-mood':'#project-mood','#project-page-research':'#project-research'};
const currentRoute=()=>routeAliases[window.location.hash]||window.location.hash||'#home';

const materialModes = [
  ['flow', 'FLOW', '脉络流光'],
  ['ripple', 'RIPPLE', '触碰波纹'],
  ['porcelain', 'PORCELAIN', '原色陶瓷'],
  ['structure', 'STRUCTURE', '网格结构'],
];
const nextMode = current => materialModes[(materialModes.findIndex(([key])=>key===current)+1)%materialModes.length][0];

export function App() {
  const canvasHost = useRef(null);
  const scene = useRef(null);
  const anchorNodes = useRef({});
  const [active, setActive] = useState(null);
  const [mode, setMode] = useState('flow');
  const [playing, setPlaying] = useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [labels, setLabels] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [route,setRoute]=useState(currentRoute);
  const openProject=projects.find(project=>project.route===route);
  const view=openProject?'project':/^#(experience|education|internships|projects|entrepreneurship|honors)$/.test(route)?'experience':route==='#contact'?'contact':'home';
  const reading=view!=='home';
  useEffect(() => {
    try {
      scene.current = createBotanicalScene(canvasHost.current, {
        onReady: () => setReady(true),
        onNavigate: direction => setActive(current=>current===null?(direction>0?0:projects.length-1):(current+direction+projects.length)%projects.length),
        onAnchors: positions => Object.entries(positions).forEach(([key, value]) => {
          const element = anchorNodes.current[key];
          if (element) {
            element.style.transform = `translate3d(${value.x}px, ${value.y}px, 0)`;
            element.style.opacity = value.visible ? '1' : '0';
          }
        }),
      });
    } catch (cause) {
      console.error(cause);
      setError('三维场景暂时无法启动，请在支持 WebGL 的浏览器中打开预览');
    }
    return () => { scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setMode(mode); }, [mode]);
  useEffect(() => { scene.current?.setPlaying(playing); }, [playing]);
  useEffect(() => { if(active!==null)scene.current?.setProject(projects[active], active); }, [active]);
  useEffect(()=>{
    const change=()=>setRoute(currentRoute());
    window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);
  },[]);
  useEffect(()=>{
    scene.current?.setReadingMode?.(reading,view==='project'&&!openProject?.gallery);
    if(openProject)setActive(projects.indexOf(openProject));
    requestAnimationFrame(()=>{
      const target=route==='#experience'?document.querySelector('.content-view'):document.getElementById(route.slice(1));
      if(view==='experience'&&target&&route!=='#experience')target.scrollIntoView({block:'start'});
      else {document.querySelector('.content-view')?.scrollTo(0,0);document.querySelector('.back-to-scene')?.focus({preventScroll:true});}
    });
  },[route,reading,openProject,view]);
  useEffect(() => {
    if(!playing||!ready)return;
    const timer=setInterval(()=>{if(!document.hidden)setMode(nextMode);},10000);
    return ()=>clearInterval(timer);
  }, [playing,ready,mode]);
  const selected = active===null?null:projects[active];

  return <main className={`observatory ${ready ? 'is-ready' : ''} ${labels&&!reading ? '' : 'hide-labels'} ${playing?'':'is-paused'} ${reading?'is-content':''}`}>
    <div className="scene-host" ref={canvasHost} role="region" aria-label="三维作品装置：鼠标拖动旋转，滚轮或左右方向键切换作品，手机横滑切换" aria-hidden={reading} tabIndex={reading?-1:0} />
    <div className="edge-shade" aria-hidden="true" />
    {reading&&<div className="content-shade" aria-hidden="true" />}
    <header className="masthead">
      <a className="signature" href="#home">HUI<br />YAO<span className="signature-dot" /></a>
      <p className="identity">TO BE A CREATIVE<br />AI PRODUCT BUILDER</p>
      <span className="edition">SELECTED WORKS<br /><span>DESIGN / PRODUCT / EXPLORATION</span></span>
      <a className="contact-link" href="#contact" aria-current={view==='contact'?'page':undefined}>CONTACT ↗</a>
    </header>
    <div className="botanical-annotations" aria-label="模型上的作品链接" aria-hidden={!labels||reading} inert={!labels||reading}>
      {[['vessel','vessel',0],['corolla','flower',1],['vine','vine',2]].map(([anchor,style,index])=><a key={anchor} className={`annotation annotation--${style}`} ref={el=>{anchorNodes.current[anchor]=el;}} href={projects[index].route}><span className="anchor-point" /><span className="annotation-rule" /><span className="annotation-copy"><b>{projects[index].number} / {projects[index].title.toUpperCase()}</b><small>View project ↗</small></span></a>)}
    </div>
    {!reading&&<nav className="project-index" aria-label="选择作品">
      <span className="eyebrow">INDEX <span className="index-count">01—{String(projects.length).padStart(2,'0')}</span></span>
      <div className="project-list">{projects.map((project, index) => <button key={project.number} className={active === index ? 'active' : ''} aria-pressed={active === index} onClick={() => {setActive(index);window.location.hash=project.route;}}><span className="project-number">{project.number}</span><span>{project.title}</span><span className="project-indicator">↗</span></button>)}</div>
      <div className="project-caption" aria-live="polite"><span>{selected?.category || 'SELECT A PROJECT'}</span><span>SCROLL OR USE ← →</span></div>
    </nav>}
    {reading&&<PortfolioPages key={openProject?.number||view} view={view} project={openProject} projects={projects} />}
    {!ready && !error && <div className="loading-message" role="status"><span className="loading-orbit" />GROWING A LITTLE WORLD…</div>}
    {error && <div className="scene-error" role="alert">{error}</div>}
    <footer className="scene-footer">
      <nav className="section-navigation" aria-label="页面导航"><a href="#home" aria-current={view==='home'||view==='project'?'page':undefined}>Work</a><a href="#experience" aria-current={view==='experience'?'page':undefined}>About</a></nav>
      <div className="material-selector" role="group" aria-label="材质模式">{materialModes.map(([value, label, title]) => <button key={value} title={`${label} · ${title}`} aria-label={title} aria-pressed={mode === value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}><span className="mode-dot" aria-hidden="true" /></button>)}</div>
      <div className="scene-tools"><button aria-pressed={labels} title="显示或隐藏作品链接" onClick={() => setLabels(!labels)}>{labels ? 'LABELS ON' : 'LABELS OFF'}</button><button aria-pressed={!playing} title={playing ? '暂停动态' : '继续动态'} onClick={() => setPlaying(!playing)}>{playing ? 'PAUSE' : 'PLAY'}</button><button title="回到初始角度" onClick={() => scene.current?.reset()}>RESET ↺</button></div>
    </footer>
    {!reading&&<a className="project-action" href={selected?.route || projects[0].route}>{selected?'VIEW PROJECT':'VIEW SELECTED WORKS'}<span>↗</span></a>}
  </main>;
}
