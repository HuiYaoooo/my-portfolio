import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import experienceHtml from './content/experience.html?raw';
import contactHtml from './content/contact.html?raw';
import { UrbanDemo } from './UrbanDemo.jsx';
import './experience.css';
import { useLanguage } from './i18n.jsx';
import { localizeHtml, projectZh } from './i18n-copy.js';

const InlinePdf=lazy(()=>import('./InlinePdf.jsx').then(module=>({default:module.InlinePdf})));
const InlineDemo=lazy(()=>import('./InlineDemo.jsx').then(module=>({default:module.InlineDemo})));
const ResearchExplorer=lazy(()=>import('./ResearchExplorer.jsx').then(module=>({default:module.ResearchExplorer})));
const PhotographyGallery=lazy(()=>import('./PhotographyGallery.jsx').then(module=>({default:module.PhotographyGallery})));

function ExperienceSections() {
  const {t}=useLanguage();
  const [active,setActive]=useState(()=>window.location.hash.slice(1));
  const [ripple,setRipple]=useState(null);
  useEffect(()=>{
    const change=()=>setActive(window.location.hash.slice(1));
    window.addEventListener('hashchange',change);
    return()=>window.removeEventListener('hashchange',change);
  },[]);
  const activate=(event,id)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    setActive(id);
    setRipple({id,key:performance.now(),x:event.detail?event.clientX-rect.left:rect.width/2,y:event.detail?event.clientY-rect.top:rect.height/2,size:Math.hypot(rect.width,rect.height)*2});
  };
  return <nav className="resume-sections" aria-label={t('Experience sections','经历分类')}>
    {[['education','Education','教育'],['internships','Internship','实习'],['projects','Projects','项目'],['entrepreneurship','Studio','工作室'],['honors','Honors','荣誉']].map(([id,name,chinese])=><a key={id} href={`#${id}`} aria-current={active===id?'location':undefined} onClick={event=>activate(event,id)}>
      <span>{t(name,chinese)}</span>
      {ripple?.id===id&&<span key={ripple.key} className="resume-tab-ripple" aria-hidden="true" style={{'--ripple-x':`${ripple.x}px`,'--ripple-y':`${ripple.y}px`,'--ripple-size':`${ripple.size}px`}} onAnimationEnd={()=>setRipple(null)} />}
    </a>)}
  </nav>;
}

export function PortfolioPages({view,project:sourceProject,projects:sourceProjects}) {
  const {language,t}=useLanguage();
  const localProject=work=>language==='zh'?{...work,...projectZh[work.number]}:work;
  const project=sourceProject?localProject(sourceProject):null;
  const projects=sourceProjects.map(localProject);
  const experienceContent=useMemo(()=>localizeHtml(experienceHtml,language),[language]);
  const contactContent=useMemo(()=>localizeHtml(contactHtml,language),[language]);
  const loading=<p className="work-loading" role="status">{t('Loading the experience…','正在加载体验…')}</p>;
  const workspace=view==='project'&&!project.gallery;
  return <section className={`content-view content-view--${view} ${workspace?'content-view--workspace':''} ${project?.gallery?'content-view--gallery':''}`} aria-label={view==='experience'?t('Experience','经历'):view==='contact'?t('Contact','联系方式'):project.title}>
    <a className="back-to-scene" href="#home">← {t('BACK TO INDEX','返回作品目录')}</a>
    {view==='experience'&&<>
      <header className="page-heading"><span className="eyebrow">{t('BACKGROUND / EXPERIENCE','背景 / 经历')}</span><h1>{t('A little about','我的经历')}<br />{t('the work behind it.','与创作实践')}</h1></header>
      <ExperienceSections />
      <div className="existing-content" dangerouslySetInnerHTML={{__html:experienceContent}} />
    </>}
    {view==='contact'&&<div className="existing-content" dangerouslySetInnerHTML={{__html:contactContent}} />}
    {view==='project'&&<>
      <header className="page-heading"><span className="eyebrow">{project.number} / {project.category}</span><h1>{project.fullTitle||project.title}</h1>{project.role&&<p>{project.role}</p>}<p className={`project-overview ${project.gallery?'project-overview--single-line':''}`}>{project.summary}</p></header>
      <Suspense fallback={loading}>
        {project.pdf&&<div className="project-workspace">
          <div className="project-pdf-column"><InlinePdf src={project.pdf} cover={project.cover} title={project.title} direction={project.pdfDirection} /></div>
          <aside className="project-demo-column" aria-label={t(`${project.title} app experience`,`${project.title}应用体验`)}>
            <span className="media-label">{t('TRY THE EXPERIENCE','交互体验')}</span>
            {project.demoKind==='urban'?<UrbanDemo />:<InlineDemo src={project.demo} title={t(`${project.title} interactive demo`,`${project.title}交互演示`)} kind={project.demoKind} />}
          </aside>
        </div>}
        {!project.pdf&&project.demo&&<div className="project-demo-solo"><InlineDemo src={project.demo} title={t(`${project.title} interactive demo`,`${project.title}交互演示`)} kind={project.demoKind} /></div>}
        {project.site&&<ResearchExplorer site={project.site} />}
        {project.gallery&&<PhotographyGallery />}
      </Suspense>
      <nav className="detail-pagination" aria-label={t('More projects','更多作品')}>{projects.map(work=><a key={work.number} href={work.route}>{work.number} / {work.title}</a>)}</nav>
    </>}
  </section>;
}
