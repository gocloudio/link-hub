'use strict';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 7.8"/><circle cx="9" cy="7" r="4"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.2-2.5H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="10" r=".5"/><circle cx="10" cy="6.5" r=".5"/><circle cx="15" cy="6.5" r=".5"/><circle cx="18" cy="10" r=".5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  project: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16M6 8v4m6-4v7m6-7v2"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  shield: '<path d="M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7Zm-4 9 3 3 5-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  moon: '<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  sort: '<path d="M4 5v14m-3-3 3 3 3-3M11 5h10m-10 5h7m-7 5h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  link: '<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  edit: '<path d="m16 3 5 5-13 13H3v-5Zm-2 2 5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 12l-2-1 2-4 2 1 3-2V3h6v3l3 2 2-1 2 4-2 1v3l2 1-2 4-2-1-3 2H9l-3-2-2 1-2-4 2-1Z" transform="translate(1 0) scale(.9)"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-9 7 7 0 0 1 13 3 3 3 0 0 1-1 6Z"/>',
  github: '<path d="M8 20c-4 1-4-2-6-2m14 4v-3.5a3 3 0 0 0-.9-2.3c3-.4 6.1-1.5 6.1-6.7A5.2 5.2 0 0 0 19.8 6a4.8 4.8 0 0 0-.1-3.5S18.5 2.1 16 3.8a12 12 0 0 0-7 0C6.5 2.1 5.3 2.5 5.3 2.5A4.8 4.8 0 0 0 5.2 6a5.2 5.2 0 0 0-1.4 3.5c0 5.2 3.1 6.3 6.1 6.7A3 3 0 0 0 9 18.5V22"/>',
  triangle: '<path d="m12 5 9 15H3Z" fill="currentColor" stroke="none"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.link}</svg>`;
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeURL(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function domain(value) { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; } }

// Deliberately bounded renderer for this framework-free prototype. All raw HTML is escaped.
// The production React implementation will use the installed Markdown editor and renderer.
function inlineMarkdown(text) {
  const tokens = [];
  const keep = html => { tokens.push(html); return `\uE000${tokens.length - 1}\uE001`; };
  let result = String(text).replace(/[\uE000\uE001]/g, '').replace(/`([^`]+)`/g, (_, code) => keep(`<code>${escapeHTML(code)}</code>`));
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');
  result = result.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, target) => {
    const url = safeURL(target);
    return keep(url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>` : escapeHTML(label));
  });
  result = escapeHTML(result).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return result.replace(/\uE000(\d+)\uE001/g, (_, index) => tokens[Number(index)] || '');
}
function renderMarkdown(source) {
  const lines = String(source).replace(/\r/g, '').split('\n');
  let result = '', list = '', paragraph = [], code = [], fenced = false;
  const flushParagraph = () => { if (paragraph.length) result += `<p>${inlineMarkdown(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`; paragraph = []; };
  const closeList = () => { if (list) result += `</${list}>`; list = ''; };
  for (const line of lines) {
    if (/^\s*```/.test(line)) { flushParagraph(); closeList(); if (fenced) { result += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`; code = []; } fenced = !fenced; continue; }
    if (fenced) { code.push(line); continue; }
    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/), item = line.match(/^\s*(?:([-*])|\d+\.)\s+(.+)$/);
    if (heading) { flushParagraph(); closeList(); result += `<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`; }
    else if (item) { flushParagraph(); const type = item[1] ? 'ul' : 'ol'; if (list !== type) { closeList(); result += `<${type}>`; list = type; } result += `<li>${inlineMarkdown(item[2])}</li>`; }
    else { closeList(); paragraph.push(line); }
  }
  flushParagraph(); closeList();
  if (fenced) result += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`;
  return result;
}
function excerpt(source) { const container = document.createElement('div'); container.innerHTML = renderMarkdown(source); const firstParagraph = container.querySelector('p'); return ((firstParagraph || container).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 125); }

const categoriesSeed = [
  {id:'docs',name:'常用文档',icon:'document'}, {id:'team',name:'团队协作',icon:'users'},
  {id:'dev',name:'开发工具',icon:'code'}, {id:'design',name:'设计资源',icon:'palette'},
  {id:'project',name:'项目管理',icon:'project'}, {id:'ops',name:'运维监控',icon:'activity'}
];
const seed = [
  ['github','GitHub','github.com','代码托管与协作开发。管理仓库、审查代码，让每一次提交都有迹可循。',['dev'],'github','#f1f2f4','#262b33'],
  ['figma','Figma','figma.com','从灵感到交付的设计协作空间。查看设计稿、制作原型，让想法落地。',['design','team'],'figma','#f8f3ef','#272a30'],
  ['notion','Notion','notion.so','团队知识的共同记忆。沉淀文档、整理会议记录，找到你需要的答案。',['docs','team'],'N','#f2f2f0','#202020'],
  ['linear','Linear','linear.app','让项目有序向前。跟踪需求、安排迭代，将每个想法变成可交付的工作。',['project'],'◒','#efedfb','#7465c4'],
  ['slack','Slack','slack.com','把沟通放在一起。按项目和话题协作，减少信息在不同对话间流转。',['team'],'✣','#f7eef4','#a65288'],
  ['grafana','Grafana','grafana.com','数据一目了然。查看服务监控与业务看板，及时了解系统运行情况。',['ops'],'activity','#fff3e9','#e99835'],
  ['sentry','Sentry','sentry.io','更早发现，更快解决。集中查看应用错误，定位问题发生的上下文。',['dev','ops'],'triangle','#f3edf4','#735a79'],
  ['postman','Postman','postman.com','API 开发与调试工作台。组织接口集合，让测试和联调更顺畅。',['dev'],'link','#fff0e8','#e78855'],
  ['vercel','Vercel','vercel.com','从代码到上线。查看项目部署、预览最新改动，快速交付网页应用。',['dev','ops'],'triangle','#efefef','#252525'],
  ['confluence','Confluence','atlassian.com/software/confluence','把经验写下来。管理项目文档、整理工作流程，共享团队的实践与共识。',['docs'],'≈','#edf4ff','#4586c6'],
  ['aliyun','阿里云','aliyun.com','云资源管理入口。集中访问计算、存储与网络服务，管理基础设施。',['ops'],'cloud','#fff1e7','#e78a42'],
  ['microsoft','Microsoft 365','microsoft365.com','日常办公的协作空间。访问邮件、共享文件，与团队一起完成工作。',['team','docs'],'grid','#edf3fa','#5b8ec9']
];
const cardsSeed = seed.map((s, index) => ({id:s[0],name:s[1],url:`https://${s[2]}`,categories:s[4],logo:s[5],background:s[6],color:s[7],createdAt:Date.now() - (index + 1) * 86400000,description:`${s[3]}\n\n### 使用说明\n\n- 使用团队账号登录并访问已授权的工作空间。\n- 进入对应项目，查看最新内容。\n- 遇到权限问题，请联系团队管理员。${s[0] === 'github' ? '\n\n### 常用命令\n\n```bash\ngit clone <repository-url>\ngit switch -c feature/my-work\n```' : ''}\n\n[打开 ${s[1]}](https://${s[2]})` }));
const STORAGE_KEY = 'link-hub-prototype-v1';
let categories = structuredClone(categoriesSeed), cards = structuredClone(cardsSeed), activeCategory = 'all', admin = false;
try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved && Array.isArray(saved.categories) && Array.isArray(saved.cards) && saved.categories.every(c => c.id && typeof c.name === 'string') && saved.cards.every(c => c.id && typeof c.name === 'string' && typeof c.description === 'string' && Array.isArray(c.categories) && safeURL(c.url))) { categories = saved.categories; cards = saved.cards; } } catch { /* Empty or unavailable storage: keep demo content. */ }
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({categories,cards})); return true; } catch { toast('浏览器无法保存，本次修改仅在当前页面有效。', true); return false; } }
const collator = new Intl.Collator('zh-CN', {numeric:true});
const sortedCategories = () => [...categories].sort((a,b) => collator.compare(a.name,b.name));
const usage = id => cards.filter(card => card.categories.includes(id)).length;
function logoHTML(card) { return card.logo === 'figma' ? '<span class="figma-symbol" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' : paths[card.logo] ? icon(card.logo) : escapeHTML(card.logo || card.name.charAt(0)); }
function logoStyle(card) { return `--logo-bg:${/^#[\da-f]{3,8}$/i.test(card.background) ? card.background : '#f0ede8'};--logo-color:${/^#[\da-f]{3,8}$/i.test(card.color) ? card.color : '#806d57'}`; }
function renderNavigation() {
  const navButton = (id,name,iconName,count) => `<button class="nav-item ${activeCategory === id ? 'active' : ''}" data-category="${escapeHTML(id)}" ${activeCategory === id ? 'aria-current="true"' : ''}>${icon(iconName)}<span>${escapeHTML(name)}</span><span class="nav-count">${count.toString().padStart(2,'0')}</span></button>`;
  $('#category-nav').innerHTML = navButton('all','全部工具','grid',cards.length) + '<div class="nav-separator"></div><div class="nav-caption">按分类浏览</div>' + sortedCategories().map(c => navButton(c.id,c.name,c.icon || 'folder',usage(c.id))).join('');
}
function render() {
  if (activeCategory !== 'all' && !categories.some(c => c.id === activeCategory)) activeCategory = 'all';
  renderNavigation();
  const current = categories.find(c => c.id === activeCategory), title = current ? current.name : '全部工具';
  $('#page-title').innerHTML = `${escapeHTML(title)}<span class="heading-dot">.</span>`;
  $('#breadcrumb-current').textContent = title;
  $('#page-description').textContent = current ? `团队共享的${current.name}，找到你需要的入口。` : '团队常用的工具、系统与文档，都在这里。';
  $('#collection-label').textContent = current ? '分类入口' : '所有入口';
  const visible = cards.filter(c => activeCategory === 'all' || c.categories.includes(activeCategory)).sort((a,b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  $('#visible-count').textContent = visible.length;
  $('#card-grid').innerHTML = visible.map((card,index) => `<article class="tool-card ${admin ? 'admin-card' : ''}" style="--i:${Math.min(index,8)}" data-card="${escapeHTML(card.id)}"><div class="card-head"><span class="tool-logo" style="${logoStyle(card)}" aria-hidden="true">${logoHTML(card)}</span><div><h2 class="card-title"><a href="${escapeHTML(safeURL(card.url))}" target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开 ${escapeHTML(card.name)}">${escapeHTML(card.name)}</a></h2><div class="card-subtitle">${escapeHTML(domain(card.url))}</div></div><span class="external-indicator">${icon('arrow-up-right')}</span></div><p class="card-description">${escapeHTML(excerpt(card.description))}</p><div class="card-footer"><div class="card-tags">${card.categories.map(id => categories.find(c => c.id === id)).filter(Boolean).map(c => `<span class="tag">${escapeHTML(c.name)}</span>`).join('')}</div>${card.description.trim() ? `<button class="details-button" data-details="${escapeHTML(card.id)}" aria-label="查看 ${escapeHTML(card.name)} 说明">查看说明${icon('chevron')}</button>` : ''}${admin ? `<div class="admin-actions"><button class="icon-button" data-edit="${escapeHTML(card.id)}" aria-label="编辑 ${escapeHTML(card.name)}" title="编辑">${icon('edit')}</button><button class="icon-button" data-delete="${escapeHTML(card.id)}" aria-label="删除 ${escapeHTML(card.name)}" title="删除">${icon('trash')}</button></div>` : ''}</div></article>`).join('');
  $('#empty-state').hidden = visible.length > 0;
  $('#empty-description').textContent = admin ? '添加第一张卡片，给团队一个新的入口。' : '试试其他分类，或等待管理员添加。';
  $('#empty-action').textContent = admin ? '添加卡片' : '查看全部工具';
  $('#add-card').hidden = !admin; $('#manage-categories').hidden = !admin; $('#heading-symbol').hidden = admin;
  $('#login-button').innerHTML = `${icon(admin ? 'users' : 'shield')}<span>${admin ? '退出演示' : '管理员登录'}</span>`;
}

let toastTimer;
function toast(message,error=false) { const el = $('#toast'); $('#toast-message').textContent = message; el.classList.toggle('error',error); el.hidden = false; if (typeof el.showPopover === 'function') el.showPopover(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { if (typeof el.hidePopover === 'function') el.hidePopover(); el.hidden = true; }, 3500); }
let returnFocus = null;
function openDialog(dialog) { returnFocus = document.activeElement; dialog.showModal(); document.body.style.overflow = 'hidden'; }
function closeDialog(dialog) { dialog.close(); }
$$('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog); } });
  dialog.addEventListener('close', () => { if (!$('dialog[open]')) document.body.style.overflow = ''; if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); else $('#login-button').focus({preventScroll:true}); });
});
$$('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
function showDescription(id) {
  const card = cards.find(c => c.id === id); if (!card) return;
  $('#description-title').textContent = card.name;
  $('#description-logo').innerHTML = logoHTML(card); $('#description-logo').setAttribute('style',logoStyle(card));
  $('#description-meta').innerHTML = card.categories.map(id => categories.find(c => c.id === id)).filter(Boolean).map(c => `<span class="tag">${escapeHTML(c.name)}</span>`).join('');
  $('#description-content').innerHTML = renderMarkdown(card.description); $('#description-domain').textContent = domain(card.url); $('#description-link').href = safeURL(card.url);
  openDialog($('#description-dialog'));
}
function categoryOptions(selected=[]) { $('#category-options').innerHTML = sortedCategories().map(c => `<label class="category-option"><input type="checkbox" name="categories" value="${escapeHTML(c.id)}" ${selected.includes(c.id) ? 'checked' : ''}>${escapeHTML(c.name)}</label>`).join(''); }
function renderPreview() { const text = $('#card-description').value; $('#editor-preview').innerHTML = text.trim() ? renderMarkdown(text) : '<p class="preview-empty">你的描述将在这里实时呈现。</p>'; }
function openEditor(id) {
  if (!admin) return;
  if (!categories.length) { openCategories(); toast('先添加一个分类，再创建卡片。'); return; }
  const card = cards.find(c => c.id === id);
  $('#card-form').reset(); $('#card-id').value = card?.id || ''; $('#editor-title').textContent = card ? '编辑卡片' : '添加卡片';
  $('#card-name').value = card?.name || ''; $('#card-url').value = card?.url || ''; $('#card-description').value = card?.description || '';
  categoryOptions(card?.categories || (activeCategory === 'all' ? [] : [activeCategory]));
  $('#category-error').hidden = true; $('#form-error').hidden = true; renderPreview(); openDialog($('#editor-dialog')); $('#card-name').focus();
}
$('#card-form').addEventListener('submit', event => {
  event.preventDefault(); if (!admin) return;
  const selected = $$('input:checked',$('#category-options')).map(el => el.value);
  $('#category-error').hidden = selected.length > 0;
  if (!selected.length) { $('input',$('#category-options'))?.focus(); return; }
  const name = $('#card-name').value.trim(), url = safeURL($('#card-url').value.trim());
  if (!name || !url) { $('#form-error').textContent = !name ? '请填写工具名称。' : '请填写完整的 http:// 或 https:// 链接。'; $('#form-error').hidden = false; return; }
  const id = $('#card-id').value, existing = cards.find(c => c.id === id);
  const data = {name,url,categories:selected,description:$('#card-description').value.trim()};
  if (existing) Object.assign(existing,data); else cards.unshift({...data,id:crypto.randomUUID(),createdAt:Date.now(),logo:name.charAt(0),background:'#f0ede8',color:'#806d57'});
  // A card moved outside the active filter should disappear from that filter.
  const saved = persist(); closeDialog($('#editor-dialog')); render(); if (saved) toast(existing ? '卡片已更新' : '卡片已添加，仅保存在此浏览器');
});
$('#card-description').addEventListener('input',renderPreview);
$('#category-options').addEventListener('change', () => $('#category-error').hidden = true);
$$('[data-format]').forEach(button => button.addEventListener('click', () => {
  const area = $('#card-description'), start = area.selectionStart, end = area.selectionEnd, selected = area.value.slice(start,end);
  const templates = {bold:`**${selected || '加粗文字'}**`,italic:`*${selected || '斜体文字'}*`,list:`${start && area.value[start-1] !== '\n' ? '\n' : ''}- ${selected || '列表内容'}`,link:`[${selected || '链接文字'}](https://example.com)`,code:`\n\n\`\`\`\n${selected || '在这里输入代码'}\n\`\`\`\n`};
  area.setRangeText(templates[button.dataset.format],start,end,'select'); area.focus(); renderPreview();
}));
let pendingDeletion = null;
function confirmDeleteCard(id) { if (!admin) return; const card = cards.find(c => c.id === id); if (!card) return; pendingDeletion = () => { cards = cards.filter(c => c.id !== id); const saved = persist(); render(); if (saved) toast('卡片已删除'); }; $('#confirm-title').textContent = '删除这张卡片？'; $('#confirm-description').textContent = `“${card.name}”将从导航中移除，关联的分类会保留。此操作无法撤销。`; openDialog($('#confirm-dialog')); }
$('#confirm-delete').addEventListener('click', () => { if (!admin) return; closeDialog($('#confirm-dialog')); pendingDeletion?.(); pendingDeletion = null; });

function renderCategoryManager() { $('#category-manager-list').innerHTML = sortedCategories().map(c => `<div class="category-manager-row"><input value="${escapeHTML(c.name)}" data-category-name="${escapeHTML(c.id)}" aria-label="分类名称 ${escapeHTML(c.name)}" maxlength="24"><span class="category-usage">${usage(c.id)} 个工具</span><button type="button" class="icon-button" data-category-save="${escapeHTML(c.id)}" aria-label="保存分类 ${escapeHTML(c.name)}" title="保存名称">${icon('check')}</button><button type="button" class="icon-button" data-category-remove="${escapeHTML(c.id)}" aria-label="删除分类 ${escapeHTML(c.name)}" title="${usage(c.id) ? '有关联卡片，暂不能删除' : '删除分类'}">${icon('trash')}</button></div>`).join(''); }
function openCategories() { if (!admin) return; renderCategoryManager(); $('#new-category-name').value = ''; openDialog($('#categories-dialog')); }
$('#category-add-form').addEventListener('submit',event => { event.preventDefault(); if (!admin) return; const name = $('#new-category-name').value.trim(); if (!name) { toast('请填写分类名称',true); return; } if (categories.some(c => collator.compare(c.name,name) === 0)) { toast('该分类名称已存在',true); return; } categories.push({id:crypto.randomUUID(),name,icon:'folder'}); const saved = persist(); $('#new-category-name').value = ''; render(); renderCategoryManager(); if (saved) toast('分类已添加'); });
$('#category-manager-list').addEventListener('click',event => {
  if (!admin) return;
  const save = event.target.closest('[data-category-save]'), remove = event.target.closest('[data-category-remove]');
  if (save) { const id = save.dataset.categorySave, name = $('input',save.closest('.category-manager-row')).value.trim(); if (!name) { toast('分类名称不能为空',true); return; } if (categories.some(c => c.id !== id && collator.compare(c.name,name) === 0)) { toast('该分类名称已存在',true); return; } categories.find(c => c.id === id).name = name; const saved = persist(); render(); renderCategoryManager(); if (saved) toast('分类名称已更新'); }
  if (remove) { const id = remove.dataset.categoryRemove; if (usage(id)) { toast('该分类仍有关联卡片，请先调整卡片分类。',true); const row = remove.closest('.category-manager-row'); let feedback = $('.field-error',row); if (!feedback) { feedback = document.createElement('span'); feedback.className = 'field-error category-inline-error'; feedback.setAttribute('role','alert'); row.append(feedback); } feedback.textContent = '先移除卡片关联'; return; } categories = categories.filter(c => c.id !== id); const saved = persist(); render(); renderCategoryManager(); if (saved) toast('空分类已删除'); }
});

$('#card-grid').addEventListener('click',event => { const details = event.target.closest('[data-details]'), edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-delete]'); if (details) showDescription(details.dataset.details); if (edit) openEditor(edit.dataset.edit); if (remove) confirmDeleteCard(remove.dataset.delete); });
function toggleMobile(open) { const mobile = matchMedia('(max-width:760px)').matches; $('#sidebar').classList.toggle('open',open); $('#sidebar').inert = mobile && !open; $('#mobile-scrim').hidden = !open; $('#menu-toggle').setAttribute('aria-expanded',String(open)); $('#menu-toggle').setAttribute('aria-label',open ? '关闭分类栏' : '打开分类栏'); document.body.style.overflow = open || $('dialog[open]') ? 'hidden' : ''; if (open) $('.nav-item.active')?.focus(); }
$('#category-nav').addEventListener('click',event => { const button = event.target.closest('[data-category]'); if (!button) return; activeCategory = button.dataset.category; render(); toggleMobile(false); if (matchMedia('(max-width:760px)').matches) $('#menu-toggle').focus(); });
$('#menu-toggle').addEventListener('click', () => toggleMobile(!$('#sidebar').classList.contains('open')));
$('#mobile-scrim').addEventListener('click', () => { toggleMobile(false); $('#menu-toggle').focus(); });
document.addEventListener('keydown',event => { if (event.key === 'Escape' && $('#sidebar').classList.contains('open')) { toggleMobile(false); $('#menu-toggle').focus(); } });
$('.brand').addEventListener('click',event => { event.preventDefault(); activeCategory = 'all'; render(); toggleMobile(false); });
$('#empty-action').addEventListener('click', () => { if (admin) openEditor(); else { activeCategory = 'all'; render(); } });
$('#add-card').addEventListener('click', () => openEditor());
$('#manage-categories').addEventListener('click', () => { toggleMobile(false); openCategories(); });
$('#login-button').addEventListener('click', () => { if (admin) { admin = false; render(); toast('已退出管理演示，继续浏览工具'); } else openDialog($('#login-dialog')); });
$('#demo-login').addEventListener('click', () => { admin = true; closeDialog($('#login-dialog')); render(); toast('已进入管理演示，修改仅保存在此浏览器'); });
function updateThemeButtons() { const dark = document.documentElement.dataset.theme === 'dark'; $('#light-theme').setAttribute('aria-pressed',String(!dark)); $('#dark-theme').setAttribute('aria-pressed',String(dark)); }
function setTheme(theme) { document.documentElement.dataset.theme = theme; try { localStorage.setItem('link-hub-theme',theme); } catch {} updateThemeButtons(); }
$('#light-theme').addEventListener('click', () => setTheme('light')); $('#dark-theme').addEventListener('click', () => setTheme('dark'));
matchMedia('(max-width:760px)').addEventListener('change', () => toggleMobile(false));
hydrateIcons(); updateThemeButtons(); render(); toggleMobile(false);
