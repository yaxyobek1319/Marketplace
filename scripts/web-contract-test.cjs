const assert=require('node:assert/strict');
const base=process.env.WEB_TEST_URL||'http://127.0.0.1:3000';
async function request(path,options={}){return fetch(`${base}/api/backend/${path}`,options);}
async function main(){
let r=await request('auth/staff/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://untrusted.invalid'},body:'{}'});assert.equal(r.status,403,'reject cross-origin writes');
r=await request('auth/refresh',{method:'POST',headers:{origin:base},body:'{}'});assert.equal(r.status,404,'no token refresh exposure');
r=await request('payments/webhooks/test',{method:'POST',headers:{origin:base},body:'{}'});assert.equal(r.status,404,'webhooks bypass BFF forbidden');
r=await request('auth/session');assert.equal(r.status,401,'anonymous denied');
r=await request('auth/staff/login',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({email:'admin@example.invalid',password:'fixture-only'})});assert.equal(r.status,200);const payload=await r.json();assert.deepEqual(payload,{authenticated:true},'tokens never returned to browser');const cookies=r.headers.getSetCookie();assert.equal(cookies.length,2);assert.ok(cookies.every(v=>/httponly/i.test(v)&&/samesite=lax/i.test(v)));const cookie=cookies.map(c=>c.split(';')[0]).join('; ');
r=await request('auth/session',{headers:{cookie}});assert.equal(r.status,200);assert.equal((await r.json()).type,'STAFF');
const refreshCookie=cookies.find(c=>c.startsWith('mp_refresh=')).split(';')[0];r=await request('auth/session',{headers:{cookie:refreshCookie}});assert.equal(r.status,200,'expired access refreshes');assert.equal(r.headers.getSetCookie().length,2);
r=await request('auth/logout-all',{method:'POST',headers:{cookie,origin:base}});assert.equal(r.status,200);assert.ok(r.headers.getSetCookie().every(v=>/max-age=0/i.test(v)));
console.log('8 BFF contract checks passed: CSRF, allowlist, anonymous access, HttpOnly cookies, token redaction, refresh and logout.');
}main().catch(e=>{console.error(e);process.exitCode=1;});
