import { useState } from 'react';
import experienceHtml from './content/experience.html?raw';
import contactHtml from './content/contact.html?raw';
import { PhotographyGallery } from './PhotographyGallery.jsx';

export function PortfolioPages({view,project,projects}) {
  const [demoOpen,setDemoOpen]=useState(false);
  return <section className={`content-view content-view--${view}`} aria-label={view==='experience'?'Experience':view==='contact'?'Contact':project.title}>
    <a className="back-to-scene" href="#home">← BACK TO INDEX</a>
    {view==='experience'&&<>
      <header className="page-heading"><span className="eyebrow">BACKGROUND / EXPERIENCE</span><h1>A little about<br />the work behind it.</h1></header>
      <nav className="resume-sections" aria-label="Experience sections">{[['education','Education'],['internships','Internship'],['projects','Projects'],['entrepreneurship','Studio'],['honors','Honors']].map(([id,name])=><a key={id} href={`#${id}`}>{name}</a>)}</nav>
      <div className="existing-content" dangerouslySetInnerHTML={{__html:experienceHtml}} />
    </>}
    {view==='contact'&&<div className="existing-content" dangerouslySetInnerHTML={{__html:contactHtml}} />}
    {view==='project'&&<>
      <header className="page-heading"><span className="eyebrow">{project.number} / {project.category}</span><h1>{project.fullTitle||project.title}</h1><p>{project.role}</p></header>
      <p className="project-overview">{project.summary}</p>
      {(project.pdf||project.demo||project.site)&&<div className="detail-actions">
        {project.pdf&&<a href={project.pdf} target="_blank" rel="noreferrer">VIEW PDF ↗</a>}
        {project.demo&&<button aria-expanded={demoOpen} onClick={()=>setDemoOpen(!demoOpen)}>{demoOpen?'CLOSE DEMO −':'EXPLORE DEMO +'}</button>}
        {project.site&&<a href={project.site} target="_blank" rel="noreferrer">OPEN RESEARCH PLATFORM ↗</a>}
        {project.demo&&<a href={project.demo} target="_blank" rel="noreferrer">OPEN DEMO ↗</a>}
      </div>}
      {project.features&&<ul className="research-features">{project.features.map(feature=><li key={feature}>{feature}</li>)}</ul>}
      {project.cover&&<figure className="project-plate">{project.site?<a href={project.site} target="_blank" rel="noreferrer"><img src={project.cover} alt={`${project.title} website preview`} /></a>:<img src={project.cover} alt={`${project.title} original project cover`} />}<figcaption>{project.number} / {project.title}</figcaption></figure>}
      {project.gallery&&<PhotographyGallery />}
      {demoOpen&&project.demo&&<div className="detail-demo"><iframe src={project.demo} title={`${project.title} interactive demo`} loading="lazy" /><a href={project.demo} target="_blank" rel="noreferrer">OPEN DEMO IN A NEW TAB ↗</a></div>}
      <nav className="detail-pagination" aria-label="More projects">{projects.map(work=><a key={work.number} href={work.route}>{work.number} / {work.title}</a>)}</nav>
    </>}
  </section>;
}
