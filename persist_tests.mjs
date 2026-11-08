import fs from 'fs';
const B='http://localhost:3000'; const phase=process.argv[2];
const j=async(m,p,b,t)=>{const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:b?JSON.stringify(b):undefined});let d;try{d=await r.json()}catch{d=null}return{s:r.status,d}};
if(phase==='1'){
  const email=`persist-${Date.now()}@example.com`;
  const reg=await j('POST','/api/auth?action=register',{name:'Persist User',email,password:'password123'});
  const a=await j('POST','/api/analyze',{text:'Pay a registration fee of Rs 750 to confirm your internship seat today.',jobTitle:'PersistProbe'},reg.d.token);
  const bad=await j('POST','/api/history',{record:{id:'persist-bad-1',risk_category:'X',risk_score:'abc',raw_text:'bad record text'}},reg.d.token);
  const h=await j('GET','/api/history',null,reg.d.token);
  fs.writeFileSync('tests/results/persist_state.json',JSON.stringify({email,token:reg.d.token,id:a.d.recordId,count:h.d.records.length}));
  console.log(`PHASE1 (server #1): registered ${email}; saved ${a.d.recordId}; invalid POST -> HTTP ${bad.s}; records=${h.d.records.length}`);
} else {
  const p=JSON.parse(fs.readFileSync('tests/results/persist_state.json','utf8'));
  const login=await j('POST','/api/auth?action=login',{email:p.email,password:'password123'});
  const old=await j('GET','/api/auth?action=me',null,p.token);
  const h=await j('GET','/api/history',null,login.d?.token);
  const found=h.d?.records?.some(r=>r.id===p.id), badFound=h.d?.records?.some(r=>r.id==='persist-bad-1');
  console.log(`PHASE2 (NEW server process): login HTTP ${login.s}; old token still valid HTTP ${old.s}; records=${h.d?.records?.length} (was ${p.count}); valid record survived=${found}; invalid record present=${badFound}`);
  fs.writeFileSync('tests/results/persist.json',JSON.stringify({loginStatus:login.s,oldTokenStatus:old.s,before:p.count,after:h.d?.records?.length,found,badFound},null,2));
}
