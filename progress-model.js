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
  function launchTree(data) {
    const source = new Map(flatten(data).map(item => [item.id, item]));
    const visit = (node, ancestors = []) => {
      if (node.item) {
        const item = source.get(node.item);
        if (!item) throw Error('Unknown checklist item');
        return {...item, ...node, ancestors, status: node.status === 'done' && item.changed_sources?.length ? 'review' : node.status};
      }
      const path = [...ancestors, {id:node.id,title:node.title}];
      return {...node, children:node.children.map(child => visit(child, path))};
    };
    return data.launch.tree.map(node => visit(node));
  }
  const leaves = node => Array.isArray(node) ? node.flatMap(leaves) : node.children ? node.children.flatMap(leaves) : [node];
  function launchStats(node) {
    const all = leaves(node), required = all.filter(item => item.scope === 'required');
    const done = required.filter(item => item.status === 'done').length;
    const children = (Array.isArray(node) ? node : node.children || []).filter(child => leaves(child).some(item => item.scope === 'required'));
    return {total:required.length, done, remaining:required.length-done,
      review:required.filter(item => item.status === 'review' || item.changed_sources?.length).length,
      outside:all.length-required.length,
      children:children.length, childrenDone:children.filter(child => leaves(child).filter(item => item.scope === 'required').every(item => item.status === 'done')).length};
  }
  function launchFilter(all, options) {
    const query = (options.query || '').trim().toLocaleLowerCase('ko');
    return all.filter(item => (!options.area || item.ancestors.some(node => node.id === options.area))
      && (!query || [item.title,item.current,item.next,item.criterion,...item.ancestors.map(node=>node.title)].join(' ').toLocaleLowerCase('ko').includes(query))
      && ({all:true, remaining:item.scope === 'required' && item.status !== 'done', done:item.scope === 'required' && item.status === 'done', review:item.scope === 'required' && (item.status === 'review' || !!item.changed_sources?.length), outside:item.scope !== 'required', approved:item.quality === 'approved', stale:!!item.changed_sources?.length, attention:item.attention, unfinished:item.implementation !== 'integrated'}[options.filter || 'all'] === true));
  }
  const api = {flatten, stats, filter, launchTree, leaves, launchStats, launchFilter};
  root.ProgressModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
