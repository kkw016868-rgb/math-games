// 수학 게임 모음 공용 사운드: 배경음악과 효과음을 Web Audio로 직접 합성한다(음원 파일 없음).
// 사용법: GameAudio.music('battle'|'maze'|'signal'|'space'), GameAudio.stop(), GameAudio.sfx('correct') 등.
// <script src="sound.js" data-btn="top:10px;right:10px"> 로 음소거 버튼 위치를 정할 수 있다.
(()=>{
const KEY='mathgames-muted',script=document.currentScript;
let ac=null,master,musicBus,sfxBus,noiseBuf,track=null,trackName=null,timer=null,step=0,nextTime=0,intensity=0,muted=false;
try{muted=localStorage.getItem(KEY)==='1'}catch(e){}

function init(){
  if(ac)return ac;
  try{
    ac=new(window.AudioContext||window.webkitAudioContext)();
    master=ac.createGain();master.gain.value=muted?0:1;master.connect(ac.destination);
    musicBus=ac.createGain();musicBus.gain.value=.42;musicBus.connect(master);
    sfxBus=ac.createGain();sfxBus.gain.value=.9;sfxBus.connect(master);
    noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  }catch(e){ac=null}
  return ac;
}
function unlock(){if(init()&&ac.state==='suspended')ac.resume()}
['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,unlock,{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(!ac)return;if(document.hidden)ac.suspend();else ac.resume()});

const hz=m=>440*Math.pow(2,(m-69)/12);
function note(m,t,dur,o={}){
  const {type='triangle',vol=.1,bus=musicBus,attack=.01,cut=0,slide=0}=o;
  const osc=ac.createOscillator(),g=ac.createGain();osc.type=type;osc.frequency.setValueAtTime(hz(m),t);
  if(slide)osc.frequency.exponentialRampToValueAtTime(hz(m+slide),t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  let out=osc;if(cut){const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=cut;osc.connect(f);out=f}
  out.connect(g);g.connect(bus);osc.start(t);osc.stop(t+dur+.05);
}
function noise(t,dur,o={}){
  const {vol=.1,bus=musicBus,freq=7000,type='highpass',sweep=0}=o;
  const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=noiseBuf;f.type=type;f.frequency.setValueAtTime(freq,t);
  if(sweep)f.frequency.exponentialRampToValueAtTime(sweep,t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(bus);s.start(t,Math.random()*.5,dur+.05);
}
function kick(t,vol=.5,bus=musicBus){
  const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+.13);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g);g.connect(bus);o.start(t);o.stop(t+.26);
}

// 각 곡은 16분음표 단위 step마다 호출된다. s=전체 step, d=한 step 길이(초).
const TRACKS={
  // 수학 난투: 빠르고 신나는 A단조 전투곡
  battle:{bpm:142,play(s,t,d){
    const bar=Math.floor(s/16)%4,i=s%16,roots=[45,41,48,43],r=roots[bar],chord=[[57,60,64],[53,57,60],[55,60,64],[55,59,62]][bar];
    if(i%4===0)kick(t,.42);
    if(i===4||i===12)noise(t,.12,{vol:.12,freq:1800,type:'bandpass'});
    if(i%2===0)noise(t,.03,{vol:.035});
    if(i%2===0)note(i%4===2?r+12:r,t,d*1.8,{type:'sawtooth',vol:.07,cut:700});
    const lead=[0,null,1,null,2,null,1,2,0,null,2,null,1,null,2,1][i];
    if(lead!==null&&bar%2===s%2)note(chord[lead]+12,t,d*1.6,{type:'square',vol:.03,cut:2600});
  }},
  // 수학 탈출: 느린 오르골 + 낮은 울림, 추격이 가까울수록 심장 소리
  maze:{bpm:76,play(s,t,d){
    const i=s%32,mel=[76,null,72,null,75,null,71,null,72,null,null,null,69,null,68,null,76,null,72,null,75,null,77,null,76,null,null,null,null,null,null,null];
    if(i===0||i===16)note(i===0?45:44,t,d*16,{type:'sine',vol:.09,attack:.4});
    if(mel[i])note(mel[i],t,d*5,{type:'triangle',vol:.045});
    if(mel[i]&&i%8===0)note(mel[i]+12,t+d*.02,d*3,{type:'sine',vol:.015});
    const beat=intensity>.15?4:16;
    if(intensity>.15&&s%beat===0){kick(t,.18+intensity*.35);kick(t+d*1.1,.12+intensity*.25)}
    if(intensity>.6&&s%2===0)noise(t,.03,{vol:.02*intensity});
  }},
  // LAST SIGNAL: 어둡게 맥박 치는 D단조 신스
  signal:{bpm:96,play(s,t,d){
    const bar=Math.floor(s/16)%4,i=s%16,r=[38,38,34,36][bar];
    if(i%2===0)note(i%8===6?r+12:r,t,d*1.5,{type:'sawtooth',vol:.07,cut:380+intensity*500});
    if(i===0)note(r+24,t,d*16,{type:'sine',vol:.04,attack:.6});
    if(i===0||i===8||(intensity>.3&&i%4===0))kick(t,.3);
    if(i===8&&bar%2)note([74,72,70,69][bar],t,d*6,{type:'triangle',vol:.025});
    if(intensity>.3&&i%2===1)noise(t,.03,{vol:.03});
  }},
  // 별빛 너머의 친구들: 몽환적인 우주 패드와 아르페지오
  space:{bpm:84,play(s,t,d){
    const bar=Math.floor(s/16)%4,i=s%16,chords=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,67]],c=chords[bar];
    if(i===0)c.forEach(m=>note(m-12,t,d*16,{type:'sine',vol:.035,attack:.5}));
    if(i===0)note(c[0]-24,t,d*14,{type:'triangle',vol:.06,attack:.2});
    if(i%2===0)note(c[(i/2)%4]+12,t,d*3,{type:'triangle',vol:.03});
    if(i===6||i===14)note(c[3]+24,t,d*6,{type:'sine',vol:.012});
  }}
};

function schedule(){
  if(!ac||!track)return;
  const d=60/track.bpm/4;
  while(nextTime<ac.currentTime+.15){try{track.play(step,nextTime,d)}catch(e){}nextTime+=d;step++}
}

const SFX={
  click(t){note(84,t,.06,{type:'square',vol:.05,bus:sfxBus})},
  correct(t){[72,76,79,84].forEach((m,k)=>note(m,t+k*.07,.22,{type:'triangle',vol:.14,bus:sfxBus}))},
  wrong(t){note(52,t,.18,{type:'sawtooth',vol:.11,bus:sfxBus,cut:900});note(46,t+.16,.3,{type:'sawtooth',vol:.11,bus:sfxBus,cut:700})},
  swing(t){noise(t,.16,{vol:.18,bus:sfxBus,type:'bandpass',freq:700,sweep:3200})},
  hit(t){kick(t,.6,sfxBus);noise(t,.1,{vol:.22,bus:sfxBus,freq:1200})},
  bigHit(t){kick(t,.8,sfxBus);noise(t,.22,{vol:.3,bus:sfxBus,freq:900});note(40,t,.3,{type:'square',vol:.08,bus:sfxBus,slide:-12})},
  jump(t){note(62,t,.14,{type:'square',vol:.05,bus:sfxBus,slide:12})},
  step(t){noise(t,.03,{vol:.05,bus:sfxBus,freq:2500})},
  bump(t){note(40,t,.07,{type:'square',vol:.05,bus:sfxBus,cut:500})},
  key(t){note(88,t,.18,{type:'sine',vol:.14,bus:sfxBus});note(95,t+.09,.3,{type:'sine',vol:.12,bus:sfxBus})},
  power(t){note(60,t,.4,{type:'sawtooth',vol:.06,bus:sfxBus,cut:2000,slide:24})},
  start(t){[60,67,72].forEach((m,k)=>note(m,t+k*.09,.3,{type:'square',vol:.07,bus:sfxBus,cut:3000}))},
  round(t){kick(t,.6,sfxBus);note(57,t,.6,{type:'sawtooth',vol:.08,bus:sfxBus,cut:1500});note(64,t+.12,.6,{type:'sawtooth',vol:.08,bus:sfxBus,cut:1500})},
  win(t){[60,64,67,72,67,72,76].forEach((m,k)=>note(m,t+k*.1,k===6?.6:.18,{type:'square',vol:.07,bus:sfxBus,cut:3500}))},
  lose(t){[67,63,60,55].forEach((m,k)=>note(m,t+k*.18,.35,{type:'triangle',vol:.12,bus:sfxBus}))},
  scare(t){note(44,t,.9,{type:'sawtooth',vol:.12,bus:sfxBus,cut:900,slide:-5});noise(t,.5,{vol:.15,bus:sfxBus,type:'bandpass',freq:400,sweep:2000})}
};

const btn=document.createElement('button');
function paintBtn(){btn.textContent=muted?'🔇':'🔊';btn.setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');btn.title=btn.getAttribute('aria-label')}
btn.style.cssText='position:fixed;z-index:99999;width:40px;height:40px;border-radius:50%;border:1px solid #ffffff40;background:#0b1220cc;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:0;touch-action:manipulation;'+((script&&script.dataset.btn)||'top:10px;right:10px');
btn.addEventListener('click',e=>{e.stopPropagation();GameAudio.setMuted(!muted)});
paintBtn();
if(document.body)document.body.appendChild(btn);else addEventListener('DOMContentLoaded',()=>document.body.appendChild(btn));

const GameAudio=window.GameAudio={
  get muted(){return muted},
  setMuted(v){muted=!!v;try{localStorage.setItem(KEY,muted?'1':'0')}catch(e){}if(ac)master.gain.setTargetAtTime(muted?0:1,ac.currentTime,.03);paintBtn()},
  music(name){
    if(!init())return;unlock();
    if(trackName===name&&timer)return;
    track=TRACKS[name]||null;trackName=name;step=0;nextTime=ac.currentTime+.08;
    musicBus.gain.cancelScheduledValues(ac.currentTime);musicBus.gain.setValueAtTime(.42,ac.currentTime);
    clearInterval(timer);timer=track?setInterval(schedule,25):null;
  },
  stop(fade=.4){
    if(!ac)return;clearInterval(timer);timer=null;track=null;trackName=null;
    musicBus.gain.setTargetAtTime(0,ac.currentTime,fade/3);
  },
  intensity(v){intensity=Math.max(0,Math.min(1,v||0))},
  sfx(name){if(!init()||muted)return;unlock();const f=SFX[name];if(f)try{f(ac.currentTime+.01)}catch(e){}},
  get context(){return init()}
};
})();
