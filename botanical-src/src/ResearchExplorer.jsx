import { useId, useMemo, useState } from 'react';
import boundaries from './data/research/world-paths.json';
import trade from './data/research/trade-snapshots.json';
import { useLanguage } from './i18n.jsx';
import './research-explorer.css';

const SHIFT=-105*1000/360;
const point=(lon,lat)=>[(((lon+180)*1000/360+SHIFT)%1000+1000)%1000,(80-lat)*3];
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const quality=route=>route.researcherImputedTonnes>0?'Includes researcher-imputed weight':route.officialEstimatedTonnes>0?'Includes official estimated weight':'Reported weight';
const countryNamesZh={BRN:'文莱',KHM:'柬埔寨',IDN:'印度尼西亚',LAO:'老挝',MYS:'马来西亚',MMR:'缅甸',PHL:'菲律宾',SGP:'新加坡',THA:'泰国',VNM:'越南',FRA:'法国',CHN:'中国',GBR:'英国',USA:'美国',KOR:'韩国',DEU:'德国',IND:'印度',HKG:'中国香港',ITA:'意大利',ESP:'西班牙',JPN:'日本',MOZ:'莫桑比克',NGA:'尼日利亚',CAN:'加拿大',QAT:'卡塔尔',AUS:'澳大利亚',NLD:'荷兰',GRC:'希腊',NZL:'新西兰',MEX:'墨西哥',MHL:'马绍尔群岛',BEL:'比利时',SVN:'斯洛文尼亚',POL:'波兰',CYP:'塞浦路斯',ROU:'罗马尼亚',BHR:'巴林',CHL:'智利',TZA:'坦桑尼亚',ARE:'阿联酋',ZAF:'南非',GEO:'格鲁吉亚',SAU:'沙特阿拉伯',GTM:'危地马拉',COL:'哥伦比亚',HND:'洪都拉斯',ISR:'以色列',PAN:'巴拿马',BGD:'孟加拉国'};
function arc(route){
  const [x1,y1]=point(route.sourceLon,route.sourceLat),[x2,y2]=point(route.targetLon,route.targetLat);
  const distance=Math.hypot(x2-x1,y2-y1),lift=Math.min(110,Math.max(24,distance*.21));
  return {path:`M ${x1} ${y1} Q ${(x1+x2)/2} ${(y1+y2)/2-lift} ${x2} ${y2}`,source:[x1,y1],target:[x2,y2]};
}

export function ResearchExplorer(){
  const {t}=useLanguage();
  const nameOf=(code,name)=>t(name,countryNamesZh[code]||name);
  const mass=value=>value===null||value===undefined?t('Not reported','未报告'):number.format(value);
  const [country,setCountry]=useState('THA');
  const [year,setYear]=useState(2024);
  const [partner,setPartner]=useState(null);
  const arrow=`trade-arrow-${useId().replace(/:/g,'')}`;
  const snapshot=trade.snapshots[`${country}-${year}`];
  const routes=useMemo(()=>snapshot.routes.map(route=>({...route,...arc(route)})),[snapshot]);
  const selected=routes.find(route=>route.sourceCode===partner)||routes[0];
  const countryName=trade.countries[country];
  const countryLabel=nameOf(country,countryName);
  const updateCountry=code=>{setCountry(code);setPartner(null);};
  const activateCountry=(event,code)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();updateCountry(code);}};
  return <section className="research-explorer" aria-label={t("Interactive Southeast Asia plastic-waste trade map","东南亚废塑料贸易交互地图")}>
    <div className="research-explorer-controls">
      <label><span>{t("IMPORT DESTINATION","进口目的地")}</span><select value={country} onChange={event=>updateCountry(event.target.value)} aria-label={t("Import destination","进口目的地")}>{Object.entries(trade.countries).map(([code,name])=><option key={code} value={code}>{nameOf(code,name)}</option>)}</select></label>
      <label><span>{t("TRADE YEAR","贸易年份")}</span><select value={year} onChange={event=>{setYear(Number(event.target.value));setPartner(null);}} aria-label={t("Trade year","贸易年份")}>{trade.years.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <p>HS 3915 <span>{t("Plastic waste imports","废塑料进口")}</span></p>
    </div>
    <div className="research-map-stage">
      <svg className="research-trade-map" viewBox="0 0 1000 440" role="group" aria-label={t(`${year} plastic-waste imports to ${countryName}. Select a country or trade route.`,`${year} 年${countryLabel}的废塑料进口，选择国家或贸易流向以查看数据`)}>
        <defs>
          <marker id={arrow} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5Z" fill="#c9e8ff" /></marker>
        </defs>
        {[0,1000].map(copy=><g key={copy} transform={`translate(${SHIFT+copy} 0)`}>
          {boundaries.map(feature=>{
            const available=Object.hasOwn(trade.countries,feature.code),active=feature.code===country;
            return <path key={feature.code+feature.name} d={feature.path} className={`research-country ${available?'is-asean':''} ${active?'is-selected':''}`} fillRule="evenodd"
              role={available&&copy===0?'button':undefined} tabIndex={available&&copy===0?0:undefined}
              aria-label={available&&copy===0?t(`Show imports to ${trade.countries[feature.code]}`,`查看${nameOf(feature.code,trade.countries[feature.code])}的进口`):undefined}
              aria-pressed={available&&copy===0?active:undefined}
              onClick={available?()=>updateCountry(feature.code):undefined}
              onKeyDown={available?event=>activateCountry(event,feature.code):undefined}><title>{nameOf(feature.code,feature.name)}</title></path>;
          })}
        </g>)}
        <g className="research-route-paths">{routes.map(route=>{
          const active=route===selected;
          return <g key={route.sourceCode} className={active?'is-selected':''}>
            <path className="research-flow-hit" d={route.path} onPointerEnter={()=>setPartner(route.sourceCode)} onClick={()=>setPartner(route.sourceCode)} />
            <path className="research-flow-line" d={route.path} markerEnd={`url(#${arrow})`} style={{strokeWidth:active?2.5:.8+Math.sqrt(route.tonnes/(routes[0]?.tonnes||1))*1.5}} />
            <circle className="research-source-node" cx={route.source[0]} cy={route.source[1]} r={active?4:2.5} />
          </g>;
        })}</g>
        {selected&&<g className="research-selected-nodes">
          <circle cx={selected.target[0]} cy={selected.target[1]} r="9" className="research-target-halo" />
          <circle cx={selected.target[0]} cy={selected.target[1]} r="4" className="research-target-node" />
          <text x={selected.target[0]+12} y={selected.target[1]+4}>{countryLabel}</text>
          <text className="research-origin-label" x={Math.min(900,Math.max(15,selected.source[0]+9))} y={selected.source[1]-10}>{nameOf(selected.sourceCode,selected.sourceName)}</text>
        </g>}
        <text x="18" y="418" className="research-map-caption">{t("GLOBAL ORIGINS / ASEAN—10 DESTINATIONS","全球来源地 / 东盟十国目的地")}</text>
      </svg>
      <p className="research-map-display-note">{routes.length?t(`Top ${routes.length} of ${snapshot.summary.routeCount} routes`,`${snapshot.summary.routeCount} 条流向中的前 ${routes.length} 条`):t('No positive-weight routes reported','暂无报告重量大于零的流向')}<span>{t('Click a country or hover a flow','点击国家或将鼠标移至流向上')}</span></p>
    </div>
    <div className="research-explorer-readout" aria-live="polite">
      <div><p>{t(`${countryName.toUpperCase()} / ${year} TOTAL IMPORTS`,`${countryLabel} / ${year} 年进口总量`)}</p><h2>{mass(snapshot.summary.totalTonnes)} <span>{t("tonnes","吨")}</span></h2><small>{t(`${snapshot.summary.routeCount} trade routes`,`${snapshot.summary.routeCount} 条贸易流向`)} · HS 3915</small></div>
      {selected&&<div className="research-route-detail"><p>{t("SELECTED ROUTE","当前流向")}</p><h3>{nameOf(selected.sourceCode,selected.sourceName)}<span> → </span>{countryLabel}</h3><strong>{mass(selected.tonnes)} <span>{t("tonnes","吨")}</span></strong><small>{t(quality(selected),selected.researcherImputedTonnes>0?'含研究者插补重量':selected.officialEstimatedTonnes>0?'含官方估算重量':'报告重量')} · {selected.valueUsd==null?t('Trade value not reported','贸易额未报告'):t(`${money.format(selected.valueUsd)} trade value`,`贸易额 ${money.format(selected.valueUsd)}`)}</small></div>}
    </div>
    {routes.length>0&&<div className="research-partner-list" role="group" aria-label={t("Trade origins","贸易来源地")}>{routes.map(route=><button key={route.sourceCode} type="button" aria-pressed={route===selected} onClick={()=>setPartner(route.sourceCode)} onPointerEnter={()=>setPartner(route.sourceCode)} onFocus={()=>setPartner(route.sourceCode)}><span>{nameOf(route.sourceCode,route.sourceName)}</span><span>{mass(route.tonnes)} {t("t","吨")}</span></button>)}</div>}
    <div className="research-explorer-footer"><p>{t("Public platform snapshot","公开平台数据快照")} · {trade.retrieved}<br />{t("Imports only · Natural Earth geographic basemap","仅包含进口 · Natural Earth 地理底图")}</p></div>
  </section>;
}
