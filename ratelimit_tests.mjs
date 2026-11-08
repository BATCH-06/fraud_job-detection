import fs from 'fs';
const B='http://localhost:3000';const out=[];
const rec=(id,scenario,input,expected,actual,pass)=>{out.push({id,type:'Security / Rate limit',scenario,input,expected,actual,status:pass?'PASS':'FAIL'});console.log(`${pass?'PASS':'FAIL'}  ${id}  ${scenario}\n      actual: ${actual}`)};
const post=(p,b)=>fetch(B+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
const codes=[];for(let i=0;i<7;i++){const r=await post('/api/analyze',{text:'Pay a registration fee of Rs 500 to confirm your internship '+i});codes.push(r.status);if(i===6){var last=await r.json().catch(()=>null)}}
rec('RL-01','Check requests are limited per minute (set to 5 for this test)','7 checks in a row','First 5 return 200, the rest HTTP 429 with a JSON message',`codes: ${codes.join(',')}; message: ${last?.error?.slice(0,50)}`,codes.slice(0,5).every(c=>c===200)&&codes.slice(5).every(c=>c===429)&&!!last?.error);
const rc=[];for(let i=0;i<5;i++){const r=await post('/api/auth?action=register',{name:'Rate Test',email:`rl${i}-${Date.now()}@example.com`,password:'password123'});rc.push(r.status)}
rec('RL-02','New accounts are limited per hour (set to 3 for this test)','5 sign-ups in a row','First 3 return 201, the rest HTTP 429',`codes: ${rc.join(',')}`,rc.slice(0,3).every(c=>c===201)&&rc.slice(3).every(c=>c===429));
fs.writeFileSync('tests/results/ratelimit.json',JSON.stringify(out,null,2));
