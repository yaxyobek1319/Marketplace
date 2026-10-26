// UI contract fixture only. Separate process, no database, SMS or payment provider.
// Never imported by application code; refuses non-loopback binding.
const http=require('node:http');const {randomUUID}=require('node:crypto');
const sellerId='11111111-1111-4111-8111-111111111111';const userId='22222222-2222-4222-8222-222222222222';
const tokens={accessToken:'a'.repeat(43),refreshToken:'r'.repeat(43),expiresIn:900};
const product={id:'33333333-3333-4333-8333-333333333333',titleI18n:{uz:'Sinov mahsuloti',ru:'Тестовый товар'},categoryId:1,description:'Faqat interfeys tekshiruvi uchun',status:'DRAFT',variants:[{id:'44444444-4444-4444-8444-444444444444',sku:'QA-001',price:'125000.00',stockQuantity:8,isActive:true,attributes:{rang:'qora'}}],images:[],attributes:[]};
const products=[product];let mode='seller';let refreshCount=0;
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');const path=url.pathname.replace('/api/v1/','');const chunks=[];for await(const c of req)chunks.push(c);let body={};try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{}
const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
if(path==='auth/staff/login'){mode=body.email==='moderator@example.invalid'?'moderator':'admin';return send(200,tokens);}
if(path==='auth/otp/request')return send(200,{expiresIn:180,retryAfter:60});
if(path==='auth/otp/verify'){mode='seller';return send(200,tokens);}
if(path==='auth/refresh'){refreshCount++;return send(200,tokens);}
if(path==='auth/logout-all')return send(200,{count:1});
if(path==='fixture/refresh-count')return send(200,{refreshCount});
if(req.headers.authorization!==`Bearer ${tokens.accessToken}`)return send(401,{message:'Unauthorized'});
const sellerPermissions=['session:read','seller:own','payouts:own','profile:own','notifications:own'];const adminPermissions=['session:read','finance:read','payouts:manage','sellers:rates','deposits:manage','categories:manage','promotions:platform:create','audit:read','staff:manage','notifications:templates'];const moderatorPermissions=['session:read','sellers:review','products:review','disputes:resolve','returns:resolve','reviews:moderate','sanctions:content','keywords:manage','notifications:templates','admin:queues'];
if(path==='auth/session')return send(200,{id:userId,type:mode==='seller'?'USER':'STAFF',...(mode==='seller'?{sellerId}:{}),permissions:mode==='seller'?sellerPermissions:mode==='moderator'?moderatorPermissions:adminPermissions});
if(path==='workspace/seller/overview')return send(200,{seller:{storeName:'Sinov do‘koni · QA',status:'ACTIVE',rating:'4.80',commissionRate:'5.00',taxRate:'4.00'},products:[{status:'DRAFT',_count:products.length}],orders:[{status:'PENDING_SELLER_CONFIRMATION',_count:1},{status:'COMPLETED',_count:12}]});
if(path==='finance/mine')return send(200,{sellerSpendable:'1860000',sellerFrozen:'420000',sellerAvailable:'1860000',sellerDeposit:'500000',buyerCredit:'0'});
if(path==='catalog/mine')return send(200,products);
if(path==='catalog/categories')return send(200,[{id:1,nameI18n:{uz:'Elektronika',ru:'Электроника'},riskLevel:'LOW',mxikCode:'12345678901234567'}]);
if(path==='catalog/products'&&req.method==='POST'){const value={...body,id:randomUUID(),status:'DRAFT',variants:body.variants.map(v=>({...v,id:randomUUID()}))};products.unshift(value);return send(201,value);}
if(path===`catalog/products/${product.id}/submit`){product.status='ACTIVE';return send(200,product);}
if(path==='orders/seller-items')return send(200,[{id:'55555555-5555-4555-8555-555555555555',titleAtPurchase:product.titleI18n,priceAtPurchase:'125000',quantity:2,discountAmount:'0',platformDiscountAmount:'0',deliveryAmount:'18000',status:'PENDING_SELLER_CONFIRMATION',confirmDeadline:new Date(Date.now()+86400000).toISOString()}]);
if(path==='me')return send(200,{phone:'+998900000000',fullName:'Sinov foydalanuvchisi',locale:'uz',marketingEnabled:false});
if(req.method==='GET')return send(200,[]);return send(200,{saved:true});
});server.listen(3101,'127.0.0.1',()=>console.log('UI fixture on http://127.0.0.1:3101 — test data only'));
