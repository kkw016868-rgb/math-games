// 플레이 기록 수집기. 학생 이름 없이 기기별 익명 ID로 기록하고, 관리자 대시보드(구글 시트)로 보낸다.
// ENDPOINT에 Apps Script 수집용 웹앱 주소(.../exec)를 넣으면 전송이 시작된다. 비어 있으면 기기에만 쌓아 둔다.
// 출처 표시: 주소 뒤에 ?src=booth 를 한 번 붙여 열면 그 기기는 계속 '부스 기기'로 기록된다(?src=home 으로 해제).
//           NFC 키링 링크에는 ?src=nfc 를 붙이면 집에서 다시 접속한 기록을 따로 볼 수 있다.
(function(){
const ENDPOINT='https://script.google.com/macros/s/AKfycbxyiCnxqD-IOUJZYBXS5n3ijf5BNHAw7zl9AhpNbW26gH-e-h5MB-8zfO2QQc_gpmus7Q/exec';
const QKEY='gamelog_queue',PKEY='gamelog_player',BKEY='gamelog_booth',NKEY='gamelog_src';
const MAX_QUEUE=2000,BATCH=50;
const me=document.currentScript,page=(me&&me.dataset.game)||location.pathname.split('/').pop().replace('.html','')||'index';

function store(s,k,v){try{if(v===undefined)return s.getItem(k);if(v===null)s.removeItem(k);else s.setItem(k,v)}catch(e){return null}}
function rid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}

let player=store(localStorage,PKEY);
if(!player){player='p'+rid();store(localStorage,PKEY,player)}
const qs=new URLSearchParams(location.search).get('src');
if(qs==='booth')store(localStorage,BKEY,'1');
else if(qs==='home')store(localStorage,BKEY,null);
else if(qs)store(sessionStorage,NKEY,qs.slice(0,20));
function source(){
 if(location.protocol==='file:'||/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))return 'test';
 if(store(localStorage,BKEY)==='1')return 'booth';
 return store(sessionStorage,NKEY)||'web';
}
const device=/iPad|Tablet/i.test(navigator.userAgent)?'tablet':/Mobi|Android|iPhone/i.test(navigator.userAgent)?'mobile':'pc';

function loadQueue(){try{return JSON.parse(store(localStorage,QKEY)||'[]')}catch(e){return []}}
function saveQueue(q){store(localStorage,QKEY,JSON.stringify(q.slice(-MAX_QUEUE)))}

let cur=null,seq=0;
function push(ev,o){
 const e=Object.assign({id:(cur?cur.s:player)+'-'+(seq++)+'-'+rid().slice(-4),t:new Date().toISOString(),p:player,src:source(),dev:device,g:page,e:ev},o);
 if(cur){e.s=cur.s;e.g=cur.g;e.m=cur.m;e.mx=cur.mx;e.sec=Math.round((Date.now()-cur.at)/1000);if(e.st==null)e.st=cur.st}
 const q=loadQueue();q.push(e);saveQueue(q);
}
function readStage(){if(!cur||!cur.get)return;try{const n=Number(cur.get());if(Number.isFinite(n)&&n>cur.st){cur.st=n;push('progress',{})}}catch(e){}}
function close(result,extra){
 if(!cur)return;readStage();
 const o={r:result};
 if(extra){if(extra.stage!=null){cur.st=Number(extra.stage)||0;delete extra.stage}if(Object.keys(extra).length)o.x=JSON.stringify(extra).slice(0,300)}
 push(result==='quit'||result==='restart'?'quit':'end',o);cur=null;
}

let sending=false;
function flush(){
 if(!ENDPOINT||sending)return;
 const q=loadQueue();if(!q.length)return;
 const batch=q.slice(0,BATCH),ids=new Set(batch.map(e=>e.id));
 sending=true;
 fetch(ENDPOINT,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(batch)})
  .then(()=>{saveQueue(loadQueue().filter(e=>!ids.has(e.id)));sending=false;if(q.length>BATCH)flush()})
  .catch(()=>{sending=false});
}
function beacon(){
 if(!ENDPOINT||!navigator.sendBeacon)return;
 const q=loadQueue();if(!q.length)return;
 const batch=q.slice(0,BATCH),ids=new Set(batch.map(e=>e.id));
 if(navigator.sendBeacon(ENDPOINT,new Blob([JSON.stringify(batch)],{type:'text/plain;charset=utf-8'})))saveQueue(loadQueue().filter(e=>!ids.has(e.id)));
}

window.GameLog={
 // 한 판 시작. opt.maxStage: 끝까지 가면 몇 단계인지, opt.stage: 현재 단계를 돌려주는 함수(주기적으로 확인)
 start(game,mode,opt){opt=opt||{};close('restart');cur={s:'s'+rid(),g:game,m:mode||'',mx:opt.maxStage||0,st:0,get:opt.stage,at:Date.now()};push('start',{});flush()},
 progress(n){if(!cur)return;n=Number(n)||0;if(n>cur.st){cur.st=n;push('progress',{})}},
 // result: 'clear'(성공) | 'fail'(실패) | 'draw'(무승부) | 'done'(2인 대전처럼 승패 개념이 다른 종료)
 end(result,extra){close(result,extra);flush()},
 quit(){close('quit');flush()},
 track(name,extra){push('click',{g:name,x:extra?JSON.stringify(extra).slice(0,300):undefined});flush()},
 get active(){return !!cur}
};

push('visit',{});
setInterval(()=>{readStage();if(loadQueue().length)flush()},4000);
addEventListener('online',flush);
addEventListener('pagehide',()=>{close('quit');beacon()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){readStage();beacon()}});
flush();
})();
