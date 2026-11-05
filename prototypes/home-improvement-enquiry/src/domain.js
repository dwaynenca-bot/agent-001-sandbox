// Fictional GBP demo rates only. Edit here; never use as market pricing.
export const RULES = {version:'DEMO-1', setup:180, spread:0.2, roofing:{Repair:35,Replacement:95}, roughcasting:{Repair:28,'Full application':65}, openings:{windows:420,doors:850}};
export const SERVICES = {roofing:'Roofing',roughcasting:'Roughcasting',openings:'Windows & Doors'};
export const STATUSES = ['New','Reviewing','Contacted','Closed'];
export function calculate(d) {
 const n=(v,min,max)=>{const x=Number(v);if(!Number.isFinite(x)||x<min||x>max)throw Error('Measurements are outside demo limits.');return x;};
 let lines;
 if(d.service==='openings') {const w=n(d.windows,0,50),doors=n(d.doors,0,20);if(!Number.isInteger(w)||!Number.isInteger(doors)||w+doors===0)throw Error('Enter at least one window or door, using whole numbers.');lines=[{label:`${w} windows × £${RULES.openings.windows}`,amount:w*RULES.openings.windows},{label:`${doors} doors × £${RULES.openings.doors}`,amount:doors*RULES.openings.doors}];}
 else {const rate=RULES[d.service]?.[d.work];if(!rate)throw Error('Select valid work.');const area=n(d.area,1,1000);lines=[{label:`${area} m² × £${rate}`,amount:area*rate}];}
 lines.push({label:'Demo setup allowance',amount:RULES.setup});const total=lines.reduce((s,l)=>s+l.amount,0);return {version:RULES.version,lines,total,low:Math.round(total*(1-RULES.spread)),high:Math.round(total*(1+RULES.spread))};
}
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function validateAppointment(date,time,today=localDate()){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&date>today&&['09:00','11:00','14:00','16:00'].includes(time);}
export function filterEnquiries(rows,q='',service='',status=''){return rows.filter(r=>(!service||r.service===service)&&(!status||r.status===status)&&[r.name,r.location,r.id,r.email,SERVICES[r.service]].join(' ').toLowerCase().includes(q.toLowerCase()));}
export const KEY='hearth-demo-enquiries-v1';
export function samples(){return [{id:'DEMO-1001',name:'Alex Morgan',email:'alex@example.test',phone:'07000 000001',location:'Glasgow, G12',property:'Semi-detached',service:'roofing',work:'Repair',area:35,notes:'A few loose tiles near the chimney.',date:'2026-12-10',time:'11:00',status:'New'},{id:'DEMO-1002',name:'Sam Taylor',email:'sam@example.test',phone:'07000 000002',location:'Paisley, PA1',property:'Detached',service:'roughcasting',work:'Full application',area:90,notes:'Front and side elevations.',date:'2026-12-12',time:'14:00',status:'Reviewing'},{id:'DEMO-1003',name:'Jamie Campbell',email:'jamie@example.test',phone:'07000 000003',location:'Stirling, FK8',property:'Terraced',service:'openings',work:'Replacement',windows:6,doors:1,notes:'Replace existing frames.',date:'2026-12-15',time:'09:00',status:'Contacted'}].map(r=>({...r,quote:calculate(r)}));}
export function load(storage){const raw=storage.getItem(KEY);if(raw===null)return samples();const rows=JSON.parse(raw);if(!Array.isArray(rows)||rows.some(r=>!r.id||!SERVICES[r.service]||!STATUSES.includes(r.status)||!r.quote?.lines))throw Error('Saved demo data is invalid.');return rows;}
