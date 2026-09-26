/* Read-only status presentation. No product/account state and no remote writes. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const labels = {implementation:'구현', validation:'검증 기록', quality:'화면·연출'};
  let data, items, tree, expanded = new Set(), catalog = [], loading, options = {area:'', filter:'all', query:'', item:''};
  let bound = false, autoExpand = true;
  let galleryExpanded = false, galleryKey = '', galleryImages = [], lightboxImages = [], lightboxIndex = 0, lightboxTrigger;

  const itemImages = id => (data.screenshots || []).filter(shot => shot.items.includes(id));

  function shotCard(shot) {
    return `<button type="button" class="progress-shot" data-shot="${escape(shot.id)}" aria-haspopup="dialog" aria-label="${escape(shot.title)} 크게 보기"><span class="progress-shot-image"><img src="${escape(shot.path)}" alt="${escape(shot.title)}" loading="lazy" decoding="async"></span><strong>${escape(shot.title)}</strong><small>${escape(shot.context)} · 저장 ${escape(shot.saved_at)}</small></button>`;
  }

  function renderGallery(filtered) {
    const key = [options.area, options.filter, options.query].join('|');
    if (key !== galleryKey) galleryExpanded = false;
    galleryKey = key;
    const visible = new Set(filtered.map(item => item.id));
    galleryImages = (data.screenshots || []).filter(shot => shot.items.some(id => visible.has(id)));
    $('progress-gallery-count').textContent = `${galleryImages.length}장`;
    $('progress-gallery-toggle').hidden = galleryImages.length <= 6;
    $('progress-gallery-toggle').textContent = galleryExpanded ? '접기' : `${galleryImages.length}장 모두 보기`;
    $('progress-gallery-toggle').setAttribute('aria-expanded', String(galleryExpanded));
    $('progress-gallery-grid').innerHTML = galleryImages.length ? (galleryExpanded ? galleryImages : galleryImages.slice(0,6)).map(shotCard).join('') : '<p class="progress-no-shots">이 조건에 맞는 기존 캡처가 없습니다. 새 촬영은 하지 않았습니다.</p>';
  }

  function showCapture(index) {
    lightboxIndex = (index + lightboxImages.length) % lightboxImages.length;
    const shot = lightboxImages[lightboxIndex];
    $('progress-lightbox-title').textContent = shot.title;
    $('progress-lightbox-meta').textContent = `${shot.context} · 파일 저장일 ${shot.saved_at}`;
    $('progress-lightbox-note').textContent = shot.note;
    $('progress-lightbox-position').textContent = `${lightboxIndex+1} / ${lightboxImages.length}`;
    $('progress-lightbox-original').href = shot.path;
    $('progress-lightbox-error').hidden = true;
    const img = $('progress-lightbox-image');
    img.hidden = false; img.alt = shot.title; img.src = shot.path;
    $('progress-lightbox-prev').disabled = $('progress-lightbox-next').disabled = lightboxImages.length < 2;
  }

  function openCapture(button) {
    const detail = button.closest('.progress-item');
    lightboxImages = detail ? itemImages(detail.id.replace('progress-item-', '')) : galleryImages;
    const index = lightboxImages.findIndex(shot => shot.id === button.dataset.shot);
    if (index < 0) return;
    lightboxTrigger = button; showCapture(index);
    $('progress-lightbox').showModal(); document.body.classList.add('progress-modal-open');
  }

  function badge(axis, value) {
    const state = data.states[axis][value];
    return `<span class="progress-badge tone-${state.tone}" title="${escape(state.description)}">${escape(state.label)}</span>`;
  }

  function saveRoute() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value && !(key === 'filter' && value === 'all')) params.set(key === 'query' ? 'q' : key, value);
    if (expanded.size) params.set('open', [...expanded].join(','));
    if (!autoExpand) params.set('folded', '1');
    history.replaceState(null, '', `${location.pathname}${location.search}#progress${params.size ? '&' + params : ''}`);
  }

  function readRoute() {
    const params = new URLSearchParams(location.hash.replace(/^#progress&?/, ''));
    options = {area:params.get('area') || '', filter:params.get('filter') || 'all', query:params.get('q') || '', item:params.get('item') || ''};
    const branches = new Set(items.flatMap(item => item.ancestors.map(node => node.id)));
    expanded = new Set((params.get('open') || '').split(',').filter(id => branches.has(id)));
    autoExpand = params.get('folded') !== '1';
    if (!branches.has(options.area)) options.area = '';
    if (!['all','remaining','done','review','outside','attention','unfinished','approved','stale'].includes(options.filter)) options.filter = 'all';
    if (!items.some(item => item.id === options.item)) options.item = '';
  }

  function sourceLink(path) {
    const doc = catalog.find(doc => doc.path === path && !doc.section);
    if (data.source_publication?.[path] !== 'same') return `<span class="progress-source-local" title="${escape(path)} · 점검한 파일은 원격 미반영">${escape(doc?.title || path.split('/').at(-1))}<small>작업트리</small></span>`;
    const href = doc ? `#doc=${doc.id}` : `https://github.com/dOFFamin-Corp/ThreeKingdomHero/blob/${data.publication_revision}/${path.split('/').map(encodeURIComponent).join('/')}`;
    return `<a href="${escape(href)}" ${doc ? '' : 'target="_blank" rel="noreferrer"'}>${escape(doc?.title || path.split('/').at(-1))}<small>${doc ? '스펙' : '원문 ↗'}</small></a>`;
  }

  const statusLabels = {done:'완료',remaining:'작업 남음',review:'검수·재점검',decision:'범위 결정'};
  const statusTones = {done:'green',remaining:'amber',review:'blue',decision:'gray'};

  function row(item) {
    const external = item.scope !== 'required';
    return `<details class="progress-item ${external ? 'scope-outside' : ''}" id="progress-item-${item.id}" ${options.item === item.id ? 'open' : ''}>
      <summary aria-label="${escape(item.title)}, ${external ? '집계 제외' : statusLabels[item.status]}"><span class="leaf-mark status-${item.status}" aria-hidden="true">${item.status === 'done' ? '✓' : '○'}</span><span class="progress-item-name"><strong>${escape(item.title)}</strong><small>${external ? (item.scope === 'conditional' ? '조건부 · 유료 판매 선택 시' : '선택 후속 · 초기 필수 범위 밖') : item.changed_sources?.length ? '점검 이후 근거 변경' : '필수 세부 항목'}</small></span><span class="progress-badge tone-${external ? 'gray' : statusTones[item.status]}">${external ? '집계 제외' : statusLabels[item.status]}</span><span class="progress-chevron" aria-hidden="true">＋</span></summary>
      <div class="progress-detail"><div class="launch-criterion"><span>완료 조건</span><p>${escape(item.criterion)}</p></div><div><span>지금 상태 · ${escape(data.reviewed_at)} 점검</span><p>${escape(item.current)}</p></div><div><span>${item.status === 'done' ? '후속 확인 · 공통 출시 검증은 별도 집계' : '남은 일'}</span><p>${escape(item.next)}</p></div>
      <div class="detail-statuses">${Object.keys(labels).map(axis => `<span>${labels[axis]} ${badge(axis,item[axis])}</span>`).join('')}</div>
      ${itemImages(item.id).length ? `<section class="progress-detail-shots" aria-label="기존 게임 화면"><div class="progress-shots">${itemImages(item.id).map(shotCard).join('')}</div></section>` : ''}
      <footer>${item.changed_sources?.length ? `<p class="progress-changed">점검 이후 근거 ${item.changed_sources.length}개 변경. 기존 완료 기록은 재점검 전까지 완료 수에서 제외합니다.</p>` : ''}<div class="progress-sources"><span>근거</span>${item.sources.map(sourceLink).join('')}</div><small>작업트리 = 원격 미반영. 기록된 검증 범위를 기준으로 표시합니다.</small></footer></div></details>`;
  }

  function branch(node, selected, depth = 0) {
    if (!ProgressModel.leaves(node).some(item => selected.has(item.id))) return '';
    if (!node.children) return row(node);
    const counts = ProgressModel.launchStats(node);
    const forced = autoExpand && (!!options.query || options.filter !== 'all' || !!options.area || ProgressModel.leaves(node).some(item => item.id === options.item));
    const isOpen = expanded.has(node.id) || forced;
    const groups = node.children.some(child => child.children);
    return `<details class="launch-branch depth-${depth}" data-node="${node.id}" ${isOpen ? 'open' : ''}>
      <summary aria-label="${escape(node.title)}, 필수 세부 ${counts.done}/${counts.total} 완료, 남은 ${counts.remaining}개"><span class="tree-chevron" aria-hidden="true">›</span><span class="branch-name"><strong>${escape(node.title)}</strong><small>${groups ? `하위 분야 ${counts.childrenDone}/${counts.children} 완료 · ` : ''}남은 ${counts.remaining}개${counts.outside ? ` · 집계 제외 ${counts.outside}개` : ''}</small></span><span class="branch-count" aria-label="${escape(node.title)} 필수 세부 항목 ${counts.total}개 중 ${counts.done}개 완료"><b>${counts.done}</b><span> / ${counts.total}</span><small>완료 / 전체</small></span><span class="branch-meter" aria-hidden="true"><i style="width:${counts.total ? counts.done/counts.total*100 : 0}%"></i></span></summary>
      <div class="branch-children">${node.children.map(child => branch(child, selected, depth+1)).join('')}</div></details>`;
  }

  function renderList() {
    const filtered = ProgressModel.launchFilter(items, options);
    $('progress-list-title').textContent = items.flatMap(item=>item.ancestors).find(node=>node.id===options.area)?.title || '전체 개발 범위';
    $('progress-count').textContent = `세부 ${filtered.length}개 표시 · 필수 ${ProgressModel.launchStats(tree).total}개 기준`;
    $('progress-search').value = options.query;
    document.querySelectorAll('#progress-filters button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === options.filter)));
    document.querySelectorAll('#progress-areas button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.area === options.area)));
    const selected = new Set(filtered.map(item=>item.id));
    $('progress-list').innerHTML = tree.map(node => branch(node, selected)).join('') || '<div class="progress-empty"><h3>조건에 맞는 항목이 없습니다.</h3><p>검색어나 필터를 바꿔 보세요.</p></div>';
    document.querySelectorAll('.launch-branch').forEach(detail => detail.querySelector(':scope > summary').addEventListener('click', () => {
      detail.open ? expanded.delete(detail.dataset.node) : expanded.add(detail.dataset.node);
      saveRoute();
    }));
    document.querySelectorAll('.progress-item').forEach(detail => detail.querySelector('summary').addEventListener('click', () => {
      const id = detail.id.replace('progress-item-', '');
      if (!detail.open) options.item = id;
      else if (options.item === id) options.item = '';
      // Save every currently open ancestor so a shared leaf route is useful.
      let parent = detail.parentElement.closest('.launch-branch');
      while (parent) {expanded.add(parent.dataset.node); parent=parent.parentElement.closest('.launch-branch');}
      saveRoute();
    }));
    renderGallery(filtered);
  }

  function render() {
    $('progress-date').textContent = data.launch.organized_at.replaceAll('-', '.');
    $('progress-version').textContent = `상태 점검 ${data.reviewed_at.replaceAll('-', '.')} · 수동 갱신`;
    $('progress-scope').textContent = '완료는 항목별 조건 기준입니다. 실기기·경제·실서비스 검증은 별도 필수 항목으로 집계합니다.';
    $('progress-basis').textContent = data.launch.counting + ' ' + data.launch.basis + ' ' + data.basis;
    const totals = ProgressModel.launchStats(tree);
    $('progress-summary').innerHTML = `<div class="summary-complete"><span>필수 세부 항목</span><strong>${totals.done}<em> / ${totals.total}</em></strong><p>완료 조건을 충족한 항목</p></div><div><span>남은 항목</span><strong>${totals.remaining}<small>개</small></strong><p>구현 · 검수 · 운영 준비</p></div><div><span>검수·재점검</span><strong>${totals.review}<small>개</small></strong><p>남은 항목에 포함</p></div><div><span>조건부·선택 후속</span><strong>${totals.outside}<small>개</small></strong><p>필수 분모에서 제외</p></div>`;
    const stale = items.filter(item=>item.changed_sources?.length).length;
    $('progress-drift').hidden = !stale;
    $('progress-drift').textContent = `근거 변경 ${stale}개 · 기존 기록을 유지하되, 바뀐 완료 항목은 재점검으로 집계합니다.`;
    $('progress-areas').innerHTML = [{id:'',title:'전체 분야'},...tree].map(node => `<button type="button" data-area="${node.id}" aria-pressed="false">${escape(node.title)}</button>`).join('');
    document.querySelectorAll('#progress-areas button').forEach(button => button.addEventListener('click', () => {
      options.area = button.dataset.area; options.item=''; saveRoute(); renderList();
    }));
    $('progress-focus').innerHTML = data.focus.map(id => {
      const item = items.find(item => item.id === id);
      return `<button data-item="${id}"><strong>${escape(item.title)} ↗</strong><span>${escape(item.criterion)}</span></button>`;
    }).join('');
    document.querySelectorAll('#progress-focus button').forEach(button => button.addEventListener('click', () => {
      const item = items.find(item => item.id === button.dataset.item);
      autoExpand=true; options = {area:'',filter:'all',query:'',item:item.id}; saveRoute(); renderList();
      $(`progress-item-${item.id}`).scrollIntoView({behavior:'smooth',block:'center'});
    }));
    $('progress-legend').innerHTML = Object.entries(labels).map(([axis,label]) => `<div><h3>${label}</h3>${Object.entries(data.states[axis]).map(([key,state]) => `<p>${badge(axis,key)}<span>${escape(state.description)}</span></p>`).join('')}</div>`).join('');
    renderList();
  }

  async function open(documents) {
    catalog = documents || catalog;
    if (!bound) {
      bound = true;
      const dialog = $('progress-lightbox');
      $('progress-content').addEventListener('click', event => {
        const button = event.target.closest('button[data-shot]');
        if (button) openCapture(button);
      });
      $('progress-gallery-toggle').addEventListener('click', () => {galleryExpanded = !galleryExpanded; renderGallery(ProgressModel.launchFilter(items, options));});
      $('progress-lightbox-close').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => {
        document.body.classList.remove('progress-modal-open');
        if (lightboxTrigger?.isConnected) lightboxTrigger.focus({preventScroll:true});
      });
      dialog.addEventListener('click', event => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
      });
      dialog.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); showCapture(lightboxIndex + (event.key === 'ArrowLeft' ? -1 : 1));}
      });
      $('progress-lightbox-prev').addEventListener('click', () => showCapture(lightboxIndex - 1));
      $('progress-lightbox-next').addEventListener('click', () => showCapture(lightboxIndex + 1));
      $('progress-lightbox-image').addEventListener('error', () => {$('progress-lightbox-image').hidden = true; $('progress-lightbox-error').hidden = false;});
      window.addEventListener('hashchange', () => {if (dialog.open) dialog.close();});
      $('progress-retry').addEventListener('click', () => { data = null; open(); });
      $('progress-search').addEventListener('input', event => {autoExpand=true; options.query = event.target.value; options.item = ''; saveRoute(); renderList();});
      document.querySelectorAll('[data-depth]').forEach(button => button.addEventListener('click', () => {
        options.item=''; autoExpand=false; expanded=new Set(button.dataset.depth === 'all' ? items.flatMap(item=>item.ancestors.map(node=>node.id)) : button.dataset.depth === 'areas' ? tree.map(node=>node.id) : []);
        saveRoute(); renderList();
      }));
      $('progress-reset').addEventListener('click', () => {autoExpand=true; expanded.clear(); options = {area:'',filter:'all',query:'',item:''}; saveRoute(); renderList();});
      $('progress-filters').addEventListener('click', event => {
        const button = event.target.closest('button[data-filter]'); if (!button) return;
        autoExpand=true; options.filter = button.dataset.filter; options.item = ''; saveRoute(); renderList();
      });
    }
    $('progress-error').hidden = true;
    try {
      if (!data) {
        loading ||= fetch('data/progress.json', {cache:'no-cache'}).then(response => {if (!response.ok) throw Error('status unavailable'); return response.json();});
        data = await loading;
        if (data.version !== 1 || !Array.isArray(data.areas) || !data.states || data.launch?.version !== 1) throw Error('invalid status');
        tree = ProgressModel.launchTree(data); items = ProgressModel.leaves(tree);
      }
      readRoute(); render(); $('progress-content').hidden = false;
      if (options.item) requestAnimationFrame(() => $(`progress-item-${options.item}`)?.scrollIntoView({block:'center'}));
    } catch {
      data = null; $('progress-content').hidden = true; $('progress-error').hidden = false;
    } finally { loading = null; }
  }
  window.ProgressDashboard = {open};
})();
