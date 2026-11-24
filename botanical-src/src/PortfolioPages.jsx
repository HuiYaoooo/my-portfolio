import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import experienceHtml from './content/experience.html?raw';
import contactHtml from './content/contact.html?raw';
import { UrbanDemo } from './UrbanDemo.jsx';
import './experience.css';
import { useLanguage } from './i18n.jsx';
import { localizeHtml, projectZh } from './i18n-copy.js';
import { addContactIcons } from './contact-icons.js';
import './project-narrative.css';
import './contact-polish.css';

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
  const localProject=work=>language==='zh'?{...work,...projectZh[work.number],...work.zh}:work;
  const project=sourceProject?localProject(sourceProject):null;
  const projects=sourceProjects.map(localProject);
  const experienceContent=useMemo(()=>localizeHtml(experienceHtml,language),[language]);
  const contactContent=useMemo(()=>addContactIcons(localizeHtml(contactHtml,language)),[language]);
  const loading=<p className="work-loading" role="status">{t('Loading the experience…','正在加载体验…')}</p>;
  const workspace=view==='project'&&!project.gallery;
  return <section className={`content-view content-view--${view} ${workspace?'content-view--workspace':''} ${project?.gallery?'content-view--gallery':''}`} aria-label={view==='experience'?t('Experience','经历'):view==='contact'?t('Contact','联系方式'):project.title}>
    <a className="back-to-scene" href="#home">← {t('BACK TO INDEX','返回作品目录')}</a>
    {view==='experience'&&<>
      <header className="page-heading"><span className="eyebrow">{t('BACKGROUND / EXPERIENCE','背景 / 经历')}</span><h1>{t('A little about','我的经历')}<br />{t('the work behind it.','与创作实践')}</h1></header>
      <ExperienceSections />
      <div className="existing-content" dangerouslySetInnerHTML={{__html:experienceContent}} />
    </>}
    {view==='contact'&&<>
      <div className="existing-content" dangerouslySetInnerHTML={{__html:contactContent}} />
      <footer className="contact-information" aria-labelledby="contact-information-title">
        <h2 id="contact-information-title">{t('Information','网站信息')}</h2>
        <p>{t('The galaxy background uses Pegasus Galaxy by Frank Hugenroth, adapted for Three.js by Sebastián Vasquez / CosmosMuseum.','星河背景采用 Frank Hugenroth 的 Pegasus Galaxy，由 Sebastián Vasquez / CosmosMuseum 适配至 Three.js。')}</p>
        <a href="https://github.com/CosmosMuseum/cosmos-museum-galaxy" target="_blank" rel="noreferrer">{t('Galaxy shader · Source','星河着色器 · 项目来源')}</a>
      </footer>
    </>}
    {view==='project'&&<>
      <header className="page-heading"><span className="eyebrow">{project.number} / {project.category}</span><h1>{project.fullTitle||project.title}</h1>
        {project.site&&<a className="project-platform-link" href={project.site} target="_blank" rel="noopener noreferrer"><span>{t('Explore the full platform','打开废塑料探索平台')}</span><svg className="external-arrow" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M7 7h10v10" /></svg></a>}
        {project.role&&<p>{project.role}</p>}<p className={`project-overview ${project.gallery?'project-overview--single-line':''}`}>{project.summary}</p></header>
      <Suspense fallback={loading}>
        {project.pdf&&<div className={`project-workspace ${!project.demo&&!project.demoKind?'project-workspace--document':''}`}>
          <div className="project-pdf-column"><InlinePdf src={project.pdf} cover={project.cover} title={project.title} direction={project.pdfDirection} presentation={project.presentation} /></div>
          {(project.demo||project.demoKind)&&<aside className="project-demo-column" aria-label={t(`${project.title} app experience`,`${project.title}应用体验`)}>
            <span className="media-label">{t('TRY THE EXPERIENCE','交互体验')}</span>
            {project.demoKind==='urban'?<UrbanDemo />:<InlineDemo src={project.demo} title={t(`${project.title} interactive demo`,`${project.title}交互演示`)} kind={project.demoKind} />}
          </aside>}
        </div>}
        {!project.pdf&&project.demo&&<div className="project-demo-solo"><InlineDemo src={project.demo} title={t(`${project.title} interactive demo`,`${project.title}交互演示`)} kind={project.demoKind} /></div>}
        {project.site&&<ResearchExplorer />}
        {project.gallery&&<PhotographyGallery />}
      </Suspense>
      {(project.details?.length>0||project.tables?.length>0)&&<div className="project-narrative" aria-label={t('Project details and results','项目详情与结果')}>
        {project.details?.map(section=><section key={section.heading} className="project-narrative-section"><h2>{section.heading}</h2>{section.paragraphs?.map(paragraph=><p key={paragraph}>{paragraph}</p>)}{section.items?.length>0&&<ul>{section.items.map(item=><li key={item}>{item}</li>)}</ul>}</section>)}
        {project.tables?.map(table=><section key={table.title} className="project-result-section"><h2>{table.title}</h2><div className="project-result-scroll" tabIndex={0} role="region" aria-label={table.title}><table><thead><tr>{table.columns.map(column=><th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{table.rows.map((row,index)=><tr key={index}>{row.map((cell,column)=><td key={column}>{cell}</td>)}</tr>)}</tbody></table></div><p className="project-table-caption">{table.caption}</p></section>)}
      </div>}
      <nav className="detail-pagination" aria-label={t('More projects','更多作品')}>{projects.map(work=><a key={work.number} href={work.route}>{work.number} / {work.title}</a>)}</nav>
    </>}
  </section>;
}
