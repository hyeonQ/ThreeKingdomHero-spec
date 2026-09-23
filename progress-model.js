(function (root) {
  'use strict';
  const flatten = data => data.areas.flatMap(area => area.groups.flatMap(group => group.items.map(item => ({...item, area: area.id, areaName: area.name, group: group.name}))));
  const stats = items => ({total: items.length, integrated: items.filter(x => x.implementation === 'integrated').length, underway: items.filter(x => ['partial', 'local', 'prototype'].includes(x.implementation)).length, pending: items.filter(x => ['design', 'planned'].includes(x.implementation)).length, attention: items.filter(x => x.attention).length, stale: items.filter(x => x.changed_sources?.length).length});
  function filter(items, options) {
    const query = (options.query || '').trim().toLocaleLowerCase('ko');
    return items.filter(item => (!options.area || item.area === options.area)
      && (!query || [item.title, item.areaName, item.group, item.current, item.next].join(' ').toLocaleLowerCase('ko').includes(query))
      && ({all: true, attention: item.attention, unfinished: item.implementation !== 'integrated', approved: item.quality === 'approved', stale: !!item.changed_sources?.length}[options.filter || 'all'] === true));
  }
  const api = {flatten, stats, filter};
  root.ProgressModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
