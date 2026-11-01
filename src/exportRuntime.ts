// Plain JavaScript embedded in exported HTML; no React or server is required.
export const prototypeRuntime = String.raw`
(() => {
  const nodeMap = new Map(prototypeNodes.map(node => [node.id, node]));
  const screens = new Map(Array.from(document.querySelectorAll('[data-screen]')).map(screen => [screen.dataset.screen, screen]));
  const screenInfo = new Map(prototypeScreens.map(screen => [screen.id, screen]));
  const history = [], selector = document.getElementById('prototype-screen-select');
  const status = document.querySelector('.prototype-status'), backButton = document.querySelector('[data-prototype-nav="back"]');
  let current = prototypeStart, fit = true, messageTimer;
  function message(text) { clearTimeout(messageTimer); status.textContent = text; messageTimer = setTimeout(() => status.textContent = '', 4000); }
  function fitScreen() {
    const element = screens.get(current), info = screenInfo.get(current);
    if (!element || !info) return;
    const width = Math.max(120, document.documentElement.clientWidth - 32), scale = fit ? Math.min(1, width / info.width) : 1;
    element.style.zoom = String(scale);
    const toolbarHeight = document.querySelector('.prototype-toolbar').getBoundingClientRect().height;
    element.style.maxHeight = Math.max(160, (window.innerHeight - toolbarHeight - 48) / scale) + 'px';
  }
  function go(id, transition = 'none') {
    const element = screens.get(id);
    if (!element) { message('移動先の画面は今回の書き出しに含まれていません。'); return false; }
    screens.forEach((screen, key) => screen.hidden = key !== id);
    current = id; selector.value = id; backButton.disabled = history.length === 0; element.scrollTop = 0;
    element.classList.remove('screen-transition-fade', 'screen-transition-slide');
    if (transition === 'fade' || transition === 'slide') { void element.offsetWidth; element.classList.add('screen-transition-' + transition); }
    fitScreen(); element.focus({ preventScroll: true }); element.dispatchEvent(new Event('scroll')); return true;
  }
  function navigate(action) {
    if (action.type === 'navigate') {
      if (!screens.has(action.targetScreenId)) { message('移動先の画面は今回の書き出しに含まれていません。'); return; }
      history.push(current); go(action.targetScreenId, action.transition);
    } else if (action.type === 'back') {
      const target = history.pop(); if (target) go(target, action.transition); else message('これが最初の画面です。');
    } else if (action.type === 'url') {
      try { if (!['https:', 'http:', 'mailto:'].includes(new URL(action.url).protocol)) throw new Error(); window.open(action.url, '_blank', 'noopener,noreferrer'); }
      catch { message('リンク先のURLを確認してください。'); }
    }
  }
  function setIndex(root, index) {
    const buttons=Array.from(root.querySelectorAll('[data-index]'));
    const value=Math.max(0,Math.min(Math.max(0,buttons.length-1),index));
    root.dataset.value=String(value);
    buttons.forEach(button=>{const active=Number(button.dataset.index)===value;button.classList.toggle('active',active);if(button.getAttribute('role')==='tab')button.setAttribute('aria-selected',String(active));else if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});
    root.querySelectorAll('[data-page-step]').forEach(button=>button.disabled=(Number(button.dataset.pageStep)<0?value===0:value===buttons.length-1));
  }
  function handleComponent(target) {
    const root=target.closest('[data-node-id]'),node=root&&nodeMap.get(root.dataset.nodeId);
    if(!root||!node||node.properties.disabled)return false;
    if(target.closest('input,textarea,select'))return true;
    if(target.closest('[data-dismiss]')){root.style.display='none';return true}
    const step=target.closest('[data-step]');
    if(step){const output=root.querySelector('output'),value=Math.max(0,Math.min(100,Number(output.textContent||0)+Number(step.dataset.step)));output.textContent=String(value);root.dataset.value=String(value);root.querySelectorAll('[data-step]').forEach(button=>button.disabled=Number(button.dataset.step)<0?value===0:value===100);return true}
    const rating=target.closest('[data-rating]');
    if(rating){const value=Number(rating.dataset.rating);root.dataset.value=String(value);root.querySelectorAll('[data-rating]').forEach(button=>{const active=Number(button.dataset.rating)<=value;button.setAttribute('aria-pressed',String(active));button.querySelector('svg')?.setAttribute('fill',active?'currentColor':'none')});return true}
    const chip=target.closest('[data-control="chip"]');
    if(chip){const checked=chip.getAttribute('aria-pressed')!=='true';chip.setAttribute('aria-pressed',String(checked));chip.classList.toggle('selected',checked);root.dataset.checked=String(checked);chip.querySelector('svg,[data-chip-check]')?.remove();if(checked){const mark=document.createElement('span');mark.textContent='✓';mark.dataset.chipCheck='true';chip.prepend(mark)}return true}
    const index=target.closest('[data-index]');
    if(index){setIndex(root,Number(index.dataset.index));return node.type!=='tabbar'}
    const pageStep=target.closest('[data-page-step]');
    if(pageStep){setIndex(root,Number(root.dataset.value||0)+Number(pageStep.dataset.pageStep));return true}
    if(target.closest('.node-accordion summary'))return true;
    return false;
  }
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null; if (!target) return;
    const nav = target.closest('[data-prototype-nav]');
    if (nav) {
      if (nav.dataset.prototypeNav === 'back') navigate({ type: 'back', transition: 'fade' });
      if (nav.dataset.prototypeNav === 'reset') { history.length = 0; go(prototypeStart, 'fade'); }
      if (nav.dataset.prototypeNav === 'fit') { fit = true; fitScreen(); }
      if (nav.dataset.prototypeNav === 'actual') { fit = false; fitScreen(); }
      return;
    }
    if (handleComponent(target)) return;
    let element = target.closest('[data-node-id]');
    while (element) {
      const node = nodeMap.get(element.dataset.nodeId), action = node && !node.properties.disabled && node.actions.find(action => action.type !== 'none');
      if (action) { navigate(action); return; }
      element = element.parentElement && element.parentElement.closest('[data-node-id]');
    }
  });
  document.addEventListener('input', event=>{const input=event.target;if(input instanceof HTMLInputElement && input.type==="range"){const root=input.closest("[data-node-id]");if(root){root.dataset.value=input.value;const output=root.querySelector("output");if(output)output.textContent=input.value;}}});
  document.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const root = input.closest('[data-node-id]'); if (!root) return;
    if (input.type === 'checkbox' || input.type === 'radio') {
      root.setAttribute('aria-checked', String(input.checked));
      root.querySelectorAll('.check-box').forEach(el => el.classList.toggle('checked', input.checked));
      root.querySelectorAll('.node-toggle').forEach(el => el.classList.toggle('on', input.checked));
    }
  });
  document.addEventListener('keydown', event => {
    const target = event.target;
    if (!(target instanceof Element) || !target.matches('[data-node-id].has-action') || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); target.click();
  });
  screens.forEach(element => {
    element.querySelectorAll('[data-node-id]').forEach(root => {
      const node = nodeMap.get(root.dataset.nodeId); if (!node) return;
      if (node.actions.some(action => action.type !== 'none') && !node.properties.disabled) {
        root.classList.add('has-action');
        if (!root.querySelector('input,textarea,select,button')) { root.tabIndex = 0; root.setAttribute('role', 'button'); root.setAttribute('aria-label', node.name); }
      }
    });
    element.addEventListener('scroll', () => {
      element.querySelectorAll('[data-fixed]').forEach(root => {
        const node = nodeMap.get(root.dataset.nodeId);
        if (node && !node.parentId && node.properties.fixed !== 'none') { root.style.top = (node.y + element.scrollTop) + 'px'; root.style.zIndex = '9999'; }
      });
    }, { passive: true });
  });
  selector.addEventListener('change', () => { if (selector.value !== current) { history.push(current); go(selector.value, 'fade'); } });
  window.addEventListener('resize', fitScreen); go(current);
})();`;
