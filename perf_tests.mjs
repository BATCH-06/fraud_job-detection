import fs from 'fs';
const B='http://localhost:3000'; const out=[];
async function timed(path,opt,timeout=40000){const t0=Date.now();const ac=new AbortController();const to=setTimeout(()=>ac.abort(),timeout);try{const r=await fetch(B+path,{...opt,signal:ac.signal});await r.text();return{s:r.status,ms:Date.now()-t0}}catch(e){return{s:0,ms:Date.now()-t0}}finally{clearTimeout(to)}}
const post=text=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
const rec=(id,type,scenario,input,expected,actual,pass)=>{pass=pass===true;out.push({id,type,scenario,input,expected,actual,status:pass?'PASS':'FAIL'});console.log(`${pass?'PASS':'FAIL'}  ${id}  ${scenario}\n      actual: ${actual}`)};
const rows=[];let ok=true;
for(const [name,ch] of [['letters','a'],['digits','1']]) for(const n of [9900,20000,80000]){const r=await timed('/api/analyze',post('Apply now. '+ch.repeat(n)));rows.push(`${name} ${n}: HTTP ${r.s} ${r.ms} ms`);if(r.ms>=2000||r.s===0)ok=false}
rec('PF-02','Performance','Long input without spaces (regex stress)','9,900 (largest accepted) / 20,000 / 80,000 characters of "a" and of "1"','Each request answered in under 2 s',rows.join('; '),ok);
const heavy=timed('/api/analyze',post('Apply now. '+'a'.repeat(9900)),60000);await new Promise(r=>setTimeout(r,50));
const ping=await timed('/api/system-status',{},60000);const hv=await heavy;
rec('PF-03','Performance','Server stays responsive during a heavy request','10,000-character check, then a status ping 50 ms later','Ping answered in under 1 s',`heavy ${hv.ms} ms; ping ${ping.ms} ms (HTTP ${ping.s})`,ping.ms<1000&&ping.s===200);
fs.writeFileSync('tests/results/perf.json',JSON.stringify(out,null,2));
