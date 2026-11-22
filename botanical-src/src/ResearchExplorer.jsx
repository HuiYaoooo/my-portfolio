import { useId, useMemo, useState } from 'react';
import boundaries from './data/research/world-paths.json';
import trade from './data/research/trade-snapshots.json';
import './research-explorer.css';

const SHIFT=-105*1000/360;
const point=(lon,lat)=>[(((lon+180)*1000/360+SHIFT)%1000+1000)%1000,(80-lat)*3];
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const mass=value=>value===null||value===undefined?'Not reported':number.format(value);
const quality=route=>route.researcherImputedTonnes>0?'Includes researcher-imputed weight':route.officialEstimatedTonnes>0?'Includes official estimated weight':'Reported weight';
function arc(route){
  const [x1,y1]=point(route.sourceLon,route.sourceLat),[x2,y2]=point(route.targetLon,route.targetLat);
  const distance=Math.hypot(x2-x1,y2-y1),lift=Math.min(110,Math.max(24,distance*.21));
  return {path:`M ${x1} ${y1} Q ${(x1+x2)/2} ${(y1+y2)/2-lift} ${x2} ${y2}`,source:[x1,y1],target:[x2,y2]};
}

export function ResearchExplorer({site='https://plasticwastedata.org/'}){
  const [country,setCountry]=useState('THA');
  const [year,setYear]=useState(2024);
  const [partner,setPartner]=useState(null);
  const arrow=`trade-arrow-${useId().replace(/:/g,'')}`;
  const snapshot=trade.snapshots[`${country}-${year}`];
  const routes=useMemo(()=>snapshot.routes.map(route=>({...route,...arc(route)})),[snapshot]);
  const selected=routes.find(route=>route.sourceCode===partner)||routes[0];
  const countryName=trade.countries[country];
  const updateCountry=code=>{setCountry(code);setPartner(null);};
  const activateCountry=(event,code)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();updateCountry(code);}};
  return <section className="research-explorer" aria-label="Interactive Southeast Asia plastic-waste trade map">
    <div className="research-explorer-controls">
      <label><span>IMPORT DESTINATION</span><select value={country} onChange={event=>updateCountry(event.target.value)} aria-label="Import destination">{Object.entries(trade.countries).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
      <label><span>TRADE YEAR</span><select value={year} onChange={event=>{setYear(Number(event.target.value));setPartner(null);}} aria-label="Trade year">{trade.years.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <p>HS 3915 <span>Plastic waste imports</span></p>
    </div>
    <div className="research-map-stage">
      <svg className="research-trade-map" viewBox="0 0 1000 440" role="group" aria-label={`${year} plastic-waste imports to ${countryName}. Select a country or trade route.`}>
        <defs>
          <marker id={arrow} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5Z" fill="#c9e8ff" /></marker>
        </defs>
        {[0,1000].map(copy=><g key={copy} transform={`translate(${SHIFT+copy} 0)`}>
          {boundaries.map(feature=>{
            const available=Object.hasOwn(trade.countries,feature.code),active=feature.code===country;
            return <path key={feature.code+feature.name} d={feature.path} className={`research-country ${available?'is-asean':''} ${active?'is-selected':''}`} fillRule="evenodd"
              role={available&&copy===0?'button':undefined} tabIndex={available&&copy===0?0:undefined}
              aria-label={available&&copy===0?`Show imports to ${trade.countries[feature.code]}`:undefined}
              aria-pressed={available&&copy===0?active:undefined}
              onClick={available?()=>updateCountry(feature.code):undefined}
              onKeyDown={available?event=>activateCountry(event,feature.code):undefined}><title>{feature.name}</title></path>;
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
          <text x={selected.target[0]+12} y={selected.target[1]+4}>{countryName}</text>
          <text className="research-origin-label" x={Math.min(900,Math.max(15,selected.source[0]+9))} y={selected.source[1]-10}>{selected.sourceName}</text>
        </g>}
        <text x="18" y="418" className="research-map-caption">GLOBAL ORIGINS / ASEAN—10 DESTINATIONS</text>
      </svg>
      <p className="research-map-display-note">{routes.length?`Top ${routes.length} of ${snapshot.summary.routeCount} routes`:'No positive-weight routes reported'}<span>Click a country or hover a flow</span></p>
    </div>
    <div className="research-explorer-readout" aria-live="polite">
      <div><p>{countryName.toUpperCase()} / {year} TOTAL IMPORTS</p><h2>{mass(snapshot.summary.totalTonnes)} <span>tonnes</span></h2><small>{snapshot.summary.routeCount} trade routes · HS 3915</small></div>
      {selected&&<div className="research-route-detail"><p>SELECTED ROUTE</p><h3>{selected.sourceName}<span> → </span>{countryName}</h3><strong>{mass(selected.tonnes)} <span>tonnes</span></strong><small>{quality(selected)} · {selected.valueUsd==null?'Trade value not reported':`${money.format(selected.valueUsd)} trade value`}</small></div>}
    </div>
    {routes.length>0&&<div className="research-partner-list" role="group" aria-label="Trade origins">{routes.map(route=><button key={route.sourceCode} type="button" aria-pressed={route===selected} onClick={()=>setPartner(route.sourceCode)} onPointerEnter={()=>setPartner(route.sourceCode)} onFocus={()=>setPartner(route.sourceCode)}><span>{route.sourceName}</span><span>{mass(route.tonnes)} t</span></button>)}</div>}
    <div className="research-explorer-footer"><p>Public platform snapshot · {trade.retrieved}<br />Imports only · Natural Earth geographic basemap</p><a href={site} target="_blank" rel="noreferrer">EXPLORE THE FULL PLATFORM ↗</a></div>
  </section>;
}
