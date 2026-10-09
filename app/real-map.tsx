"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
// Leaflet touches `window` at import time, so it is loaded only in the browser
// (a top-level import crashed server-side rendering of the whole portal).
import type * as Leaflet from "leaflet";

export type MapChallenge = { id:string; title:string; latitude?:number; longitude?:number; status:string; priority:string; village?:string; district:string };

export default function RealMap({ challenges, onSelect }:{ challenges:MapChallenge[]; onSelect?:(item:MapChallenge)=>void }) {
  const ref=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<Leaflet.Map|null>(null);
  const leafletRef=useRef<typeof Leaflet|null>(null);
  const [locating,setLocating]=useState(false);
  useEffect(()=>{
    if(!ref.current || mapRef.current) return;
    let cancelled=false;
    let map:Leaflet.Map|null=null;
    import("leaflet").then((mod)=>{
    const L=(mod as unknown as {default?:typeof Leaflet}).default ?? mod;
    if(cancelled||!ref.current||mapRef.current) return;
    leafletRef.current=L;
    map=L.map(ref.current).setView([23.61,85.28],7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
    const valid=challenges.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)) as Array<MapChallenge & {latitude:number;longitude:number}>;
    valid.forEach(c=>{
      const marker=L.marker([c.latitude,c.longitude]).addTo(map!);
      marker.bindPopup(`<b>${escapeHtml(c.id)}</b><br/>${escapeHtml(c.title)}<br/><small>${escapeHtml(c.village||c.district)} · ${escapeHtml(c.status)}</small>`);
      marker.on("click",()=>onSelect?.(c));
    });
    mapRef.current=map;
    const created=map;
    setTimeout(()=>created.invalidateSize(),100);
    });
    return()=>{cancelled=true;map?.remove();mapRef.current=null};
  },[challenges,onSelect]);
  const locate=()=>{
    const L=leafletRef.current;
    if(!navigator.geolocation||!mapRef.current||!L) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(pos=>{
      mapRef.current?.setView([pos.coords.latitude,pos.coords.longitude],14);
      L.circleMarker([pos.coords.latitude,pos.coords.longitude],{radius:8}).addTo(mapRef.current!);
      setLocating(false);
    },()=>setLocating(false),{enableHighAccuracy:true,timeout:10000});
  };
  return <div className="real-map-wrap"><div ref={ref} className="real-map"/><button className="map-locate" onClick={locate}>{locating?"Locating…":"Use my location"}</button></div>;
}
function escapeHtml(value:string){return value.replace(/[&<>\"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]!));}
