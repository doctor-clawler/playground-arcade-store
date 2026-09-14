(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 1280, H = 720;
  const names = ['나', '서윤', '도윤', '하린', '준호', '민지', '태오', '유나'];
  const colors = ['#d4aa72','#7899a8','#ad7769','#8b88b7','#6f9a7e','#b08d65','#8c7568','#9b7d98'];
  const roleInfo = {
    detective: ['탐정', '밤마다 한 명의 정체를 조사합니다.', '✦'],
    doctor: ['의사', '밤마다 한 명을 마피아의 습격에서 지킵니다.', '✚'],
    citizen: ['시민', '대화의 모순을 찾아 투표로 마피아를 잡습니다.', '●'],
    mafia: ['마피아', '밤마다 시민 한 명을 제거합니다.', '◆']
  };
  const hit = [];
  let seed = 91027;
  let raf = 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const state = {
    mode: 'title', phase: '시작', day: 0, playerRole: null, players: [],
    selected: null, log: [], message: '', results: {}, winner: null, reveal: false
  };

  function reset(role) {
    seed = 91027;
    const others = role === 'mafia'
      ? ['mafia','detective','doctor','citizen','citizen','citizen','citizen']
      : ['mafia','mafia','detective','doctor','citizen','citizen','citizen'];
    const idx = others.indexOf(role);
    if (idx >= 0) others[idx] = 'citizen';
    for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    state.players = names.map((name, i) => ({ name, role: i ? others[i-1] : role, alive: true, suspicion: 18 + Math.floor(rnd()*30), color: colors[i] }));
    state.playerRole = role; state.mode = 'role'; state.phase = '역할 확인'; state.day = 1;
    state.selected = null; state.log = []; state.results = {}; state.winner = null; state.reveal = false;
    state.message = role === 'mafia' ? '동료 마피아는 붉은 표식으로 보입니다.' : '당신의 정체는 끝까지 숨겨집니다.';
    render();
  }

  function alive(role) { return state.players.filter(p => p.alive && (!role || p.role === role)); }
  function checkEnd() {
    const m = alive('mafia').length, t = alive().length;
    if (!m) state.winner = 'citizen';
    else if (m >= t - m) state.winner = 'mafia';
    if (state.winner) { state.mode = 'end'; state.phase = '게임 종료'; state.selected = null; }
    return !!state.winner;
  }
  function beginDay(nightText) {
    if (checkEnd()) return render();
    state.mode = 'day'; state.phase = `${state.day}일차 낮`; state.selected = null;
    const suspects = alive().filter(p => p.name !== '나').sort((a,b) => b.suspicion-a.suspicion);
    const speaker = suspects[Math.floor(rnd()*Math.min(3,suspects.length))];
    const other = suspects.find(p => p !== speaker);
    const lines = [
      `${speaker.name}: “${other.name}, 어젯밤부터 말이 계속 바뀌잖아.”`,
      `${other.name}: “날 몰아가는 ${speaker.name} 쪽이 더 수상해.”`,
      `기록: “감정보다 투표 기록을 보자. 확실한 건 아직 없다.”`
    ];
    const clue = state.results.detective ? ` 탐정의 조사: ${state.results.detective}` : '';
    state.message = (nightText || '긴 밤이 지나고 모두가 다시 원탁에 모였다.') + clue;
    state.log = lines; render();
  }
  function beginVote() {
    state.mode='vote'; state.phase=`${state.day}일차 투표`; state.selected=null;
    if (!state.players[0].alive) {
      state.selected = state.players.indexOf(alive().filter(p=>p.name!=='나').sort((a,b)=>b.suspicion-a.suspicion)[0]);
      return resolveVote();
    }
    state.message='추방할 사람을 한 명 지목하세요.'; render();
  }
  function resolveVote() {
    if (state.selected == null) return;
    const target = state.players[state.selected];
    const candidates = alive();
    const tally = new Map(candidates.map(p => [p, 0]));
    tally.set(target, 1);
    candidates.filter(p=>p.name!=='나').forEach(voter => {
      const opts = candidates.filter(p=>p!==voter);
      opts.sort((a,b) => ((b.suspicion + (a===target?12:0)) - (a.suspicion + (b===target?12:0))));
      tally.set(opts[0], tally.get(opts[0])+1);
    });
    const out = [...tally].sort((a,b)=>b[1]-a[1])[0][0]; out.alive=false;
    state.results = { out: out.name, role: out.role, votes: tally.get(out) };
    state.mode='voteResult'; state.phase='투표 결과';
    state.message=`${out.name}, ${tally.get(out)}표로 추방되었습니다.`; render();
  }
  function beginNight() {
    if (checkEnd()) return render();
    if (!state.players[0].alive) return resolveNight(null);
    state.mode='night'; state.phase=`${state.day}일차 밤`; state.selected=null;
    state.message = state.playerRole === 'citizen' ? '능력이 없습니다. 조용히 밤이 지나가길 기다리세요.' : roleInfo[state.playerRole][1]; render();
  }
  function resolveNight(targetIdx) {
    const livingCitizens = alive().filter(p=>p.role!=='mafia');
    let kill = livingCitizens[Math.floor(rnd()*livingCitizens.length)];
    let saved = null;
    if (state.playerRole === 'mafia' && state.players[0].alive && targetIdx != null) kill = state.players[targetIdx];
    if (state.playerRole === 'doctor' && state.players[0].alive && targetIdx != null) saved = state.players[targetIdx];
    else { const doc=alive('doctor')[0]; if(doc) saved=alive()[Math.floor(rnd()*alive().length)]; }
    if (state.playerRole === 'detective' && state.players[0].alive && targetIdx != null) {
      const p=state.players[targetIdx]; state.results.detective=`${p.name}은(는) ${p.role==='mafia'?'마피아입니다':'마피아가 아닙니다'}.`;
      p.suspicion += p.role==='mafia'?55:-10;
    }
    let text;
    if (kill && kill !== saved) { kill.alive=false; text=`해가 떴지만 ${kill.name}의 자리는 비어 있습니다.`; }
    else text='누군가의 도움으로 모두가 무사히 아침을 맞았습니다.';
    state.day++; beginDay(text);
  }

  function rect(x,y,w,h,fill,stroke,r=18) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();} }
  function text(t,x,y,size=24,color='#eee4d5',align='left',weight=500) { ctx.font=`${weight} ${size}px Pretendard, Noto Sans KR, sans-serif`; ctx.textAlign=align; ctx.textBaseline='middle'; ctx.fillStyle=color; ctx.fillText(t,x,y); }
  function button(label,x,y,w,h,action,kind='gold') { rect(x,y,w,h,kind==='red'?'#773c38':'#c69b62',null,12); text(label,x+w/2,y+h/2,20,kind==='red'?'#fff4eb':'#17120f','center',750); hit.push({x,y,w,h,action}); }
  function bg(night=false) {
    const g=ctx.createRadialGradient(640,390,40,640,390,720); g.addColorStop(0,night?'#202239':'#3a2920'); g.addColorStop(1,night?'#080912':'#100c0a'); ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.15; for(let i=0;i<9;i++){ctx.fillStyle='#d5b377';ctx.beginPath();ctx.arc(100+i*150,90+(i%2)*18,2,0,7);ctx.fill();} ctx.globalAlpha=1;
    ctx.fillStyle=night?'#151322':'#201712';ctx.beginPath();ctx.ellipse(640,600,560,190,0,0,7);ctx.fill();
  }
  function header() {
    text('자정의 증언',56,48,24,'#d4aa72','left',800); text(state.phase,1220,48,18,'#b8aa98','right',600);
    ctx.strokeStyle='#6d5944';ctx.globalAlpha=.45;ctx.beginPath();ctx.moveTo(56,78);ctx.lineTo(1224,78);ctx.stroke();ctx.globalAlpha=1;
  }
  function playerCard(p,i,selectable=true) {
    const cols=4, w=238,h=116, gap=22, sx=108, sy=160;
    const x=sx+(i%cols)*(w+gap), y=sy+Math.floor(i/cols)*(h+gap);
    const selected=state.selected===i;
    rect(x,y,w,h,p.alive?(selected?'#49382b':'#271d18'):'#151311',selected?'#d4aa72':'#54463a',14);
    ctx.globalAlpha=p.alive?1:.35; ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x+47,y+48,26,0,7);ctx.fill();
    text(p.name,x+84,y+36,21,'#f2e8d8','left',750);
    text(p.alive?'생존':'사망',x+84,y+66,15,p.alive?'#9cb594':'#aa7771');
    if ((state.playerRole==='mafia' && p.role==='mafia') || state.mode==='end') text(roleInfo[p.role][0],x+w-16,y+26,14,p.role==='mafia'?'#d36e67':'#d0b98d','right',700);
    if(state.results.detective && p===state.players[state.selected]) text('조사 완료',x+w-16,y+86,13,'#d4aa72','right',700);
    ctx.globalAlpha=1;
    const cannotPickSelf = state.mode === 'vote' && i === 0;
    if(selectable && p.alive && !cannotPickSelf && !(state.mode==='night'&&state.playerRole==='mafia'&&p.role==='mafia')) hit.push({x,y,w,h,action:()=>{state.selected=i;render();}});
  }
  function renderTitle() {
    bg();
    text('MURDER AT MIDNIGHT',640,124,15,'#b48d62','center',750);
    text('자정의 증언',640,205,68,'#f3e8d4','center',850);
    text('거짓말이 시작되면, 누구도 결백하지 않다.',640,267,23,'#baa995','center',450);
    text('역할을 선택하세요',640,360,18,'#d7c8b4','center',650);
    const roles=['detective','doctor','citizen','mafia'];
    roles.forEach((r,i)=>{const x=190+i*230;rect(x,400,210,104,'#241a16','#68533f',16);text(roleInfo[r][2],x+105,428,25,'#d4aa72','center',700);text(roleInfo[r][0],x+105,464,20,'#f0e3d0','center',750);hit.push({x,y:400,w:210,h:104,action:()=>reset(r)});});
    text('클릭으로 진행 · F 전체화면',640,650,15,'#7f7368','center',500);
  }
  function renderRole() {
    bg(state.playerRole==='mafia');header(); const info=roleInfo[state.playerRole];
    text('당신의 역할',640,180,18,'#a99a89','center',600); text(info[2],640,260,62,state.playerRole==='mafia'?'#c85d57':'#d4aa72','center',700);
    text(info[0],640,340,52,'#f4e8d5','center',850); text(info[1],640,405,20,'#c9b9a5','center',450); text(state.message,640,447,16,'#8f8275','center',450);
    button('원탁으로 가기',510,530,260,60,()=>beginDay());
  }
  function renderDay() {
    bg();header(); text(state.message,640,112,20,'#dbc9b3','center',650);
    state.players.forEach((p,i)=>playerCard(p,i,false));
    rect(192,454,896,136,'rgba(16,12,10,.72)','#5b4939',12);
    state.log.forEach((l,i)=>text(l,222,486+i*37,18,i===0?'#efd9bc':'#bcae9f','left',i===0?650:450));
    button('투표 시작',520,624,240,54,beginVote);
  }
  function renderChoice() {
    bg(state.mode==='night');header(); text(state.message,640,112,20,'#dbc9b3','center',650);
    state.players.forEach((p,i)=>playerCard(p,i,true));
    if(state.mode==='vote') button(state.selected==null?'한 명을 선택하세요':'이 사람을 지목',520,604,240,54,resolveVote,state.selected==null?'red':'gold');
    else if(state.playerRole==='citizen') button('밤을 보내기',520,604,240,54,()=>resolveNight(null));
    else button(state.selected==null?'대상을 선택하세요':({detective:'정체 조사',doctor:'이 사람을 보호',mafia:'습격 결정'}[state.playerRole]),520,604,240,54,()=>state.selected!=null&&resolveNight(state.selected),state.playerRole==='mafia'?'red':'gold');
  }
  function renderVoteResult() {
    bg();header();const out=state.players.find(p=>p.name===state.results.out);
    text(state.message,640,206,29,'#f0dfcb','center',750);text(out?roleInfo[out.role][2]:'',640,302,58,out&&out.role==='mafia'?'#ce615b':'#d4aa72','center',700);
    text(`${state.results.out}의 정체는 ${out?roleInfo[out.role][0]:''}`,640,385,25,'#c7b49e','center',650);
    button('밤을 맞이하기',510,500,260,60,beginNight);
  }
  function renderEnd() {
    bg(state.winner==='mafia'); header(); const won=(state.winner==='mafia')===(state.playerRole==='mafia');
    const ending = state.winner==='mafia'?'마을은 침묵에 잠겼다':'거짓말은 끝났다';
    text(`${won?'승리':'패배'} · ${ending}`,640,116,28,won?'#d4aa72':'#c7867e','center',800);
    state.players.forEach((p,i)=>playerCard(p,i,false)); button('다시 플레이',520,624,240,54,()=>{state.mode='title';state.phase='시작';render();});
  }
  function render() {
    cancelAnimationFrame(raf); hit.length=0;ctx.clearRect(0,0,W,H);
    if(state.mode==='title')renderTitle(); else if(state.mode==='role')renderRole(); else if(state.mode==='day')renderDay(); else if(state.mode==='vote'||state.mode==='night')renderChoice(); else if(state.mode==='voteResult')renderVoteResult(); else renderEnd();
  }
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
  canvas.addEventListener('pointerup',e=>{const p=point(e);const h=[...hit].reverse().find(a=>p.x>=a.x&&p.x<=a.x+a.w&&p.y>=a.y&&p.y<=a.y+a.h);if(h)h.action();canvas.focus();});
  document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f'){if(!document.fullscreenElement)canvas.requestFullscreen?.();else document.exitFullscreen?.();}});
  window.render_game_to_text=()=>JSON.stringify({coordinateSystem:'1280x720 canvas; origin top-left; x right, y down',mode:state.mode,phase:state.phase,day:state.day,playerRole:state.playerRole,selected:state.selected==null?null:state.players[state.selected]?.name,message:state.message,dialogue:state.log,players:state.players.map(p=>({name:p.name,alive:p.alive,knownRole:(state.mode==='end'||(state.playerRole==='mafia'&&p.role==='mafia'))?p.role:undefined})),result:state.results,winner:state.winner});
  window.advanceTime=()=>render();
  render();
})();
