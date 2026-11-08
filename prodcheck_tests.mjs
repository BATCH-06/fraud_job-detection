import fs from 'fs';
const B='http://localhost:3000';const out=[];
const rec=(id,scenario,input,expected,actual,pass)=>{out.push({id,type:'System / Production mode',scenario,input,expected,actual,status:pass?'PASS':'FAIL'});console.log(`${pass?'PASS':'FAIL'}  ${id}  ${scenario}\n      actual: ${actual}`)};
const home=await fetch(B+'/');const ht=await home.text();
rec('PR-01','Production mode (npm start) serves the built website','GET /','HTTP 200 and the built bundle',`HTTP ${home.status}; bundle served=${/assets\/index-.*\.js/.test(ht)}`,home.status===200&&/assets\/index-.*\.js/.test(ht));
const bad=await fetch(B+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"text": "broken'});const bt=await bad.text();
rec('PR-02','Error page does not reveal file paths','Malformed JSON to /api/analyze','No stack trace or path',`HTTP ${bad.status}; leaked=${/node_modules|\/home\/|\.js:\d+/.test(bt)}`,!/node_modules|\/home\/|\.js:\d+/.test(bt));
let isJson=false;try{JSON.parse(bt);isJson=true}catch{}
rec('PR-03','Error response is JSON','Malformed JSON to /api/analyze','JSON error message',`HTTP ${bad.status}; ${bt.slice(0,70)}`,isJson&&bad.status===400);
const st=await fetch(B+'/api/system-status');
rec('PR-04','X-Powered-By hidden, Content-Security-Policy present','GET /api/system-status','No X-Powered-By; CSP present',`X-Powered-By=${st.headers.get('x-powered-by')}; CSP=${(st.headers.get('content-security-policy')||'').slice(0,40)}...`,!st.headers.get('x-powered-by')&&!!st.headers.get('content-security-policy'));
const unk=await fetch(B+'/api/nonexistent');const ut=await unk.text();
rec('PR-05','Unknown API address returns a JSON 404','GET /api/nonexistent','HTTP 404 JSON',`HTTP ${unk.status} ${unk.headers.get('content-type')}`,unk.status===404&&/json/.test(unk.headers.get('content-type')||''));
const spa=await fetch(B+'/some/page');
rec('PR-06','Unknown website page falls back to the app (single-page app)','GET /some/page','HTTP 200 index.html',`HTTP ${spa.status}`,spa.status===200);
const html=await home.headers.get('content-security-policy');
rec('PR-07','Website itself carries the security policy','GET /','CSP and X-Frame-Options on the HTML page',`CSP=${!!html}; X-Frame-Options=${home.headers.get('x-frame-options')}`,!!html&&home.headers.get('x-frame-options')==='DENY');
fs.writeFileSync('tests/results/prod.json',JSON.stringify(out,null,2));
