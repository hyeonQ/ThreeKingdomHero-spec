/* Read-only status presentation. No product/account state and no remote writes. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const labels = {implementation:'구현', validation:'검증 기록', quality:'화면·연출'};
  let data, items, catalog = [], loading, options = {area:'', filter:'all', query:'', item:''};
  let bound = false;
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
    history.replaceState(null, '', `${location.pathname}${location.search}#progress${params.size ? '&' + params : ''}`);
  }

  function readRoute() {
    const params = new URLSearchParams(location.hash.replace(/^#progress&?/, ''));
    options = {area:params.get('area') || '', filter:params.get('filter') || 'all', query:params.get('q') || '', item:params.get('item') || ''};
    if (!data.areas.some(area => area.id === options.area)) options.area = '';
    if (!['all','attention','unfinished','approved','stale'].includes(options.filter)) options.filter = 'all';
    if (!items.some(item => item.id === options.item)) options.item = '';
  }

  function sourceLink(path) {
    const doc = catalog.find(doc => doc.path === path && !doc.section);
    if (data.source_publication?.[path] !== 'same') return `<span class="progress-source-local" title="${escape(path)} · 점검한 파일은 원격 미반영">${escape(doc?.title || path.split('/').at(-1))}<small>작업트리</small></span>`;
    const href = doc ? `#doc=${doc.id}` : `https://github.com/dOFFamin-Corp/ThreeKingdomHero/blob/${data.publication_revision}/${path.split('/').map(encodeURIComponent).join('/')}`;
    return `<a href="${escape(href)}" ${doc ? '' : 'target="_blank" rel="noreferrer"'}>${escape(doc?.title || path.split('/').at(-1))}<small>${doc ? '스펙' : '원문 ↗'}</small></a>`;
  }

  function row(item) {
    return `<details class="progress-item" id="progress-item-${item.id}" ${options.item === item.id ? 'open' : ''}>
      <summary><span class="progress-item-name"><strong>${escape(item.title)}</strong><small>${escape(item.hold || item.group)}${itemImages(item.id).length ? ` · 화면 ${itemImages(item.id).length}장` : ''}${item.changed_sources?.length ? ' · 근거 변경' : ''}</small></span>
      <span class="progress-cell" data-label="구현">${badge('implementation',item.implementation)}</span><span class="progress-cell" data-label="검증">${badge('validation',item.validation)}</span><span class="progress-cell" data-label="표현">${badge('quality',item.quality)}</span><span class="progress-chevron" aria-hidden="true">＋</span></summary>
      <div class="progress-detail"><div><span>지금 상태</span><p>${escape(item.current)}</p></div><div><span>다음 확인</span><p>${escape(item.next)}</p></div>
      ${itemImages(item.id).length ? `<section class="progress-detail-shots" aria-label="기존 게임 화면"><div class="progress-shots">${itemImages(item.id).map(shotCard).join('')}</div></section>` : '<p class="progress-no-shots">등록된 기존 캡처 없음</p>'}
      <footer>${item.changed_sources?.length ? `<p class="progress-changed">점검 이후 근거 ${item.changed_sources.length}개가 변경됐습니다. 위 상태를 다시 확인해야 합니다.</p>` : ''}<div class="progress-sources"><span>근거</span>${item.sources.map(sourceLink).join('')}</div><small>작업트리 = 원격 미반영. 원문 링크는 저장소 권한이 필요할 수 있습니다. 검증은 기록된 범위에 한합니다.</small></footer></div></details>`;
  }

  function renderList() {
    const filtered = ProgressModel.filter(items, options);
    $('progress-list-title').textContent = data.areas.find(area => area.id === options.area)?.name || '전체 영역';
    $('progress-count').textContent = `${filtered.length} / ${items.length}항목`;
    $('progress-search').value = options.query;
    document.querySelectorAll('#progress-filters button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === options.filter)));
    document.querySelectorAll('#progress-areas button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.area === options.area)));
    $('progress-list').innerHTML = data.areas.map(area => {
      const selected = filtered.filter(item => item.area === area.id);
      if (!selected.length) return '';
      return `<section class="progress-section"><div class="progress-section-head"><div><span>${escape(area.eyebrow)}</span><h3>${escape(area.name)} <small>${selected.length}</small></h3></div><div class="progress-columns"><span>구현</span><span>검증 기록</span><span>화면·연출</span></div></div>${selected.map(row).join('')}</section>`;
    }).join('') || '<div class="progress-empty"><h3>조건에 맞는 항목이 없습니다.</h3><p>검색어나 필터를 바꿔 보세요.</p></div>';
    // Store the user's intent synchronously. The native toggle event is queued
    // and can be lost on reload or fired by programmatic reconstruction.
    document.querySelectorAll('.progress-item').forEach(detail => detail.querySelector('summary').addEventListener('click', () => {
      const id = detail.id.replace('progress-item-', '');
      if (!detail.open) options.item = id;
      else if (options.item === id) options.item = '';
      saveRoute();
    }));
    renderGallery(filtered);
  }

  function render() {
    $('progress-date').textContent = data.reviewed_at.replaceAll('-', '.');
    $('progress-version').textContent = `수동 점검 · ${data.snapshot_id}`;
    $('progress-scope').textContent = data.scope;
    $('progress-basis').textContent = data.basis;
    const totals = ProgressModel.stats(items);
    $('progress-summary').innerHTML = [[totals.integrated,'본편 연결','현재 게임 경로'],[totals.underway,'부분·로컬·시안','연결 범위 확인'],[totals.pending,'설계·미구현','구현 전 또는 보류'],[totals.attention,'손볼 곳','다음 점검 대상']].map(([count,label,sub]) => `<div><strong>${count}<small>항목</small></strong><span>${label}</span><p>${sub}</p></div>`).join('');
    $('progress-drift').hidden = !totals.stale;
    $('progress-drift').textContent = `근거가 바뀐 ${totals.stale}항목이 있습니다. ‘근거 변경’ 필터에서 재점검 대상을 확인하세요.`;
    $('progress-areas').innerHTML = data.areas.map((area,index) => {
      const group = items.filter(item => item.area === area.id), counts = ProgressModel.stats(group);
      const segments = Object.entries(data.states.implementation).map(([key,state]) => {
        const count = group.filter(item => item.implementation === key).length;
        return count ? `<span class="segment-${key}" style="width:${count / group.length * 100}%" title="${escape(state.label)} ${count}항목"></span>` : '';
      }).join('');
      return `<button type="button" class="progress-area" data-area="${area.id}" aria-pressed="false"><span class="progress-area-top"><small>0${index+1} / ${escape(area.eyebrow)}</small><b>${counts.total}</b></span><h2>${escape(area.name)}</h2><p>${escape(area.summary)}</p><div class="progress-segments" aria-label="본편 연결 ${counts.integrated}, 부분·로컬·시안 ${counts.underway}, 설계·미구현 ${counts.pending}">${segments}</div><footer><span>본편 <b>${counts.integrated}</b> · 진행 <b>${counts.underway}</b> · 준비 <b>${counts.pending}</b></span><span>${counts.attention ? `점검 ${counts.attention}` : '보기'} ↗</span></footer></button>`;
    }).join('');
    document.querySelectorAll('.progress-area').forEach(button => button.addEventListener('click', () => {
      options.area = options.area === button.dataset.area ? '' : button.dataset.area; options.item = ''; saveRoute(); renderList();
      if (matchMedia('(max-width: 700px)').matches) $('progress-list-title').scrollIntoView({behavior:'smooth',block:'start'});
    }));
    $('progress-focus').innerHTML = data.focus.map(id => {
      const item = items.find(item => item.id === id);
      return `<button data-item="${id}"><strong>${escape(item.title)} ↗</strong><span>${escape(item.next)}</span></button>`;
    }).join('');
    document.querySelectorAll('#progress-focus button').forEach(button => button.addEventListener('click', () => {
      const item = items.find(item => item.id === button.dataset.item);
      options = {area:item.area,filter:'all',query:'',item:item.id}; saveRoute(); renderList();
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
      $('progress-gallery-toggle').addEventListener('click', () => {galleryExpanded = !galleryExpanded; renderGallery(ProgressModel.filter(items, options));});
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
      $('progress-search').addEventListener('input', event => {options.query = event.target.value; options.item = ''; saveRoute(); renderList();});
      $('progress-reset').addEventListener('click', () => {options = {area:'',filter:'all',query:'',item:''}; saveRoute(); renderList();});
      $('progress-filters').addEventListener('click', event => {
        const button = event.target.closest('button[data-filter]'); if (!button) return;
        options.filter = button.dataset.filter; options.item = ''; saveRoute(); renderList();
      });
    }
    $('progress-error').hidden = true;
    try {
      if (!data) {
        loading ||= fetch('data/progress.json', {cache:'no-cache'}).then(response => {if (!response.ok) throw Error('status unavailable'); return response.json();});
        data = await loading;
        if (data.version !== 1 || !Array.isArray(data.areas) || !data.states) throw Error('invalid status');
        items = ProgressModel.flatten(data);
      }
      readRoute(); render(); $('progress-content').hidden = false;
      if (options.item) requestAnimationFrame(() => $(`progress-item-${options.item}`)?.scrollIntoView({block:'center'}));
    } catch {
      data = null; $('progress-content').hidden = true; $('progress-error').hidden = false;
    } finally { loading = null; }
  }
  window.ProgressDashboard = {open};
})();
