const crypto=require('crypto');
const recent=new Map();
function reply(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(data))}
function auth(key,secret){const date=new Date().toISOString(),salt=crypto.randomBytes(16).toString('hex'),signature=crypto.createHmac('sha256',secret).update(date+salt).digest('hex');return 'HMAC-SHA256 apiKey='+key+', date='+date+', salt='+salt+', signature='+signature}
module.exports=async(req,res)=>{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{error:'허용되지 않은 요청입니다.'})}
 if(req.headers.origin&&req.headers.host){try{if(new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'요청을 확인할 수 없습니다.'})}catch(e){return reply(res,403,{error:'요청을 확인할 수 없습니다.'})}}
 let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}if(!b||typeof b!=='object')b={};
 if(b.website)return reply(res,200,{ok:true});
 const name=String(b.name||'').trim(),birth=String(b.birth||'').trim(),phone=String(b.phone||'').replace(/\D/g,'');
 if(!name||name.length>30)return reply(res,400,{error:'이름을 확인해 주세요.'});
 if(!/^\d{8}$/.test(birth))return reply(res,400,{error:'생년월일을 8자리로 입력해 주세요.'});
 const yy=Number(birth.slice(0,4)),mm=Number(birth.slice(4,6)),dd=Number(birth.slice(6,8)),dt=new Date(Date.UTC(yy,mm-1,dd));if(dt.getUTCFullYear()!==yy||dt.getUTCMonth()!==mm-1||dt.getUTCDate()!==dd||yy<1900||dt.getTime()>Date.now())return reply(res,400,{error:'생년월일을 확인해 주세요.'});
 if(!/^01[016789]\d{7,8}$/.test(phone))return reply(res,400,{error:'휴대폰번호를 확인해 주세요.'});
 if(b.consent!==true)return reply(res,400,{error:'개인정보 수집·이용에 동의해 주세요.'});
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim(),now=Date.now();if(now-(recent.get(ip)||0)<30000)return reply(res,429,{error:'잠시 후 다시 신청해 주세요.'});recent.set(ip,now);if(recent.size>500)for(const [k,v]of recent)if(now-v>600000)recent.delete(k);
 const key=process.env.SOLAPI_API_KEY,secret=process.env.SOLAPI_API_SECRET,from=String(process.env.SOLAPI_SENDER||'').replace(/\D/g,''),to=String(process.env.NOTIFY_PHONE||'').replace(/\D/g,'');
 if(!key||!secret||!from||!to)return reply(res,500,{error:'문자 알림 연결이 아직 준비되지 않았습니다.'});
 const text='[구미 파크원 데시앙] 관심고객 등록\n이름: '+name+'\n생년월일: '+birth+'\n휴대폰: '+phone+'\n접수: '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
 try{const response=await fetch('https://api.solapi.com/messages/v4/send-many/detail',{method:'POST',headers:{Authorization:auth(key,secret),'Content-Type':'application/json'},body:JSON.stringify({messages:[{to,from,text}]})});const result=await response.json().catch(()=>({}));if(!response.ok||(Array.isArray(result.failedMessageList)&&result.failedMessageList.length)){console.error('Solapi send failed',response.status,JSON.stringify(result).slice(0,1000));return reply(res,502,{error:'문자 알림 전송에 실패했습니다.'})}return reply(res,200,{ok:true})}catch(e){console.error('Lead send error',e.message);return reply(res,502,{error:'문자 전송 중 오류가 발생했습니다.'})}
};