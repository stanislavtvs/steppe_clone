  const scope = document.querySelector('main') || document.body;
  scope.setAttribute('data-a11y-scope','');
  if (!scope.querySelector(':scope > .a11y-zoom-wrap')) {
    const wrap = document.createElement('div'); wrap.className='a11y-zoom-wrap';
    const target = document.createElement('div'); target.className='a11y-zoom-target';
    while (scope.firstChild) target.appendChild(scope.firstChild);
    wrap.appendChild(target); scope.appendChild(wrap);
  }
  const readRoot = scope.querySelector('.a11y-zoom-target');

  const panelHost = document.querySelector('.controls-ponel') || scope;
  const bar = document.createElement('div');
  bar.className='a11y-bar';
  bar.innerHTML = `
    <div class="a11y-row">
      <div class="a11y-group">
        <span class="a11y-title">Размер шрифта</span>
        <button class="a11y-btn" id="fs-dec" title="A− (Shift x5)">A−</button>
        <div class="a11y-chip" id="fs-meter" style="min-width:64px;text-align:center">100%</div>
        <button class="a11y-btn" id="fs-inc" title="A+ (Shift x5)">A+</button>
        <button class="a11y-btn light" id="fs-reset" title="Сброс">↺</button>
      </div>

      <div class="a11y-group">
        <span class="a11y-title">Цвета сайта</span>
        <button class="a11y-swatch swatch-default"  data-theme="default"  title="Обычная"></button>
        <button class="a11y-swatch swatch-dark"     data-theme="dark"     title="Тёмная"></button>
        <button class="a11y-swatch swatch-blue"     data-theme="blue"     title="Сине-тёмная"></button>
        <button class="a11y-swatch swatch-sepia"    data-theme="sepia"    title="Сепия"></button>
        <button class="a11y-swatch swatch-contrast" data-theme="contrast" title="Контраст"></button>
      </div>

      <div class="a11y-group">
        <span class="a11y-title">Изображения</span>
        <button class="a11y-btn" id="img-on"  aria-pressed="false">●</button>
        <button class="a11y-btn" id="img-off" aria-pressed="false">○</button>
      </div>

      <div class="a11y-group">
        <span class="a11y-title">Озвучка</span>
        <button class="a11y-btn" id="tts-play">▶ Озвучить</button>
        <button class="a11y-btn" id="tts-pause">⏸ Пауза</button>
        <button class="a11y-btn" id="tts-stop">⏹ Стоп</button>
      </div>

      <div class="a11y-group">
        <button class="a11y-btn light" id="toggle-sub">⚙ Дополнительно</button>
      </div>
    </div>

    <div class="a11y-sub" id="a11y-sub">
      <div class="a11y-row" style="margin-top:6px">
        <div class="a11y-group">
          <span class="a11y-title">Междустрочный</span>
          <button class="a11y-chip" id="lh-std">Стандартный</button>
          <button class="a11y-chip" id="lh-md">Средний</button>
          <button class="a11y-chip" id="lh-lg">Большой</button>
        </div>
        <div class="a11y-group">
          <span class="a11y-title">Межбуквенный</span>
          <button class="a11y-chip" id="tr-0">Обычный</button>
          <button class="a11y-chip" id="tr-1">Увеличенный</button>
          <button class="a11y-chip" id="tr-15">Полуторный</button>
          <button class="a11y-chip" id="tr-2">Двойной</button>
        </div>
        <div class="a11y-group">
          <span class="a11y-title">Шрифт</span>
          <button class="a11y-chip" id="f-sans">Без засечек</button>
          <button class="a11y-chip" id="f-serif">С засечками</button>
          <button class="a11y-chip" id="f-mono">Моноширинный</button>
        </div>
      </div>
    </div>`;
  panelHost.prepend(bar);

  const KEY='a11y.combo.v1';
  const state = Object.assign({
    fontScale:1, theme:'default', images:'on',
    lineHeight:'std', tracking:'0', font:'sans', subOpen:false
  }, JSON.parse(localStorage.getItem(KEY)||'{}'));
  const save=()=>localStorage.setItem(KEY, JSON.stringify(state));

  const getPx = el => parseFloat(getComputedStyle(el).fontSize)||16;
  const isFirefox = /firefox/i.test(navigator.userAgent);
  const probe = readRoot.querySelector('h1, .lead, .content p, article p, p') || document.body;
  const baseline = { body:getPx(document.body), probe:getPx(probe), scope:getPx(readRoot) };

  function setContentScale(scale=1){
    scope.style.setProperty('--a11y-zoom', String(scale));
    scope.classList.toggle('a11y-zoom-fx',   isFirefox && scale!==1);
    scope.classList.toggle('a11y-zoom-mode', !isFirefox && scale!==1);
    if (scale===1){
      scope.classList.remove('a11y-zoom-fx','a11y-zoom-mode');
      scope.style.removeProperty('--a11y-zoom');
    }
  }

  function apply(){
    document.documentElement.style.fontSize = (100*state.fontScale)+'%';
    document.body.style.fontSize = (100*state.fontScale)+'%';

    document.documentElement.setAttribute('data-a11y-theme', state.theme);
    document.body.classList.add('a11y-colors');
    document.body.classList.toggle('a11y-images-off', state.images==='off');

    ['a11y-lh-std','a11y-lh-md','a11y-lh-lg','a11y-track-1','a11y-track-15','a11y-track-2','a11y-font-sans','a11y-font-serif','a11y-font-mono']
      .forEach(c=>document.body.classList.remove(c));
    document.body.classList.add('a11y-lh-'+state.lineHeight);
    if (state.tracking==='1')   document.body.classList.add('a11y-track-1');
    if (state.tracking==='1.5') document.body.classList.add('a11y-track-15');
    if (state.tracking==='2')   document.body.classList.add('a11y-track-2');
    if (state.font==='sans') document.body.classList.add('a11y-font-sans');
    if (state.font==='serif')document.body.classList.add('a11y-font-serif');
    if (state.font==='mono') document.body.classList.add('a11y-font-mono');

    bar.querySelector('#a11y-sub').classList.toggle('open', !!state.subOpen);

    const now = { body:getPx(document.body), probe:getPx(probe), scope:getPx(readRoot) };
    const exp = { body:baseline.body*state.fontScale, probe:baseline.probe*state.fontScale, scope:baseline.scope*state.fontScale };
    const tol=0.75;
    const ok = (Math.abs(now.body-exp.body)<=tol) && (Math.abs(now.probe-exp.probe)<=tol || Math.abs(now.scope-exp.scope)<=tol);
    setContentScale(ok ? 1 : state.fontScale);

    bar.querySelector('#fs-meter').textContent = Math.round(state.fontScale*100)+'%';
    save();
  }

  const changeFont=d=>{ state.fontScale=+(state.fontScale+d).toFixed(3); apply(); };
  bar.querySelector('#fs-dec').onclick  = e=>changeFont(e.shiftKey?-0.5:-0.05);
  bar.querySelector('#fs-inc').onclick  = e=>changeFont(e.shiftKey? 0.5: 0.05);
  bar.querySelector('#fs-reset').onclick= ()=>{ state.fontScale=1; apply(); };
  bar.addEventListener('wheel', e=>{ if(!e.ctrlKey&&!e.altKey) return; e.preventDefault(); changeFont((e.deltaY<0?1:-1)*(e.shiftKey?0.5:0.05)); }, {passive:false});
  window.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&('=+-'.includes(e.key))){ e.preventDefault(); changeFont(e.key==='-'?-0.05:0.05);} if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault(); state.fontScale=1; apply();}}, false);

  bar.querySelectorAll('[data-theme]').forEach(b=> b.addEventListener('click', ()=>{ state.theme=b.dataset.theme; apply(); }));
  bar.querySelector('#img-on').onclick  = ()=>{ state.images='on';  apply(); };
  bar.querySelector('#img-off').onclick = ()=>{ state.images='off'; apply(); };
  bar.querySelector('#toggle-sub').onclick = ()=>{ state.subOpen=!state.subOpen; apply(); };

  ['std','md','lg'].forEach(k=> bar.querySelector('#lh-'+k).onclick=()=>{ state.lineHeight=k; apply(); });
  [['0','tr-0'],['1','tr-1'],['1.5','tr-15'],['2','tr-2']].forEach(([v,id])=> bar.querySelector('#'+id).onclick=()=>{ state.tracking=v; apply(); });
  [['sans','f-sans'],['serif','f-serif'],['mono','f-mono']].forEach(([v,id])=> bar.querySelector('#'+id).onclick=()=>{ state.font=v; apply(); });

  (function initReadAloud(){
    if (!('speechSynthesis' in window)) {
      ['#tts-play','#tts-pause','#tts-stop'].forEach(sel=>{ const b=bar.querySelector(sel); if(b){ b.disabled=true; b.title='Озвучка не поддерживается'; }});
      return;
    }
    const synth = window.speechSynthesis;

    const AHEAD = 1;
    const BRIDGE_STEP_MS = 35;

    const snapshotTextRaw = readRoot.innerText;
    const snapshotText = snapshotTextRaw
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .trim();

    const wordStarts=[];
    snapshotText.replace(/\S+/g, (_m,off)=>{ wordStarts.push(off); return _m; });

    const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','VIDEO','AUDIO']);
    const SKIP_MATCH = (el) => el.closest &&
      (el.closest('.a11y-bar') || el.closest('.controls-ponel'));

    let globalWordIndex=0;
    const spanByWordIndex=[];

    function wrapTextNodes(node){
      if (node.nodeType===Node.TEXT_NODE){
        const txt = node.nodeValue.replace(/\u00A0/g,' ');
        if (!txt.trim()) return;
        const frag=document.createDocumentFragment();
        const parts=txt.split(/(\s+)/);
        for (const part of parts){
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else{
            const sp=document.createElement('span');
            sp.className='ra-word';
            sp.textContent=part;
            spanByWordIndex[globalWordIndex]=sp;
            frag.appendChild(sp);
            globalWordIndex++;
          }
        }
        node.replaceWith(frag);
        return;
      }
      if (node.nodeType===Node.ELEMENT_NODE){
        if (SKIP_TAGS.has(node.tagName)) return;
        if (SKIP_MATCH(node)) return;
        const children=[...node.childNodes];
        for (const ch of children) wrapTextNodes(ch);
      }
    }
    wrapTextNodes(readRoot);

    let currentIdx=-1, currentSpan=null, bridgeTimer=null;
    function applyHighlight(i){
      if (i<0 || i>=spanByWordIndex.length) return;
      if (currentSpan) currentSpan.classList.remove('current');
      const sp=spanByWordIndex[i]; if(!sp) return;
      sp.classList.add('current'); currentSpan=sp; currentIdx=i;
      sp.scrollIntoView({block:'center', behavior:'smooth'});
    }
    function highlightByCharIndex(charIndex){
      let lo=0, hi=wordStarts.length-1, ans=0;
      while (lo<=hi){ const mid=(lo+hi)>>1; if (wordStarts[mid]<=charIndex){ ans=mid; lo=mid+1; } else hi=mid-1; }
      let target=Math.min(ans + AHEAD, wordStarts.length-1);
      const gap = target - currentIdx;
      if (gap>2){
        if (bridgeTimer) clearInterval(bridgeTimer);
        let i=currentIdx+1;
        bridgeTimer=setInterval(()=>{
          applyHighlight(i); i++;
          if (i>target){ clearInterval(bridgeTimer); bridgeTimer=null; }
        }, BRIDGE_STEP_MS);
      } else {
        applyHighlight(target);
      }
    }

    let state='idle'; let utterance=null;
    function play(){
      stop();
      utterance=new SpeechSynthesisUtterance(snapshotText);
      utterance.lang='ru-RU'; utterance.rate=1.0;
      utterance.onboundary = (ev)=>{ if (typeof ev.charIndex==='number') highlightByCharIndex(ev.charIndex); };
      utterance.onend = ()=>{ state='idle'; };
      synth.speak(utterance); state='playing';
    }
    function pause(){ if(state!=='playing') return; synth.pause(); state='paused'; }
    function resume(){ if(state!=='paused') return; synth.resume(); state='playing'; }
    function stop(){
      synth.cancel(); state='stopped';
      if (currentSpan){ currentSpan.classList.remove('current'); currentSpan=null; }
      currentIdx=-1; if (bridgeTimer){ clearInterval(bridgeTimer); bridgeTimer=null; }
    }

    bar.querySelector('#tts-play').addEventListener('click', ()=>{ (state==='paused') ? resume() : play(); });
    bar.querySelector('#tts-pause').addEventListener('click', ()=>{ (state==='playing') ? pause() : resume(); });
    bar.querySelector('#tts-stop').addEventListener('click', stop);
  })();

  apply();