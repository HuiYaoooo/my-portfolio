import { lazy, Suspense, useEffect, useState } from 'react';
import experienceHtml from './content/experience.html?raw';
import contactHtml from './content/contact.html?raw';
import { UrbanDemo } from './UrbanDemo.jsx';
import './experience.css';

const InlinePdf=lazy(()=>import('./InlinePdf.jsx').then(module=>({default:module.InlinePdf})));
const InlineDemo=lazy(()=>import('./InlineDemo.jsx').then(module=>({default:module.InlineDemo})));
const ResearchExplorer=lazy(()=>import('./ResearchExplorer.jsx').then(module=>({default:module.ResearchExplorer})));
const PhotographyGallery=lazy(()=>import('./PhotographyGallery.jsx').then(module=>({default:module.PhotographyGallery})));
const loading=<p className="work-loading" role="status">Loading the experience…</p>;

function ExperienceSections() {
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
  return <nav className="resume-sections" aria-label="Experience sections">
    {[['education','Education'],['internships','Internship'],['projects','Projects'],['entrepreneurship','Studio'],['honors','Honors']].map(([id,name])=><a key={id} href={`#${id}`} aria-current={active===id?'location':undefined} onClick={event=>activate(event,id)}>
      <span>{name}</span>
      {ripple?.id===id&&<span key={ripple.key} className="resume-tab-ripple" aria-hidden="true" style={{'--ripple-x':`${ripple.x}px`,'--ripple-y':`${ripple.y}px`,'--ripple-size':`${ripple.size}px`}} onAnimationEnd={()=>setRipple(null)} />}
    </a>)}
  </nav>;
}

export function PortfolioPages({view,project,projects}) {
  const workspace=view==='project'&&!project.gallery;
  return <section className={`content-view content-view--${view} ${workspace?'content-view--workspace':''} ${project?.gallery?'content-view--gallery':''}`} aria-label={view==='experience'?'Experience':view==='contact'?'Contact':project.title}>
    <a className="back-to-scene" href="#home">← BACK TO INDEX</a>
    {view==='experience'&&<>
      <header className="page-heading"><span className="eyebrow">BACKGROUND / EXPERIENCE</span><h1>A little about<br />the work behind it.</h1></header>
      <ExperienceSections />
      <div className="existing-content" dangerouslySetInnerHTML={{__html:experienceHtml}} />
    </>}
    {view==='contact'&&<div className="existing-content" dangerouslySetInnerHTML={{__html:contactHtml}} />}
    {view==='project'&&<>
      <header className="page-heading"><span className="eyebrow">{project.number} / {project.category}</span><h1>{project.fullTitle||project.title}</h1>{project.role&&<p>{project.role}</p>}<p className={`project-overview ${project.gallery?'project-overview--single-line':''}`}>{project.summary}</p></header>
      <Suspense fallback={loading}>
        {project.pdf&&<div className="project-workspace">
          <div className="project-pdf-column"><InlinePdf src={project.pdf} cover={project.cover} title={project.title} direction={project.pdfDirection} /></div>
          <aside className="project-demo-column" aria-label={`${project.title} app experience`}>
            <span className="media-label">TRY THE EXPERIENCE</span>
            {project.demoKind==='urban'?<UrbanDemo />:<InlineDemo src={project.demo} title={`${project.title} interactive demo`} kind={project.demoKind} />}
          </aside>
        </div>}
        {!project.pdf&&project.demo&&<div className="project-demo-solo"><InlineDemo src={project.demo} title={`${project.title} interactive demo`} kind={project.demoKind} /></div>}
        {project.site&&<ResearchExplorer site={project.site} />}
        {project.gallery&&<PhotographyGallery />}
      </Suspense>
      <nav className="detail-pagination" aria-label="More projects">{projects.map(work=><a key={work.number} href={work.route}>{work.number} / {work.title}</a>)}</nav>
    </>}
  </section>;
}
