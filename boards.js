/* Current data are derived from repository files; controls only change this view. */
window.BoardDashboard = (() => {
  const types={monopoly:'모노폴리',pokemon:'포켓몬',slay:'슬레이'};
  const roles={monster:'일반 전투',enhanced:'강화 전투',elite:'적장',unknown:'사건',negative:'위험',buff:'보급',shop:'상점',start_rest:'야영지',battle:'교전',midboss:'중간보스',boss:'최종보스',camp:'정비',recruit:'등용',event:'군략',mystery:'미지의 골목'};
  let data, mode='overview', selected=null, baseline='previous';
  const weights={meta_coins:1,territory_merit:0,premium_gems:0,territory_material:0,recruit_ticket:0,advanced_recruit_ticket:0,special_recruit_ticket:0};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2});
  const index=s=>Object.entries(weights).reduce((n,[k,w])=>n+(s.grants[k]||0)*w,0);
  const compare=s=>baseline==='previous'?data.stages[s.number-2]:data.stages.find(x=>x.id===baseline);
  const change=(value,old)=>old===undefined?'기준':old===0?(value?'신규':'변화 없음'):`${value-old>=0?'+':''}${num(value-old)} (${value>=old?'+':''}${num((value/old-1)*100)}%)`;
  const diff=(value,old)=>`<small class="board-delta ${old!==undefined&&value<old?'down':'up'}">${change(value,old)}</small>`;
  const span=(m)=>`${num(m.expected)}회 <small>범위 ${num(m.min)}~${num(m.max)}</small>`;
  function countLabel(s){
    const p=s.encounter_plan;
    if(p.kind==='slay')return `전투 추정 ${span(p.metrics.battles)}<br>사건 추정 ${span(p.metrics.events)}`;
    if(p.kind==='field')return p.map_id?`필수 전투 2회 · 경계 사건 3회<br><small>${p.bounds?'총 전투 '+p.bounds.battles.join('~')+'회(구조상 범위)':'풀숲 조우 변동 · 상세에서 확률/상한 확인'}</small>`:'조우 수 미정 · 새 발급 대기';
    if(p.kind==='tutorial')return '전투 칸27 · 사건 칸9<br><small>실제 횟수는 착지/선택에 따라 변동</small>';
    return `착지 전투 참고 ${num((p.landing_density.monster||0)+(p.landing_density.enhanced||0))}회<br><small>중간보스/최종보스·통과 사건 별도</small>`;
  }
  function cells(s){
    const old=compare(s);
    if(mode==='rewards')return ['meta_coins','territory_merit','premium_gems','territory_material','recruit_ticket'].map(k=>`<td>${num(s.grants[k]||0)}${diff(s.grants[k]||0,old?.grants[k]|| (old?0:undefined))}</td>`).join('')+`<td>${num(index(s))}${diff(index(s),old?index(old):undefined)}</td><td>${s.rewards.filter(r=>r.amount&&!['meta_coins','territory_merit','premium_gems','territory_material','recruit_ticket'].includes(r.id)).map(r=>`${esc(r.name)} ×${r.amount}`).join('<br>')||'—'}</td>`;
    if(mode==='enemies'){
      const normal=s.encounters.filter(e=>!e.boss),actors=normal.flatMap(e=>e.phases.flatMap(p=>p.actors));
      const boss=s.encounters.find(e=>e.boss);
      return `<td>${num(Math.min(...actors.map(a=>a.hp)))}~${num(Math.max(...actors.map(a=>a.hp)))}<small>등록 비보스 개체 · 경로 보정 전</small></td><td>${num(Math.min(...actors.map(a=>a.attack)))}~${num(Math.max(...actors.map(a=>a.attack)))}</td><td>${esc(boss.name)}</td><td>${boss.phases.map(p=>num(p.hp_total)).join(' + ')}<br><b>합계 ${num(s.boss_hp)}</b>${diff(s.boss_hp,old?.boss_hp)}</td><td>${boss.phases.map(p=>`${p.actors.map(a=>a.attack).join('/')} · ${p.action_count}행동 × ${p.hit_count}타`).join('<br>')}</td>`;
    }
    return `<td>${esc(s.status)}${!s.new_map_ready?'<small class="down">전용 지도 미생성</small>':''}</td><td>${esc(s.concept)}<small>${esc(s.combat_concept)}</small></td><td>${countLabel(s)}</td><td>${esc(s.encounters.find(e=>e.boss).name)}<br>HP ${num(s.boss_hp)}${diff(s.boss_hp,old?.boss_hp)}</td><td>동전 ${num(s.grants.meta_coins)}${diff(s.grants.meta_coins,old?.grants.meta_coins)}<small>보석 ${num(s.grants.premium_gems)} · 일반패 ${s.grants.recruit_ticket}</small></td>`;
  }
  function filtered(){
    const kind=document.getElementById('board-type').value,chapter=document.getElementById('board-chapter').value,q=document.getElementById('board-search').value.trim().toLowerCase();
    return data.stages.filter(s=>(!kind||s.board_type===kind)&&(!chapter||s.chapter===chapter)&&`${s.number} ${s.title} ${s.concept} ${s.encounters.map(e=>e.name).join(' ')}`.toLowerCase().includes(q));
  }
  function render(){
    const stages=filtered();
    const headers=mode==='rewards'?['동전','치적','보석','영지 자재','일반패','가중 비교값','특별 보상']:mode==='enemies'?['일반·정예 HP','기본 공격','최종보스','페이즈 HP / 합계','보스 공격 · 행동/타격']:['지도 제작 상태','컨셉 / 전투 특징','조우 구성','최종보스','첫 완료 보상'];
    document.getElementById('board-count').textContent=`${stages.length} / 30개 전장`;
    document.getElementById('board-table').innerHTML=`<table><caption class="sr-only">${mode==='rewards'?'보상 비교':mode==='enemies'?'적군 능력치':'전체 보드'} · 비교 기준 ${esc(baseline==='previous'?'직전 탄':compare(data.stages[1])?.title||'선택한 탄')}</caption><thead><tr><th scope="col">탄 / 전장</th><th scope="col">보드</th>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${stages.map(s=>`<tr${s.id===selected?' class="selected"':''}><th scope="row"><button data-stage="${esc(s.id)}">${s.number}탄 · ${esc(s.title)}${s.chapter_final?'<small>장 마지막</small>':''}</button></th><td><span class="board-type ${s.board_type}">${types[s.board_type]}</span></td>${cells(s)}</tr>`).join('')}</tbody></table>${stages.length?'':'<p>일치하는 전장이 없습니다.</p>'}`;
    document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{selected=b.dataset.stage;history.replaceState(null,'',`${location.pathname}#boards=${selected}`);render();document.getElementById('board-detail').scrollIntoView({behavior:'instant',block:'start'});});
    document.querySelectorAll('[data-board-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.boardMode===mode)));
    renderChart(stages);
    if(selected)renderDetail(data.stages.find(s=>s.id===selected));else document.getElementById('board-detail').hidden=true;
  }
  function renderChart(stages){
    const metric=document.getElementById('board-metric').value;
    const value=s=>metric==='boss_hp'?s.boss_hp:metric==='value'?index(s):(s.grants[metric]||0);
    const maximum=Math.max(1,...stages.map(value));
    document.getElementById('board-chart').innerHTML=stages.map(s=>`<button data-chart-stage="${s.id}" aria-label="${s.number}탄 ${esc(s.title)} ${num(value(s))}"><span>${s.number}</span><i style="height:${Math.max(1,value(s)/maximum*175)}px" class="${s.board_type}"></i><b>${num(value(s))}</b></button>`).join('');
    document.querySelectorAll('[data-chart-stage]').forEach(b=>b.onclick=()=>document.querySelector(`[data-stage="${b.dataset.chartStage}"]`).click());
  }
  function effect(e){return Object.entries(e||{}).map(([k,v])=>`${esc(({gold:'원정 금',heal:'체력 회복',heal_percent:'최대HP 회복%',attack:'공격 증가',defense:'방어 증가',max_hp:'최대HP 증가',player_damage:'체력 소모',start_encounter:'추가 전투',open_recruitment:'원정 등용',planned_effect:'다음 효과'}[k])||k)} ${esc(typeof v==='object'?JSON.stringify(v):v)}`).join(' · ')||'효과 없음';}
  function renderDetail(s){
    if(!s)return;
    const p=s.encounter_plan,old=compare(s),box=document.getElementById('board-detail');box.hidden=false;
    const metric=p.metrics;
    const rewards=[...new Set([...Object.keys(s.grants),...Object.keys(old?.grants||{})])].map(id=>({id,name:s.rewards.find(r=>r.id===id)?.name||data.items[id]||id,amount:s.grants[id]||0}));
    const layout=p.kind==='slay'?`${p.steps}단계 · 전체 선택지 ${p.nodes}개 · 한 원정에서는 단계당1곳만 방문` : p.kind==='field'?p.size?`${p.size.join('×')}칸 · 상자 ${p.chests}개`:p.map_id?'지도 공간 재산정 필요':'전용 지도 없음':`${p.cells}칸 · ${Array.isArray(p.rolls)?p.rolls.join('~'):p.rolls}회 굴림${p.kind==='tutorial'?'(검증 범위)':''}`;
    const fieldBounds=p.bounds?`<p>실제 지도 연결 풀숲 <b>${p.grass_regions}곳</b> · 풀숲 전투 최대${p.wild_limit}회 · 풀숲 사건 최대${p.event_limit}회. 아래는 완주 시 경계/풀숲 조우 범위이며 공용 사건 내부 추가 전투·소환을 제외합니다. 기대 평균은 이동 전략에 따라 달라 미측정입니다.</p><div class="board-metrics">${Object.entries(p.bounds).map(([k,r])=>`<div><small>${({battles:'필드 전투 횟수',events:'경계+풀숲 사건',enemies:'등장 적군 개체',gold:'전투 획득 원정 금'})[k]}</small><strong>${r.join('~')}</strong><span>평균 미측정 · 구조상 범위</span></div>`).join('')}</div>`:'';
    const lanes=p.kind==='slay'&&!s.mystery_outcomes?'<p>교전·강습·중간보스: 측면로 HP85%/공격110%, 중앙로100%/100%, 보급로110%/90%. 경로 보정 후 난이도 보정하며 각각 반올림합니다. 최종보스는 경로 보정 없음. 아래 적 표는 중앙로 기준입니다.</p>':s.mystery_outcomes?'<p>완성 전용 경로는 모든 전투에 중앙로100%/100% 적용. 미지의 골목 복병은40% 확률입니다.</p>':'';
    box.innerHTML=`<div class="board-detail-head"><div><span class="kicker">STAGE ${s.number} · ${types[s.board_type]}</span><h2>${esc(s.title)}</h2></div><button id="board-close">상세 닫기</button></div><p>${esc(s.objective)}</p><p class="board-note">${esc(s.status)}</p><h3>진행 · 예상 조우 · 보상 경계</h3><p><b>${esc(layout)}</b></p><p>${esc(p.note)}</p>${p.counts?`<div class="board-chips">${Object.entries(p.counts).map(([k,v])=>`<span>${esc(roles[k]||k)} ${v}곳</span>`).join('')}</div>`:''}${metric?`<div class="board-metrics">${Object.entries(metric).map(([k,m])=>`<div><small>${({battles:'전투 횟수',events:'사건 방문',support:'정비·등용·상점',enemies:'등장 적군 개체',gold:'전투 획득 원정 금',xp:'전투 경험치'})[k]}</small><strong>${num(m.expected)}</strong><span>최소 ${num(m.min)} ~ 최대 ${num(m.max)}</span></div>`).join('')}</div>`:''}${p.kind==='field'&&p.map_id?'<p>적8%·사건4%는 보호 이동 이후 유효 판정의 확률입니다. 판정 N회·상한이 없다는 가정에서는 적 기대0.08N, 사건0.04N이나, 실제 원정에는 보호 이동과 지역별 상한이 적용됩니다.</p>':''}${fieldBounds}${lanes}<h3>첫 완료 보상 · ${esc(old?`${old.number}탄 ${old.title}`:'첫 탄')} 대비</h3><div class="board-reward-grid">${rewards.map(r=>`<div><small>${esc(r.name)}</small><strong>${num(r.amount)}</strong>${diff(r.amount,old?old.grants[r.id]||0:undefined)}</div>`).join('')}</div><p>가중 비교값 <b>${num(index(s))}</b> ${diff(index(s),old?index(old):undefined)} · 일반패 환산 모집 ${num((s.grants.recruit_ticket||0)/3)}회 + 고급 ${s.grants.advanced_recruit_ticket||0}회 + 특수 ${s.grants.special_recruit_ticket||0}회. 카드/휘장은 가중 비교값에서 제외합니다.</p><p>반복 클리어 추가 계정 보상: 현재 없음. 아래 전투 금/XP는 원정 전용입니다. 장수 보상은 기본판 카드이며 소유 중이면 카드 수량이 증가합니다.</p><h3>적군 · 보스 · 페이즈 능력치</h3><p>등록된 전투 정의 전체입니다. 필드 일반 조우는 첫 비보스/비대장, 수비대는 대장1종을 사용합니다. 슬레이 교전은 일반 후보에서 단계/경로로 선택하고 강습/중간보스는 대장을 사용합니다. 사건 분기 전투는 선택에 따라 추가됩니다. HP 합계에 소환병·보호막은 포함하지 않습니다.</p><div class="table-scroll"><table><thead><tr><th>적 / 역할</th><th>페이즈</th><th>개체 HP · 공격 · 방어</th><th>행동 / 타격</th><th>기믹</th><th>처치 원정 보상</th></tr></thead><tbody>${s.encounters.map(e=>e.phases.map((ph,i)=>`<tr><th>${esc(e.name)}<small>${e.boss?'최종보스':e.elite?'적장/대장':e.enhanced?'강화':'일반/사건'} · 전체HP ${e.hp_total}</small></th><td>${i+1}. ${esc(ph.name)}</td><td>${ph.actors.map(a=>`${esc(a.name)}<br><b>${a.hp}</b> / ${a.attack} / ${a.defense}`).join('<hr>')}</td><td>${ph.action_count}행동 × ${ph.hit_count}타</td><td>${Object.entries(ph.specials).map(([k,v])=>`${esc({summon:'소환',starting_shield:'보호막',counter_lightning:'반격 낙뢰',heavy_strike:'강공격',lightning:'낙뢰'}[k]||k)}: ${esc(typeof v==='object'?JSON.stringify(v):v)}`).join('<br>')||'—'}</td><td>${i===0?`금 ${e.gold} · XP ${e.xp}<small>페이즈별 중복 지급 없음</small>`:'—'}</td></tr>`).join('')).join('')}</tbody></table></div><details class="board-events"><summary>선택 사건 · 비용 · 효과 보기 (${s.events.length}개 등록)</summary>${s.events.map(e=>`<article><h4>${esc(e.title||e.id)}</h4><p>${esc(e.description||'')}</p><ul>${(e.options||[]).map(o=>`<li><b>${esc(o.label)}</b> · 비용 ${o.cost||0}금<br>${effect(o.effect)}</li>`).join('')}</ul></article>`).join('')}<p>보물터·도하·화살, 풀숲 미니게임과 슬레이 군략은 공용 사건 규칙도 사용합니다. 위 목록은 전장 데이터에 등록된 선택 사건으로, 방문 횟수나 현재 지도상 위치와 같지 않습니다.</p></details><details><summary>수치 출처와 계산 기준</summary><p>콘텐츠: ${esc(s.content_path)} · 기본 보드 등록: ${esc(s.board_path)}${p.profile?` · 실제 경로: ${esc(p.profile)}`:''}${p.map_id?` · 실제 필드: ${esc(p.map_id)}`:''}</p><p>${s.number===1?'황건40칸은 전용 원정 수치 그대로 사용(65%/50% 재적용 없음).':`신규 난이도: 일반HP×${s.difficulty.hp}, 공격×${s.difficulty.attack}, 보스HP×${s.difficulty.boss_hp}, 공격×${s.difficulty.boss_attack}. 양수 roundi 후 표시.`}</p><p>보상: data/economy/campaign_rewards.json · 지급 경계: src/meta/playfab/local_campaign_commands.gd</p></details>`;
    document.getElementById('board-close').onclick=()=>{selected=null;history.replaceState(null,'',`${location.pathname}#boards`);render();document.getElementById('board-title').scrollIntoView({block:'start'});};
  }
  async function open(id){
    selected=id||null;
    if(!data){
      document.getElementById('board-loading').hidden=false;
      document.getElementById('board-error').hidden=true;
      try{
        const response=await fetch('data/boards.json');if(!response.ok)throw Error(response.status);
        data=await response.json();
        document.getElementById('board-chapter').innerHTML='<option value="">모든 장</option>'+[...new Set(data.stages.map(s=>s.chapter))].map(c=>`<option>${esc(c)}</option>`).join('');
        document.getElementById('board-baseline').innerHTML='<option value="previous">직전 탄</option>'+data.stages.map(s=>`<option value="${s.id}">${s.number}탄 ${esc(s.title)}</option>`).join('');
        document.getElementById('board-scope').textContent=data.scope+' · 데이터 생성 '+new Date(data.generated_at).toLocaleString('ko-KR');
        document.getElementById('board-notes').innerHTML=data.notes.map(n=>`<li>${esc(n)}</li>`).join('');
        document.getElementById('board-sources').innerHTML=Object.entries(data.sources).map(([p,h])=>`<li>${esc(p)} <code>${h.slice(0,12)}</code></li>`).join('');
        document.getElementById('board-weights').innerHTML=Object.entries(weights).map(([k,w])=>`<label>${esc(data.items[k])}<input data-weight="${k}" type="number" min="0" max="1000000" step="any" value="${w}"></label>`).join('');
        document.querySelectorAll('[data-weight]').forEach(el=>el.oninput=()=>{weights[el.dataset.weight]=Math.max(0,Math.min(1e6,Number(el.value)||0));render();});
        ['board-type','board-chapter','board-metric'].forEach(k=>document.getElementById(k).onchange=render);
        document.getElementById('board-search').oninput=render;
        document.getElementById('board-baseline').onchange=e=>{baseline=e.target.value;render();};
        document.querySelectorAll('[data-board-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.boardMode;render();});
        document.getElementById('board-reset-weights').onclick=()=>{Object.keys(weights).forEach(k=>{weights[k]=k==='meta_coins'?1:0;document.querySelector(`[data-weight="${k}"]`).value=weights[k];});render();};
        document.getElementById('board-ready').hidden=false;
      }catch(error){document.getElementById('board-error').hidden=false;return;}
      finally{document.getElementById('board-loading').hidden=true;}
    }
    if(selected&&!data.stages.some(s=>s.id===selected))selected=null;
    render();
  }
  return {open};
})();
