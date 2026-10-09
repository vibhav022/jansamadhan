"use client";

import "./map-overrides.css";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Ambulance, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Droplets,
  FlaskConical, Hospital, LocateFixed, Loader2, Map, MapPin, Mountain, Navigation,
  PackageSearch, Phone, Pill, Satellite, Search, Sprout, Wheat
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type Layer = "all" | "hospital" | "medicine" | "testing" | "fertilizer" | "ambulance";
type BookingType = "Hospital" | "Ambulance" | "Fertilizer" | "Water Test" | "Soil Test";
type MapStyle = "default" | "satellite" | "terrain";
type Location = { lat: number; lng: number };
type Stock = { name: string; strength?: string; stock: number; unit: string; availability: "Available" | "Low stock" };
type Facility = {
  id: string; name: string; type: Exclude<Layer, "all">; district: string; address: string;
  lat: number; lng: number; phone: string; status: string; details: string;
  stock?: Stock[]; services?: string[]; slots?: string[];
};

const hospitals: Facility[] = [
  {id:"H-RIMS",name:"Rajendra Institute of Medical Sciences",type:"hospital",district:"Ranchi",address:"Bariatu Road, Ranchi",lat:23.3908,lng:85.3491,phone:"0651 254 1533",status:"Open 24×7",details:"Emergency, trauma, medicine and specialist care",services:["Emergency","General medicine","Trauma","Diagnostics"],slots:["09:00–11:00","11:00–13:00","14:00–16:00"]},
  {id:"H-RNC",name:"Sadar Hospital Ranchi",type:"hospital",district:"Ranchi",address:"Purulia Road, Ranchi",lat:23.3695,lng:85.3255,phone:"0651 221 5850",status:"Open 24×7",details:"District hospital, OPD and maternal care",services:["OPD","Maternal care","Paediatrics","Pharmacy"],slots:["08:30–10:30","10:30–12:30","15:00–17:00"]},
  {id:"H-MGM",name:"MGM Medical College Hospital",type:"hospital",district:"East Singhbhum",address:"Sakchi, Jamshedpur",lat:22.8065,lng:86.1995,phone:"0657 223 0011",status:"Open 24×7",details:"Emergency, OPD and teaching hospital",services:["Emergency","OPD","Surgery","Diagnostics"],slots:["09:00–11:00","11:30–13:30","14:30–16:30"]},
  {id:"H-SNMMCH",name:"Shaheed Nirmal Mahto Medical College",type:"hospital",district:"Dhanbad",address:"Saraidhela, Dhanbad",lat:23.7957,lng:86.4304,phone:"0326 223 0465",status:"Open 24×7",details:"Emergency and multi-speciality government hospital",services:["Emergency","Medicine","Orthopaedics","Diagnostics"],slots:["09:00–11:00","11:00–13:00","15:00–17:00"]},
  {id:"H-PJMC",name:"Phulo Jhano Medical College Hospital",type:"hospital",district:"Dumka",address:"Dighi, Dumka",lat:24.2640,lng:87.2470,phone:"06434 222 101",status:"Open 24×7",details:"Emergency, OPD and district referral services",services:["Emergency","OPD","Women & child","Diagnostics"],slots:["09:00–11:00","11:30–13:30","14:30–16:00"]},
  {id:"H-SBMCH",name:"Sheikh Bhikhari Medical College Hospital",type:"hospital",district:"Hazaribagh",address:"Hazaribagh Medical College Campus",lat:23.9980,lng:85.3610,phone:"06546 223 126",status:"Open 24×7",details:"Emergency, OPD and referral care",services:["Emergency","OPD","Surgery","Pathology"],slots:["09:00–11:00","11:00–13:00","14:00–16:00"]},
  {id:"H-DEO",name:"Sadar Hospital Deoghar",type:"hospital",district:"Deoghar",address:"Williams Town, Deoghar",lat:24.4829,lng:86.6960,phone:"06432 232 050",status:"Open 24×7",details:"District emergency, OPD and diagnostics",services:["Emergency","OPD","Diagnostics","Pharmacy"],slots:["08:30–10:30","11:00–13:00","15:00–17:00"]},
  {id:"H-PLM",name:"Medinirai Medical College Hospital",type:"hospital",district:"Palamu",address:"Medininagar, Palamu",lat:24.0300,lng:84.0700,phone:"06562 222 064",status:"Open 24×7",details:"Emergency and district referral hospital",services:["Emergency","OPD","Medicine","Diagnostics"],slots:["09:00–11:00","11:00–13:00","14:00–16:00"]},
];

type Doctor = { id:string; hospitalId:string; name:string; specialty:string; availability:string; slots:string[] };
const doctors: Doctor[] = [
  {id:"D-RIMS-1",hospitalId:"H-RIMS",name:"Dr. Ananya Singh",specialty:"General Medicine",availability:"Available today",slots:["09:00–09:20","09:20–09:40","10:00–10:20","11:00–11:20"]},
  {id:"D-RIMS-2",hospitalId:"H-RIMS",name:"Dr. Ravi Kumar",specialty:"Orthopaedics",availability:"Available today",slots:["10:00–10:20","10:20–10:40","11:00–11:20","12:00–12:20"]},
  {id:"D-RNC-1",hospitalId:"H-RNC",name:"Dr. Pooja Verma",specialty:"Paediatrics",availability:"Available today",slots:["08:30–08:50","09:00–09:20","10:00–10:20","15:00–15:20"]},
  {id:"D-MGM-1",hospitalId:"H-MGM",name:"Dr. Aman Sahay",specialty:"General Surgery",availability:"Available today",slots:["09:00–09:20","10:00–10:20","11:30–11:50","14:30–14:50"]},
  {id:"D-SNM-1",hospitalId:"H-SNMMCH",name:"Dr. Neha Gupta",specialty:"Women & Child Health",availability:"Available today",slots:["09:00–09:20","10:00–10:20","11:00–11:20","15:00–15:20"]},
];

const medicineCentres: Facility[] = [
  {id:"M-RIMS",name:"Jan Aushadhi Kendra — RIMS",type:"medicine",district:"Ranchi",address:"RIMS Campus, Bariatu",lat:23.3918,lng:85.3501,phone:"1800 180 8080",status:"Open · 8 AM–8 PM",details:"Government generic medicine centre",stock:[{name:"Paracetamol",strength:"500 mg",stock:340,unit:"tablets",availability:"Available"},{name:"ORS",strength:"21 g",stock:96,unit:"sachets",availability:"Available"},{name:"Metformin",strength:"500 mg",stock:180,unit:"tablets",availability:"Available"},{name:"Amoxicillin",strength:"500 mg",stock:28,unit:"capsules",availability:"Low stock"}]},
  {id:"M-RNC",name:"Sadar Hospital Government Pharmacy",type:"medicine",district:"Ranchi",address:"Purulia Road, Ranchi",lat:23.3700,lng:85.3262,phone:"104",status:"Open 24×7",details:"Free essential medicines against hospital prescription",stock:[{name:"Paracetamol",strength:"500 mg",stock:510,unit:"tablets",availability:"Available"},{name:"Iron + Folic Acid",stock:240,unit:"tablets",availability:"Available"},{name:"Cetirizine",strength:"10 mg",stock:74,unit:"tablets",availability:"Available"},{name:"Insulin Human",strength:"40 IU",stock:18,unit:"vials",availability:"Low stock"}]},
  {id:"M-MGM",name:"MGM Hospital Government Pharmacy",type:"medicine",district:"East Singhbhum",address:"Sakchi, Jamshedpur",lat:22.8070,lng:86.2002,phone:"104",status:"Open 24×7",details:"Essential medicine distribution counter",stock:[{name:"Paracetamol",strength:"500 mg",stock:420,unit:"tablets",availability:"Available"},{name:"ORS",strength:"21 g",stock:120,unit:"sachets",availability:"Available"},{name:"Amlodipine",strength:"5 mg",stock:160,unit:"tablets",availability:"Available"},{name:"Amoxicillin",strength:"500 mg",stock:44,unit:"capsules",availability:"Available"}]},
  {id:"M-DHN",name:"SNMMCH Government Pharmacy",type:"medicine",district:"Dhanbad",address:"Saraidhela, Dhanbad",lat:23.7962,lng:86.4310,phone:"104",status:"Open · 8 AM–10 PM",details:"District essential medicine stock point",stock:[{name:"Paracetamol",strength:"500 mg",stock:290,unit:"tablets",availability:"Available"},{name:"Metformin",strength:"500 mg",stock:62,unit:"tablets",availability:"Available"},{name:"Iron + Folic Acid",stock:35,unit:"tablets",availability:"Low stock"},{name:"Cetirizine",strength:"10 mg",stock:110,unit:"tablets",availability:"Available"}]},
  {id:"M-DEO",name:"Jan Aushadhi Kendra — Deoghar",type:"medicine",district:"Deoghar",address:"Sadar Hospital Campus, Deoghar",lat:24.4834,lng:86.6967,phone:"1800 180 8080",status:"Open · 9 AM–7 PM",details:"Affordable generic medicine centre",stock:[{name:"Paracetamol",strength:"500 mg",stock:230,unit:"tablets",availability:"Available"},{name:"ORS",strength:"21 g",stock:47,unit:"sachets",availability:"Available"},{name:"Amlodipine",strength:"5 mg",stock:88,unit:"tablets",availability:"Available"},{name:"Insulin Human",strength:"40 IU",stock:9,unit:"vials",availability:"Low stock"}]},
];

const testingCentres: Facility[] = [
  {id:"T-WTR-RNC",name:"State Water Quality Testing Laboratory",type:"testing",district:"Ranchi",address:"Dhurwa, Ranchi",lat:23.3077,lng:85.2955,phone:"0651 240 0183",status:"Slots available",details:"Drinking water quality and contamination testing",services:["Water Test","pH & turbidity","Fluoride","Iron & bacterial test"],slots:["10:00–11:00","11:30–12:30","14:00–15:00"]},
  {id:"T-WTR-JSR",name:"District Water Quality Laboratory",type:"testing",district:"East Singhbhum",address:"Adityapur, Jamshedpur",lat:22.7902,lng:86.1745,phone:"0657 238 3102",status:"Slots available",details:"Household, school and community water samples",services:["Water Test","Chemical panel","Microbial test","Field sample support"],slots:["09:30–10:30","12:00–13:00","15:00–16:00"]},
  {id:"T-SOIL-KNK",name:"State Soil Testing Laboratory",type:"testing",district:"Ranchi",address:"Kanke, Ranchi",lat:23.4353,lng:85.3218,phone:"0651 245 0900",status:"Slots available",details:"Soil health card and nutrient recommendations",services:["Soil Test","NPK analysis","pH & organic carbon","Crop recommendation"],slots:["09:30–11:00","11:30–13:00","14:30–16:00"]},
  {id:"T-SOIL-DMK",name:"Mobile Soil Testing Unit — Dumka",type:"testing",district:"Dumka",address:"District Agriculture Office, Dumka",lat:24.2678,lng:87.2498,phone:"06434 222 520",status:"Field visit booking",details:"Village collection camps and soil health testing",services:["Soil Test","Field collection","NPK analysis","Soil health card"],slots:["09:00–12:00","12:00–15:00","15:00–17:00"]},
];

const fertilizerCentres: Facility[] = [
  {id:"F-KNK",name:"PACS Agri Input Centre — Kanke",type:"fertilizer",district:"Ranchi",address:"Kanke Block Campus",lat:23.4325,lng:85.3198,phone:"1800 123 1136",status:"Stock available",details:"Subsidised fertilizer pickup centre",stock:[{name:"Urea",strength:"45 kg bag",stock:124,unit:"bags",availability:"Available"},{name:"DAP",strength:"50 kg bag",stock:48,unit:"bags",availability:"Available"},{name:"NPK 10:26:26",strength:"50 kg bag",stock:17,unit:"bags",availability:"Low stock"}]},
  {id:"F-BAU",name:"BAU Farmer Service Centre",type:"fertilizer",district:"Ranchi",address:"Birsa Agricultural University, Kanke",lat:23.4441,lng:85.3187,phone:"0651 245 0832",status:"Stock available",details:"Fertilizers, bio-inputs and crop advisory",stock:[{name:"Vermicompost",strength:"25 kg bag",stock:72,unit:"bags",availability:"Available"},{name:"Biofertilizer",strength:"1 kg pack",stock:95,unit:"packs",availability:"Available"},{name:"MOP",strength:"50 kg bag",stock:22,unit:"bags",availability:"Low stock"}]},
  {id:"F-DMK",name:"e-PACS Fertilizer Centre — Dumka",type:"fertilizer",district:"Dumka",address:"Dumka Sadar Block",lat:24.2761,lng:87.2450,phone:"1800 123 1136",status:"Stock available",details:"Farmer ID-based subsidised fertilizer booking",stock:[{name:"Urea",strength:"45 kg bag",stock:86,unit:"bags",availability:"Available"},{name:"DAP",strength:"50 kg bag",stock:31,unit:"bags",availability:"Available"},{name:"NPK 12:32:16",strength:"50 kg bag",stock:12,unit:"bags",availability:"Low stock"}]},
  {id:"F-HZB",name:"KVK Agri Input Point — Hazaribagh",type:"fertilizer",district:"Hazaribagh",address:"Hazaribagh KVK Campus",lat:23.9920,lng:85.3748,phone:"06546 260 118",status:"Stock available",details:"Fertilizer supply with soil-based crop advisory",stock:[{name:"Urea",strength:"45 kg bag",stock:64,unit:"bags",availability:"Available"},{name:"DAP",strength:"50 kg bag",stock:19,unit:"bags",availability:"Low stock"},{name:"Biofertilizer",strength:"1 kg pack",stock:110,unit:"packs",availability:"Available"}]},
];

const initialAmbulances: Facility[] = [
  {id:"A-231",name:"108-JH-231",type:"ambulance",district:"Ranchi",address:"RIMS emergency zone",lat:23.3895,lng:85.3468,phone:"108",status:"Available",details:"Advanced life support · GPS connected"},
  {id:"A-144",name:"108-JH-144",type:"ambulance",district:"East Singhbhum",address:"Sakchi response zone",lat:22.8140,lng:86.1958,phone:"108",status:"On route · 7 min",details:"Basic life support · GPS connected"},
  {id:"A-087",name:"108-JH-087",type:"ambulance",district:"Dhanbad",address:"Saraidhela response zone",lat:23.8020,lng:86.4230,phone:"108",status:"Available",details:"Advanced life support · GPS connected"},
  {id:"A-302",name:"108-JH-302",type:"ambulance",district:"Dumka",address:"Dumka Sadar response zone",lat:24.2730,lng:87.2520,phone:"108",status:"Available",details:"Basic life support · GPS connected"},
  {id:"A-055",name:"102-JH-055",type:"ambulance",district:"Hazaribagh",address:"District hospital response zone",lat:24.0040,lng:85.3680,phone:"102",status:"Patient transfer",details:"Mother & child transport · GPS connected"},
];

const layerConfig: {id: Layer; label: string; icon: ReactNode}[] = [
  {id:"all",label:"All services",icon:<PackageSearch/>},
  {id:"hospital",label:"Hospitals",icon:<Hospital/>},
  {id:"medicine",label:"Medicines",icon:<Pill/>},
  {id:"testing",label:"Water & soil tests",icon:<FlaskConical/>},
  {id:"fertilizer",label:"Fertilizer",icon:<Wheat/>},
  {id:"ambulance",label:"Ambulances",icon:<Ambulance/>},
];

const bookingTypes: {type: BookingType; label: string; hint: string; icon: ReactNode}[] = [
  {type:"Hospital",label:"Hospital OPD",hint:"Choose hospital and time",icon:<Hospital/>},
  {type:"Ambulance",label:"Ambulance",hint:"Request central dispatch",icon:<Ambulance/>},
  {type:"Fertilizer",label:"Fertilizer pickup",hint:"Reserve stock at centre",icon:<Wheat/>},
  {type:"Water Test",label:"Water test",hint:"Book sample testing",icon:<Droplets/>},
  {type:"Soil Test",label:"Soil test",hint:"Book soil health analysis",icon:<Sprout/>},
];

function distanceKm(a: Location, b: Location) {
  const toRad=(n:number)=>n*Math.PI/180;
  const dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);
  const value=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value));
}

function iconFor(type: Facility["type"]) {
  if(type==="hospital") return <Hospital/>;
  if(type==="medicine") return <Pill/>;
  if(type==="testing") return <FlaskConical/>;
  if(type==="fertilizer") return <Wheat/>;
  return <Ambulance/>;
}

function directionsUrl(item: Facility) {
  return `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
}

type RouteSummary = { distanceMeters: number; durationSeconds: number; path: Location[] };

function formatRoute(route: RouteSummary) {
  const km = (route.distanceMeters / 1000).toFixed(1);
  const minutes = Math.round(route.durationSeconds / 60);
  return `${km} km · ${minutes} min drive`;
}

// Calls our /api/directions edge route, which in turn calls the Mappls Route REST API
// server-side (the access token never reaches the browser). See lib/mappls.ts.
async function fetchDirections(origin: Location, destination: Location): Promise<RouteSummary> {
  const response = await fetch("/api/directions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination, profile: "driving" }),
  });
  const data = (await response.json()) as Partial<RouteSummary> & { error?: string };
  if (!response.ok) throw new Error(data?.error || "Could not calculate a route.");
  return data as RouteSummary;
}

function bedAvailability(item: Facility) {
  const base=Number(item.id.replace(/\D/g,""))||1;
  return [{name:"OPD",value:18+(base%9),unit:"slots"},{name:"General Ward",value:6+(base%12),unit:"beds"},{name:"ICU",value:1+(base%4),unit:"beds"},{name:"NICU",value:base%3,unit:"beds"}];
}

export default function ServicesHub({onOpenMap=()=>{}}:{onOpenMap?:()=>void}){
  const [layer,setLayer]=useState<Layer>("all");
  const [query,setQuery]=useState("");
  const [medicineQuery,setMedicineQuery]=useState("");
  const [location,setLocation]=useState<Location|null>(null);
  const [locating,setLocating]=useState(false);
  const [locationMessage,setLocationMessage]=useState("Use GPS to calculate nearest hospitals");
  const [selected,setSelected]=useState<Facility|null>(null);
  const [ambulances,setAmbulances]=useState(initialAmbulances);
  const [bookingOpen,setBookingOpen]=useState(false);
  const [bookingType,setBookingType]=useState<BookingType>("Hospital");
  const [bookingFacility,setBookingFacility]=useState("");
  const [bookingResult,setBookingResult]=useState("");

  useEffect(()=>{
    const timer=setInterval(()=>setAmbulances(current=>current.map((a,index)=>({
      ...a,
      lat:a.lat+(index%2===0?0.00008:-0.00006),
      lng:a.lng+(index%2===0?0.00005:0.00007),
    }))),5000);
    return()=>clearInterval(timer);
  },[]);

  const allFacilities=useMemo(()=>[...hospitals,...medicineCentres,...testingCentres,...fertilizerCentres,...ambulances],[ambulances]);
  const nearbyHospitals=useMemo(()=>hospitals.map(h=>({...h,distance:location?distanceKm(location,h):null})).sort((a,b)=>(a.distance??999)-(b.distance??999)),[location]);
  const medicineResults=useMemo(()=>medicineCentres.flatMap(c=>(c.stock||[]).map(stock=>({centre:c,stock}))).filter(row=>(row.stock.name+row.stock.strength+row.centre.name+row.centre.district).toLowerCase().includes(medicineQuery.toLowerCase())),[medicineQuery]);

  function useMyLocation(){
    if(!navigator.geolocation){setLocationMessage("GPS is not supported on this device");return}
    setLocating(true);setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      pos=>{setLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});setLocationMessage(`Location found · accuracy ${Math.round(pos.coords.accuracy)} m`);setLocating(false);setLayer("hospital")},
      ()=>{setLocationMessage("Location permission was not granted");setLocating(false)},
      {enableHighAccuracy:true,timeout:10000,maximumAge:30000}
    );
  }

  function openBooking(type: BookingType, facilityId=""){
    onOpenMap?.();
    setBookingType(type);setBookingFacility(facilityId);setBookingResult("");setBookingOpen(true);
  }

  return <div className="page services-page">
    <header className="services-head">
      <div><span>Citizen service network</span><h1>Find, track and book public services</h1><p>Hospitals, medicines, testing, fertilizers and emergency transport in one place.</p></div>
      <div className="services-head-actions"><button className="secondary locate-action" onClick={useMyLocation} disabled={locating}>{locating?<Loader2 className="spin"/>:<LocateFixed/>}{locating?"Finding GPS…":"Use my location"}</button><button className="primary" onClick={()=>openBooking("Hospital")}><CalendarDays/>Central booking</button></div>
    </header>

    <section className="service-quick-grid">
      {bookingTypes.map(item=><button key={item.type} onClick={()=>openBooking(item.type)}><i>{item.icon}</i><span><b>{item.label}</b><small>{item.hint}</small></span><ChevronRight/></button>)}
    </section>

    <section className="service-toolbar panel">
      <div className="service-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search centre, district or service"/></div>
      <div className="layer-tabs">{layerConfig.map(item=><button key={item.id} className={layer===item.id?"active":""} onClick={()=>{setLayer(item.id);setSelected(null)}}>{item.icon}{item.label}</button>)}</div>
    </section>
    <p className="location-status">{locationMessage} {location ? `· Closest match: ${nearbyHospitals[0]?.name || "No hospital nearby"}` : ""}</p>

    {selected&&<section className="panel selected-service-panel"><SelectedFacility item={selected} onBook={openBooking}/></section>}

    {layer==="all"&&<ServiceOverview onLayer={setLayer}/>}
    {layer==="hospital"&&<FacilityGrid title="Government hospitals" text="Find emergency care, OPD services and book a hospital slot." items={hospitals.filter(f=>(f.name+f.district).toLowerCase().includes(query.toLowerCase()))} onSelect={item=>{setSelected(item);requestAnimationFrame(()=>document.querySelector(".selected-service-panel")?.scrollIntoView({behavior:"smooth",block:"start"}))}} onBook={item=>openBooking("Hospital",item.id)}/>} 
    {layer==="medicine"&&<MedicineSection query={medicineQuery} setQuery={setMedicineQuery} rows={medicineResults} centres={medicineCentres} onSelect={setSelected}/>}
    {layer==="testing"&&<FacilityGrid title="Water & soil testing" text="Book government laboratory slots or mobile field collection." items={testingCentres.filter(f=>(f.name+f.district+f.details).toLowerCase().includes(query.toLowerCase()))} onSelect={setSelected} onBook={item=>openBooking((item.services||[]).includes("Water Test")?"Water Test":"Soil Test",item.id)}/>}
    {layer==="fertilizer"&&<FertilizerSection items={fertilizerCentres.filter(f=>(f.name+f.district+(f.stock||[]).map(s=>s.name).join(" ")).toLowerCase().includes(query.toLowerCase()))} onSelect={setSelected} onBook={item=>openBooking("Fertilizer",item.id)}/>}
    {layer==="ambulance"&&<AmbulanceSection items={ambulances} onSelect={setSelected} onBook={item=>openBooking("Ambulance",item.id)} onLocate={useMyLocation}/>}

    <div className="data-note"><CheckCircle2/><span><b>Working service prototype</b> Booking requests are saved centrally. Availability shown here is illustrative until official hospital, medicine, agriculture and 108 fleet feeds are connected.</span><em>{allFacilities.length} mapped services</em></div>
    <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} type={bookingType} facilityId={bookingFacility} location={location} result={bookingResult} setResult={setBookingResult}/>
  </div>
}

function markerPosition(item:{lat:number;lng:number}){
  const left=Math.max(2,Math.min(98,(item.lng-83.3)/(87.95-83.3)*100));
  const top=Math.max(2,Math.min(98,(25.4-item.lat)/(25.4-21.9)*100));
  return {left:`${left}%`,top:`${top}%`};
}

// Same lng/lat -> % projection as markerPosition, but as numbers for an SVG polyline.
function routePoint(item:{lat:number;lng:number}){
  const x=Math.max(0,Math.min(100,(item.lng-83.3)/(87.95-83.3)*100));
  const y=Math.max(0,Math.min(100,(25.4-item.lat)/(25.4-21.9)*100));
  return `${x},${y}`;
}

function MapStyleControls({value,onChange}:{value:MapStyle;onChange:(style:MapStyle)=>void}){
  return <div className="map-style-controls"><button className={value==="default"?"active":""} onClick={()=>onChange("default")}><Map/>Default</button><button className={value==="satellite"?"active":""} onClick={()=>onChange("satellite")}><Satellite/>Satellite</button><button className={value==="terrain"?"active":""} onClick={()=>onChange("terrain")}><Mountain/>Terrain</button></div>
}

function PublicMapCanvas({mapStyle,facilities,selected,onSelect,location,route,large=false}:{mapStyle:MapStyle;facilities:Facility[];selected:Facility|null;onSelect:(item:Facility)=>void;location:Location|null;route?:RouteSummary|null;large?:boolean}){
  return <div className={`service-map ${large?"large-map":""} map-${mapStyle}`} aria-label={`${mapStyle} map of Jharkhand public services`}>
    <iframe className={`real-map map-${mapStyle}`} title="Real map of Jharkhand" src="https://www.openstreetmap.org/export/embed.html?bbox=83.55%2C21.9%2C87.95%2C25.55&amp;layer=mapnik"/>
    {route&&route.path.length>1&&<svg className="route-line" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={route.path.map(routePoint).join(" ")} vectorEffect="non-scaling-stroke"/></svg>}
    <div className="service-map-markers">{facilities.map(item=><button key={item.id} className={`${item.type} ${selected?.id===item.id?"selected":""}`} style={markerPosition(item)} onClick={()=>onSelect(item)} title={item.name}>{iconFor(item.type)}</button>)}{location&&<button className="user-marker" style={markerPosition({lat:location.lat,lng:location.lng})} title="Your live GPS location"><Navigation/></button>}</div>
    <div className="map-layer-label">{mapStyle==="satellite"?"Satellite imagery":mapStyle==="terrain"?"Terrain relief":"Road map"}</div>
    <div className="service-map-key"><span><i className="hospital"></i>Hospital</span><span><i className="medicine"></i>Medicine</span><span><i className="testing"></i>Testing</span><span><i className="fertilizer"></i>Fertilizer</span><span><i className="ambulance"></i>Ambulance</span>{location&&<span><i className="user"></i>Your GPS</span>}</div>
  </div>
}

export function MapCentre(){
  const [layer,setLayer]=useState<Layer>("all");
  const [mapStyle,setMapStyle]=useState<MapStyle>("default");
  const [location,setLocation]=useState<Location|null>(null);
  const [selected,setSelected]=useState<Facility|null>(null);
  const [tracking,setTracking]=useState(false);
  const [message,setMessage]=useState("Start GPS tracking to show your live position and nearby services.");
  const [bookingOpen,setBookingOpen]=useState(false);
  const [bookingType,setBookingType]=useState<BookingType>("Hospital");
  const [bookingFacility,setBookingFacility]=useState("");
  const [bookingResult,setBookingResult]=useState("");
  const [ambulances,setAmbulances]=useState(initialAmbulances);
  const [route,setRoute]=useState<RouteSummary|null>(null);
  const [routeLoading,setRouteLoading]=useState(false);
  const [routeError,setRouteError]=useState<string|null>(null);
  const allFacilities=[...hospitals,...medicineCentres,...testingCentres,...fertilizerCentres,...ambulances];
  const facilities=allFacilities.filter(item=>layer==="all"||item.type===layer);

  useEffect(()=>{const timer=setInterval(()=>setAmbulances(current=>current.map((ambulance,index)=>({...ambulance,lat:ambulance.lat+(index%2?-.00007:.00008),lng:ambulance.lng+(index%2?.00008:-.00006)}))),5000);return()=>clearInterval(timer)},[]);

  function toggleTracking(){
    if (tracking) {
      setTracking(false);
      setMessage("GPS tracking paused.");
      return;
    }
    if(!navigator.geolocation){setMessage("GPS is not available on this device.");return}
    if(!window.isSecureContext){setMessage("GPS requires a secure HTTPS connection.");return}
    setTracking(true);
    setMessage("Waiting for location permission…");
  }

  useEffect(()=>{
    if(!tracking) return;
    const watchId=navigator.geolocation.watchPosition(
      pos=>{setLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});setMessage(`Live GPS active · accuracy ${Math.round(pos.coords.accuracy)} m`)},
      error=>{setMessage(error.code===1?"Location permission was denied. Enable it in your browser settings and try again.":"Could not get a GPS signal. Move outside or try again.");setTracking(false)},
      {enableHighAccuracy:true,maximumAge:10000,timeout:15000}
    );
    return()=>navigator.geolocation.clearWatch(watchId);
  },[tracking]);

  function openBooking(type:BookingType,id?:string){setBookingType(type);setBookingFacility(id||"");setBookingResult("");setBookingOpen(true)}

  async function requestRoute(item:Facility){
    if(!location){setRouteError("Start GPS tracking first so we know your starting point.");return}
    setRouteLoading(true);setRouteError(null);
    try{
      const result=await fetchDirections(location,{lat:item.lat,lng:item.lng});
      setRoute(result);
    }catch(error){
      setRoute(null);
      setRouteError(error instanceof Error?error.message:"Could not calculate a route.");
    }finally{
      setRouteLoading(false);
    }
  }

  function selectFacility(item:Facility|null){setSelected(item);setRoute(null);setRouteError(null)}

  return <div className="page map-centre-page"><header className="map-centre-head"><div><span>Live geographic operations</span><h1>Jharkhand service map</h1><p>Switch map layers, track your GPS, and see hospitals, stocks, labs and ambulances in one operational view.</p></div><button className={tracking?"secondary tracking-active":"primary"} onClick={toggleTracking}><LocateFixed/>{tracking?"Stop GPS tracking":"Start GPS tracking"}</button></header><section className="map-centre-toolbar panel"><div className="map-layer-pills">{layerConfig.map(item=><button key={item.id} className={layer===item.id?"active":""} onClick={()=>{setLayer(item.id);selectFacility(null)}}>{item.icon}{item.label}</button>)}</div><MapStyleControls value={mapStyle} onChange={setMapStyle}/></section><section className="large-map-shell panel"><header><div><h2>Service locations</h2><p>{message}</p></div><span className="live-feed"><i></i>{facilities.length} mapped points</span></header><PublicMapCanvas mapStyle={mapStyle} facilities={facilities} selected={selected} onSelect={selectFacility} location={location} route={route} large/></section>{selected&&<section className="map-selected panel"><SelectedFacility item={selected} onBook={openBooking} onRoute={()=>requestRoute(selected)} route={route} routeLoading={routeLoading} routeError={routeError}/></section>}<BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} type={bookingType} facilityId={bookingFacility} location={location} result={bookingResult} setResult={setBookingResult}/></div>
}

function ServiceOverview({onLayer}:{onLayer:(layer:Layer)=>void}){
  const cards=[
    {layer:"hospital" as Layer,icon:<Hospital/>,number:"8",title:"Government hospitals",text:"Emergency, OPD and specialist services"},
    {layer:"medicine" as Layer,icon:<Pill/>,number:"5",title:"Medicine centres",text:"Search essential medicine availability"},
    {layer:"testing" as Layer,icon:<FlaskConical/>,number:"4",title:"Testing laboratories",text:"Water quality and soil health tests"},
    {layer:"fertilizer" as Layer,icon:<Wheat/>,number:"4",title:"Fertilizer centres",text:"Check and reserve subsidised stock"},
    {layer:"ambulance" as Layer,icon:<Ambulance/>,number:"5",title:"GPS ambulances",text:"View response status on the map"},
  ];
  return <section className="service-section"><div className="service-section-head"><div><h2>Services availability</h2><p>Choose a service to view locations, availability and booking options.</p></div></div><div className="availability-grid">{cards.map(card=><button key={card.layer} onClick={()=>onLayer(card.layer)}><i>{card.icon}</i><span><b>{card.title}</b><small>{card.text}</small></span><strong>{card.number}<small> locations</small></strong><ChevronRight/></button>)}</div></section>
}

function SelectedFacility({item,onBook,onRoute,route,routeLoading,routeError}:{item:Facility;onBook:(type:BookingType,id?:string)=>void;onRoute?:()=>void;route?:RouteSummary|null;routeLoading?:boolean;routeError?:string|null}){
  const bookingType:BookingType=item.type==="hospital"?"Hospital":item.type==="ambulance"?"Ambulance":item.type==="fertilizer"?"Fertilizer":(item.services||[]).includes("Water Test")?"Water Test":"Soil Test";
  return <div className="selected-facility"><div className={`facility-symbol ${item.type}`}>{iconFor(item.type)}</div><span className="facility-status"><i></i>{item.status}</span><h3>{item.name}</h3><p><MapPin/>{item.address}</p><p><Phone/>{item.phone}</p><small>{item.details}</small>{item.type==="hospital"&&<div className="bed-availability"><b>Bed availability</b><div>{bedAvailability(item).map(bed=><span key={bed.name} className={bed.value<3?"low":""}><small>{bed.name}</small><strong>{bed.value}</strong><em>{bed.unit} available</em></span>)}</div></div>}{item.services&&<div className="mini-tags">{item.services.map(x=><b key={x}>{x}</b>)}</div>}<div className="selected-actions"><a href={directionsUrl(item)} target="_blank" rel="noreferrer"><Navigation/>Directions</a>{onRoute&&<button className="secondary" onClick={onRoute} disabled={routeLoading}>{routeLoading?<Loader2 className="spin"/>:<Navigation/>}{routeLoading?"Calculating…":"Live route"}</button>}{item.type!=="medicine"&&<button onClick={()=>onBook(bookingType,item.id)}><CalendarDays/>Book now</button>}</div>{route&&<p className="route-summary"><Navigation/>{formatRoute(route)}</p>}{routeError&&<p className="form-error">{routeError}</p>}</div>
}

function FacilityGrid({title,text,items,onSelect,onBook}:{title:string;text:string;items:Facility[];onSelect:(item:Facility)=>void;onBook:(item:Facility)=>void}){
  return <section className="service-section"><div className="service-section-head"><div><h2>{title}</h2><p>{text}</p></div><span>{items.length} results</span></div><div className="facility-grid">{items.map(item=><article className="panel facility-card" key={item.id}><div className="facility-card-top"><div className={`facility-symbol ${item.type}`}>{iconFor(item.type)}</div><span className="facility-status"><i></i>{item.status}</span></div><h3>{item.name}</h3><p><MapPin/>{item.address}</p><small>{item.details}</small>{item.services&&<div className="mini-tags">{item.services.map(s=><b key={s}>{s}</b>)}</div>}{item.stock&&<div className="stock-preview">{item.stock.slice(0,3).map(s=><span key={s.name}><b>{s.name}</b><small>{s.stock} {s.unit}</small></span>)}</div>}<footer><button onClick={()=>onSelect(item)}><ClipboardList/>View details</button><button className="book-button" onClick={()=>onBook(item)}>Book<ChevronRight/></button></footer></article>)}</div></section>
}

function FertilizerSection({items,onSelect,onBook}:{items:Facility[];onSelect:(item:Facility)=>void;onBook:(item:Facility)=>void}){
  const findStock=(item:Facility,term:string)=>(item.stock||[]).find(stock=>stock.name.toLowerCase().includes(term))?.stock||0;
  const totals={urea:items.reduce((sum,item)=>sum+findStock(item,"urea"),0),dap:items.reduce((sum,item)=>sum+findStock(item,"dap"),0),npk:items.reduce((sum,item)=>sum+findStock(item,"npk"),0)};
  return <section className="service-section fertilizer-section"><div className="service-section-head"><div><h2>Fertilizer stock by location</h2><p>Urea, DAP and NPK balances available at participating government centres.</p></div><span>{items.length} centres</span></div><div className="fertilizer-totals"><article><Wheat/><span><small>Urea remaining</small><b>{totals.urea} <em>bags</em></b></span></article><article><Sprout/><span><small>DAP remaining</small><b>{totals.dap} <em>bags</em></b></span></article><article><PackageSearch/><span><small>NPK remaining</small><b>{totals.npk} <em>bags</em></b></span></article></div><div className="fertilizer-table panel"><div className="fertilizer-table-head"><span>Centre and location</span><span>Urea</span><span>DAP</span><span>NPK</span><span>Action</span></div>{items.map(item=><div key={item.id}><span><b>{item.name}</b><small>{item.district} · {item.address}</small></span><span>{stockCell(findStock(item,"urea"))}</span><span>{stockCell(findStock(item,"dap"))}</span><span>{stockCell(findStock(item,"npk"))}</span><button onClick={()=>onBook(item)}>Reserve stock</button><button className="show-stock-map" onClick={()=>onSelect(item)}><MapPin/>Map</button></div>)}</div><FacilityGrid title="Fertilizer centres" text="View centre details, stock and pickup booking." items={items} onSelect={onSelect} onBook={onBook}/></section>
}

function stockCell(stock:number){return stock>0?<><b>{stock}</b><small className={stock<25?"stock-low":"stock-ok"}>{stock<25?"Low stock":"Available"}</small></>:<small className="stock-low">Not stocked</small>}

function MedicineSection({query,setQuery,rows,centres,onSelect}:{query:string;setQuery:(q:string)=>void;rows:{centre:Facility;stock:Stock}[];centres:Facility[];onSelect:(item:Facility)=>void}){
  return <section className="service-section medicine-section"><div className="medicine-hero panel"><div><span>Government medicine finder</span><h2>Check medicine availability before you travel</h2><p>Search by medicine name, strength, centre or district.</p></div><div className="medicine-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try Paracetamol, ORS, Metformin…"/><b>{rows.length} matches</b></div></div><div className="medicine-table panel"><div className="medicine-table-head"><span>Medicine</span><span>Government centre</span><span>District</span><span>Stock</span><span>Status</span></div>{rows.map((row,index)=><button key={`${row.centre.id}-${row.stock.name}-${index}`} onClick={()=>onSelect(row.centre)}><span><Pill/><b>{row.stock.name}</b><small>{row.stock.strength||"Standard pack"}</small></span><span>{row.centre.name}</span><span>{row.centre.district}</span><span><b>{row.stock.stock}</b> {row.stock.unit}</span><span className={row.stock.availability==="Available"?"stock-ok":"stock-low"}>{row.stock.availability}</span></button>)}{rows.length===0&&<div className="empty-service"><PackageSearch/><b>No medicine matched your search</b><span>Try a generic name, centre or district.</span></div>}</div><div className="service-section-head centre-heading"><div><h2>Government medicine centres</h2><p>Select a centre to view it on the map and get directions.</p></div></div><div className="facility-grid medicine-centres">{centres.map(item=><article className="panel facility-card" key={item.id}><div className="facility-card-top"><div className="facility-symbol medicine"><Pill/></div><span className="facility-status"><i></i>{item.status}</span></div><h3>{item.name}</h3><p><MapPin/>{item.address}</p><small>{item.details}</small><footer><button onClick={()=>onSelect(item)}><MapPin/>Show on map</button><a href={directionsUrl(item)} target="_blank" rel="noreferrer">Directions<Navigation/></a></footer></article>)}</div></section>
}

function AmbulanceSection({items,onSelect,onBook,onLocate}:{items:Facility[];onSelect:(item:Facility)=>void;onBook:(item:Facility)=>void;onLocate:()=>void}){
  return <section className="service-section"><div className="ambulance-banner"><div><span><i></i>GPS fleet tracker</span><h2>Ambulances on the Jharkhand map</h2><p>Live vehicle status, assigned routes and central emergency dispatch.</p></div><div><button className="secondary" onClick={onLocate}><LocateFixed/>Find nearest</button><button className="emergency-button" onClick={()=>onBook(items[0])}><Phone/>Request ambulance</button></div></div><div className="dispatch-strip panel"><div><span>Active dispatch</span><b>#JS-2048 · JH-01-2048</b><small>Ranchi response zone → RIMS Hospital</small></div><div><span>Driver</span><b>S. Kumar</b><small>GPS refreshed just now</small></div><div><span>Arrival</span><b>4 min</b><small>38 km/h · route active</small></div><button onClick={()=>onSelect(items[0])}>Open live tracking<Navigation/></button></div><div className="ambulance-grid">{items.map(item=><article className="panel ambulance-card" key={item.id}><div className="ambulance-vehicle"><Ambulance/><span><b>{item.name}</b><small>{item.district} fleet</small></span><i className={item.status==="Available"?"available":"busy"}></i></div><p><MapPin/>{item.address}</p><div className="gps-row"><Navigation/><span><b>GPS connected</b><small>Position refreshed every 5 seconds</small></span><strong>{item.status}</strong></div><footer><button onClick={()=>onSelect(item)}>Show on map</button><button onClick={()=>onBook(item)}>Book dispatch</button></footer></article>)}</div></section>
}

function facilitiesFor(type:BookingType,ambulances=initialAmbulances){
  if(type==="Hospital") return hospitals;
  if(type==="Ambulance") return ambulances;
  if(type==="Fertilizer") return fertilizerCentres;
  return testingCentres.filter(item=>(item.services||[]).includes(type));
}

function BookingDialog({open,onOpenChange,type,facilityId,location,result,setResult}:{open:boolean;onOpenChange:(open:boolean)=>void;type:BookingType;facilityId:string;location:Location|null;result:string;setResult:(value:string)=>void}){
  const [currentType,setCurrentType]=useState<BookingType>(type);
  const [currentFacility,setCurrentFacility]=useState(facilityId);
  const [doctorId,setDoctorId]=useState("");
  const [slot,setSlot]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const options=facilitiesFor(currentType);
  const resolvedFacility = options.some(o=>o.id===currentFacility) ? currentFacility : (options[0]?.id || "");
  const availableDoctors=doctors.filter(doctor=>doctor.hospitalId===resolvedFacility);
  const selectedDoctor=availableDoctors.find(doctor=>doctor.id===doctorId) ?? availableDoctors[0] ?? null;
  const availableSlots=currentType==="Hospital" ? (selectedDoctor?.slots || []) : (options.find(item=>item.id===resolvedFacility)?.slots || ["09:00–11:00","11:00–13:00","14:00–16:00"]);
  const resolvedSlot = currentType === "Ambulance" ? "" : (availableSlots.includes(slot) ? slot : (availableSlots[0] || ""));

  function resetDialog(nextType: BookingType, nextFacilityId: string) {
    setCurrentType(nextType);
    setCurrentFacility(nextFacilityId || facilitiesFor(nextType)[0]?.id || "");
    setDoctorId("");
    setSlot("");
    setError("");
  }

  function handleOpenChange(value:boolean) {
    onOpenChange(value);
    if (!value) {
      setResult("");
      return;
    }
    resetDialog(type, facilityId);
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");
    const form=new FormData(event.currentTarget);const facility=options.find(o=>o.id===currentFacility)||options[0];
    const citizenName=String(form.get("citizenName")||"").trim();
    const phone=String(form.get("phone")||"").replace(/\D/g,"");
    if(!facility){setError("Please choose a service centre.");setSaving(false);return}
    if(citizenName.length<2){setError(currentType==="Hospital"||currentType==="Ambulance"?"Enter the patient's full name.":"Enter the applicant's full name.");setSaving(false);return}
    if(phone.length!==10){setError("Enter a valid 10-digit mobile number.");setSaving(false);return}
    if(currentType!=="Ambulance"&&!resolvedSlot){setError("Choose an available slot.");setSaving(false);return}
    try{
      const response=await fetch("/api/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:"serviceBooking",serviceType:currentType,facilityId:facility.id,facilityName:facility.name,citizenName,phone,district:facility.district,bookingDate:form.get("bookingDate"),timeSlot:currentType==="Ambulance"?"Immediate dispatch":resolvedSlot,doctorName:currentType==="Hospital"?selectedDoctor?.name:null,doctorSpecialty:currentType==="Hospital"?selectedDoctor?.specialty:null,quantity:currentType==="Fertilizer"?form.get("quantity"):null,notes:form.get("notes"),latitude:location?.lat,longitude:location?.lng,
      })});
      const data=await response.json() as {id?:string;error?:string};
      if(!response.ok) throw new Error(data.error||"Booking could not be saved.");
      setResult(data.id||"Booking confirmed");
    }catch(reason){setError(reason instanceof Error?reason.message:"Booking could not be saved.")}finally{setSaving(false)}
  }

  const today=new Date().toISOString().slice(0,10);
  return <Dialog open={open} onOpenChange={handleOpenChange}><DialogContent className="booking-dialog">{result?<div className="booking-success"><CheckCircle2/><span>{currentType==="Ambulance"?"Dispatch notified":"Request submitted"}</span><DialogTitle>Your booking ID is {result}</DialogTitle><DialogDescription>{currentType==="Ambulance"?"The ambulance control room received this dispatch request. Track the assigned vehicle from the Ambulances map layer.":"Keep this number for status updates. The selected centre will verify your request."}</DialogDescription><button className="primary" onClick={()=>onOpenChange(false)}>Done</button></div>:<><DialogHeader><span className="dialog-eyebrow">JanSamadhan central booking</span><DialogTitle>{currentType==="Ambulance"?"Request ambulance dispatch":"Book a public service"}</DialogTitle><DialogDescription>{currentType==="Hospital"?"Select a hospital, available doctor and confirmed OPD slot.":"One form for ambulance, fertilizer and testing requests."}</DialogDescription></DialogHeader><form onSubmit={submit} className="booking-form"><div className="booking-types">{bookingTypes.map(item=><button type="button" key={item.type} className={currentType===item.type?"active":""} onClick={()=>resetDialog(item.type, facilitiesFor(item.type)[0]?.id || "")}>{item.icon}<span>{item.label}</span></button>)}</div><label>Service centre<select value={resolvedFacility} onChange={e=>{setCurrentFacility(e.target.value);setDoctorId("");setSlot("")}} required>{options.map(item=><option key={item.id} value={item.id}>{item.name} — {item.district}</option>)}</select></label>{currentType==="Hospital"&&<><label>Available doctor<select value={selectedDoctor?.id || ""} onChange={e=>{setDoctorId(e.target.value);setSlot("")}}>{availableDoctors.length?availableDoctors.map(doctor=><option key={doctor.id} value={doctor.id}>{doctor.name} — {doctor.specialty} · {doctor.availability}</option>):<option value="">General OPD — doctor assigned at hospital</option>}</select></label><div className="doctor-availability"><CheckCircle2/><span><b>{selectedDoctor?.name||"General OPD"}</b><small>{selectedDoctor?.specialty||"Doctor allocated by the hospital"} · slots updated live</small></span></div></>}<div className="two"><label>{currentType==="Hospital"||currentType==="Ambulance"?"Patient name":"Applicant name"}<input name="citizenName" placeholder="Full name" required/></label><label>Mobile number<input name="phone" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10-digit number" required/></label></div><div className="two"><label>Date<input name="bookingDate" type="date" min={today} defaultValue={today} required/></label>{currentType==="Ambulance"?<label>Dispatch priority<input value="Immediate dispatch" readOnly/></label>:<label>Available slot<select name="timeSlot" value={slot} onChange={e=>setSlot(e.target.value)} required>{availableSlots.map(item=><option key={item} value={item}>{item} · Booking open</option>)}</select></label>}</div>{currentType==="Fertilizer"&&<label>Quantity (bags)<input name="quantity" type="number" min="1" max="100" defaultValue="1" required/></label>}<label>{currentType==="Ambulance"?"Pickup address and patient condition":"Additional details"}<textarea name="notes" placeholder={currentType==="Ambulance"?"Patient condition, pickup landmark and contact person":"Prescription, sample type, crop or other relevant details"}/></label>{location&&<div className="booking-location"><LocateFixed/><span>GPS location will be attached to this request</span></div>}{error&&<div className="booking-error">{error}</div>}<DialogFooter><button type="button" className="secondary" onClick={()=>onOpenChange(false)}>Cancel</button><button className="primary" disabled={saving}>{saving?<Loader2 className="spin"/>:<CalendarDays/>}{saving?"Submitting…":currentType==="Ambulance"?"Notify ambulance control":"Confirm booking"}</button></DialogFooter></form></>}</DialogContent></Dialog>
}
