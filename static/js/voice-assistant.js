(function(){
  if (window.__VA_INIT__) return;
  window.__VA_INIT__ = true;

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SpeechRec;

  const DEBUG = true;
  const log = (...a)=>{ if(DEBUG) console.log('[VA]', ...a); };
  const group = (t)=>{ if(DEBUG) console.groupCollapsed('[VA]', t); };
  const end = ()=>{ if(DEBUG) console.groupEnd(); };

  const NUMBER_WORDS = {
    "ноль":0,"пятьдесят":50,"шестьдесят":60,"семьдесят":70,"восемьдесят":80,"девяносто":90,
    "сто":100,"сто десять":110,"сто двадцать":120,"сто тридцать":130,"сто сорок":140,
    "сто пятьдесят":150,"сто шестьдесят":160,"сто семьдесят":170,"сто восемьдесят":180,"сто девяносто":190,"двести":200
  };

  const hostBar = (typeof bar !== 'undefined' && bar) ? bar : document.querySelector('.a11y-bar');
  if (!hostBar) { log('Панель .a11y-bar не найдена'); return; }

  const voiceGroup = document.createElement('div');
  voiceGroup.className = 'a11y-group';
  voiceGroup.innerHTML = `
    <span class="a11y-title">Голос</span>
    <button class="a11y-btn" id="va-toggle" title="Alt+G">${supported ? '🎙 ВКЛ' : '🚫 Нет поддержки'}</button>
    <div class="a11y-chip" id="va-status" style="min-width:120px;text-align:center">${supported ? 'Отключено' : 'Недоступно'}</div>
  `;
  hostBar.querySelector('.a11y-row')?.appendChild(voiceGroup);

  const navGroup = document.createElement('div');
  navGroup.className = 'a11y-group';
  navGroup.innerHTML = `
    <span class="a11y-title">Навигация</span>
    <button class="a11y-btn" id="va-back" title="Назад">◀ Назад</button>
    <button class="a11y-btn" id="va-home" title="Домой">🏠 Домой</button>
  `;
  hostBar.querySelector('.a11y-row')?.appendChild(navGroup);

  const $ = sel => hostBar.querySelector(sel);
  const setStatus = (txt)=>{ const chip = $('#va-status'); if (chip) chip.textContent = txt; };

  $('#va-back')?.addEventListener('click', ()=>{ if (history.length > 1) history.back(); else location.assign((location.origin||'/')+'/'); });
  $('#va-home')?.addEventListener('click', ()=>{ location.assign((location.origin||'/')+'/'); });

  if (!supported) return;

  const btn = {
    fsInc: $('#fs-inc'), fsDec: $('#fs-dec'), fsReset: $('#fs-reset'),
    imgOn: $('#img-on'), imgOff: $('#img-off'),
    ttsPlay: $('#tts-play'), ttsPause: $('#tts-pause'), ttsStop: $('#tts-stop'),
    toggleSub: $('#toggle-sub'),
    lhStd: $('#lh-std'), lhMd: $('#lh-md'), lhLg: $('#lh-lg'),
    tr0: $('#tr-0'), tr1: $('#tr-1'), tr15: $('#tr-15'), tr2: $('#tr-2'),
    fSans: $('#f-sans'), fSerif: $('#f-serif'), fMono: $('#f-mono')
  };

  function setFontScale(scale){ if(typeof state!=='object')return; const s=Math.max(0.5,Math.min(3,Number(scale)||1)); state.fontScale=+s.toFixed(3); if(typeof apply==='function') apply(); }
  function nudgeFont(delta){ if(btn.fsInc&&btn.fsDec){ (delta>0?btn.fsInc:btn.fsDec).click(); } else if(typeof state==='object'&&typeof apply==='function'){ state.fontScale=+(state.fontScale+delta).toFixed(3); apply(); } }
  function setTheme(name){ if(typeof state!=='object'||typeof apply!=='function')return; const map={'default':'default','обычная':'default','светлая':'default','тёмная':'dark','темная':'dark','синяя':'blue','сине-тёмная':'blue','сепия':'sepia','контраст':'contrast','контрастная':'contrast'}; state.theme=map[name]||name||'default'; apply(); }
  function setImages(on){ if(typeof state==='object'&&typeof apply==='function'){ state.images=on?'on':'off'; apply(); } }
  function setLineHeight(kind){ const map={'стандартный':'std','обычный':'std','средний':'md','большой':'lg'}; if(typeof state==='object'&&typeof apply==='function'){ state.lineHeight=map[kind]||kind||'std'; apply(); } }
  function setTracking(kind){ const map={'обычный':'0','ноль':'0','увеличенный':'1','полуторный':'1.5','полторы':'1.5','двойной':'2','два':'2'}; if(typeof state==='object'&&typeof apply==='function'){ state.tracking=map[kind]||kind||'0'; apply(); } }
  function setFontFamily(kind){ const map={'без засечек':'sans','с засечками':'serif','моноширинный':'mono','моно':'mono'}; if(typeof state==='object'&&typeof apply==='function'){ state.font=map[kind]||kind||'sans'; apply(); } }
  function toggleSub(open){ if(typeof state!=='object'||typeof apply!=='function')return; state.subOpen=(typeof open==='boolean')?open:!state.subOpen; apply(); }

  const SCROLL_STEP = ()=> Math.round(window.innerHeight * 0.85);
  let autoScrollTimer = null;
  function doScroll(px){ window.scrollBy({ top:px, behavior:'smooth' }); }
  function scrollDownScreens(n=1){ doScroll(SCROLL_STEP()*(n||1)); }
  function scrollUpScreens(n=1){ doScroll(-SCROLL_STEP()*(n||1)); }
  function scrollToTop(){ window.scrollTo({ top:0, behavior:'smooth' }); }
  function scrollToBottom(){ window.scrollTo({ top:document.documentElement.scrollHeight, behavior:'smooth' }); }
  function startAutoScroll(dir=1,speed=1){ stopAutoScroll(); const px=16*speed*(dir>0?1:-1); autoScrollTimer=setInterval(()=>window.scrollBy(0,px),16); }
  function stopAutoScroll(){ if(autoScrollTimer){ clearInterval(autoScrollTimer); autoScrollTimer=null; } }

  let paragraphMode=false, paraUtterance=null, paraText='', paraCursor=0, paraBaseOffset=0, paraPausedManually=false;
  function robustPause(retries=4){ const f=()=>{ try{speechSynthesis.pause();}catch{} if(!speechSynthesis.paused && retries-- > 0) setTimeout(f,60); }; f(); }
  function ttsPlay(){
    if(paragraphMode && paraPausedManually){ resumeParagraphFromCursor(); return; }
    if(paragraphMode && speechSynthesis.paused){ try{ speechSynthesis.resume(); paraPausedManually=false; }catch{} return; }
    const idxSel=getHighlightedParagraphIndex(); if(idxSel>=0){ readParagraphAt(idxSel); return; }
    btn.ttsPlay?.click();
  }
  function ttsPause(){
    if(paragraphMode && speechSynthesis.speaking){ paraPausedManually=true; robustPause(); try{ speechSynthesis.cancel(); }catch{} return; }
    btn.ttsPause?.click();
  }
  function ttsStop(){ if(paragraphMode){ paraPausedManually=false; try{ speechSynthesis.cancel(); }catch{} paragraphMode=false; } btn.ttsStop?.click(); }
  function clearWordHighlight(){ document.querySelectorAll('.ra-word.current').forEach(el=>el.classList.remove('current')); }

  const readRoot = (typeof window.readRoot!=='undefined' && window.readRoot) ? window.readRoot : (document.querySelector('.a11y-zoom-target') || document.querySelector('main') || document.body);
  (function addStyle(){ const st=document.createElement('style'); st.textContent='.va-paragraph-current{outline:2px dashed var(--va-mark,#888);outline-offset:6px;border-radius:8px}'; document.head.appendChild(st); })();
  const getParagraphs = () => [...readRoot.querySelectorAll('p, .content p, article p')].filter(p=>p.innerText.trim().length>0);
  let paraIndex=0, autoStopTimer=null;
  function clearParaHighlight(){ readRoot.querySelectorAll('.va-paragraph-current').forEach(el=>el.classList.remove('va-paragraph-current')); }
  function markParagraph(p){ clearParaHighlight(); if(p){ p.classList.add('va-paragraph-current'); p.scrollIntoView({block:'center', behavior:'smooth'}); } }
  function normalizeText(s){ return s.replace(/\u00A0/g,' ').replace(/[ \t]+/g,' ').replace(/\s+\n/g,'\n').trim(); }

  function bindKaraokeHandlers(p,utter,baseOffset){
    const local = normalizeText(p.innerText||'');
    const starts=[]; local.replace(/\S+/g,(_m,off)=>{ starts.push(off); return _m; });
    const spans=[...p.querySelectorAll('.ra-word')]; let cur=null;
    function highlightByChar(idx){ let lo=0,hi=starts.length-1,ans=0; while(lo<=hi){const mid=(lo+hi)>>1; if(starts[mid]<=idx){ans=mid;lo=mid+1;} else hi=mid-1;} const i=Math.max(0,Math.min(ans,spans.length-1)); if(cur)cur.classList.remove('current'); const sp=spans[i]; if(sp){ sp.classList.add('current'); cur=sp; sp.scrollIntoView({block:'center',behavior:'smooth'});} }
    utter.onboundary = (ev)=>{ if(typeof ev.charIndex==='number'){ paraCursor = baseOffset + ev.charIndex; highlightByChar(paraCursor); } };
  }

  function speakParagraphSlice(p, baseOffset){
    const full = normalizeText(p.innerText||''); const slice = full.slice(baseOffset); if(!slice) return;
    paraText=full;
    paraUtterance = new SpeechSynthesisUtterance(slice);
    paraUtterance.lang='ru-RU'; paraUtterance.rate=1.0;
    bindKaraokeHandlers(p, paraUtterance, baseOffset);
    paraUtterance.onend = ()=>{ paragraphMode=false; paraPausedManually=false; };
    paraUtterance.onerror = ()=>{ paragraphMode=false; };
    speechSynthesis.speak(paraUtterance);
  }

  function readParagraphAt(idx){
    const paras=getParagraphs(); if(!paras.length) return;
    idx=Math.max(0,Math.min(idx,paras.length-1)); paraIndex=idx;
    const p=paras[idx]; const text=normalizeText(p.innerText||''); if(!text) return;
    try{ speechSynthesis.cancel(); }catch{} btn.ttsStop?.click(); clearWordHighlight();
    markParagraph(p);
    paragraphMode=true; paraPausedManually=false; paraBaseOffset=0; paraCursor=0;
    speakParagraphSlice(p,0);
  }

  function resumeParagraphFromCursor(){
    const paras=getParagraphs(); if(!paras.length) return;
    const p=paras[paraIndex]||readRoot.querySelector('.va-paragraph-current'); if(!p) return;
    try{ speechSynthesis.cancel(); }catch{}
    paraBaseOffset=Math.max(0,Math.min(paraCursor,(paraText||'').length));
    paraPausedManually=false; paragraphMode=true;
    speakParagraphSlice(p, paraBaseOffset);
  }

  function getHighlightedParagraphIndex(){ const paras=getParagraphs(); if(!paras.length) return -1; const cur=readRoot.querySelector('.va-paragraph-current'); if(!cur) return -1; return paras.indexOf(cur); }

  const TIME_UNITS={"секунд":1,"секунды":1,"секунда":1,"минут":60,"минуты":60,"минута":60};
  function extractNumberSec(q){ const m=q.match(/через\s+(\d{1,3})\s*(секунд(?:ы|а)?|минут(?:ы|а)?)?/i); if(!m) return null; const n=parseInt(m[1],10); const unit=(m[2]||'').toLowerCase(); return n*(TIME_UNITS[unit]||1); }

  function extractNumber(text){
    const m=text.match(/(\d{1,3})(?:\s*%| процент| процентов)?/i);
    if(m) return parseInt(m[1],10);
    for(const [k,v] of Object.entries(NUMBER_WORDS)) if(text.includes(k)) return v;
    return null;
  }
  function normalize(s){ return s.toLowerCase().replace(/[ё]/g,'е').replace(/[^\p{L}\p{N}\s%]/gu,' ').replace(/\s+/g,' ').trim(); }

  let stopPendingTimer=null, stopPendingUntil=0;
  function armStopPending(){ if(stopPendingTimer) clearTimeout(stopPendingTimer); stopPendingUntil=Date.now()+1200; stopPendingTimer=setTimeout(()=>{ stopAllSpeech(); stopPendingTimer=null; stopPendingUntil=0; setStatus('Остановлено'); },1200); }
  function hasPendingStop(){ return Date.now()<stopPendingUntil; }
  function cancelPendingStop(){ if(stopPendingTimer) clearTimeout(stopPendingTimer); stopPendingTimer=null; stopPendingUntil=0; }

  function stopAllSpeech(){ try{ speechSynthesis.cancel(); }catch{} btn.ttsStop?.click(); paraUtterance=null; paraPausedManually=false; paragraphMode=false; clearWordHighlight(); }

  function isCommandPhrase(q){
    return /(стоп|остановись|пауза|продолжи|читай|прочитай|озвучь|сначала|с начала|с текущего места|начало|пропусти абзац|следующий абзац|прошлый абзац|предыдущий абзац|вверх|вниз|прокрут|масштаб|шрифт|тема|картин|изображен|контраст|сепия|темн|светл|на главную|назад|домой)/.test(q);
  }

  function handleCommand(raw){
    const q = normalize(raw);
    const finish = (msg)=>{ setStatus(msg); return msg; };

    if (/^(читай|читать) с начала$|^сначала читай$|^озвучь начал[оа]$/.test(q)){
      cancelPendingStop(); clearParaHighlight(); clearWordHighlight();
      paragraphMode=false; paraPausedManually=false; ttsStop(); ttsPlay();
      return finish('Чтение с начала');
    }

    if (/^(читай|читать) с текущего места$|^продолжи чтение$/.test(q)){
      cancelPendingStop();
      if (paragraphMode && (paraPausedManually || speechSynthesis.paused)){ ttsPlay(); return finish('Абзац: продолжить'); }
      const idx=getHighlightedParagraphIndex(); if(idx>=0){ readParagraphAt(idx); return finish('Чтение выделенного абзаца'); }
      clearParaHighlight(); ttsPlay(); return finish('Чтение с текущего места');
    }

    if (/^(пропусти абзац|следующий абзац)$/.test(q)){
      cancelPendingStop(); const paras=getParagraphs(); if(!paras.length) return finish('Нет абзацев');
      const hasCur=!!readRoot.querySelector('.va-paragraph-current'); paraIndex=hasCur?Math.min(paraIndex+1,paras.length-1):0;
      paraPausedManually=false; readParagraphAt(paraIndex);
      return finish(`Абзац ${paraIndex+1}/${paras.length}`);
    }

    if (/^(прошлый абзац|предыдущий абзац)$/.test(q)){
      cancelPendingStop(); const paras=getParagraphs(); if(!paras.length) return finish('Нет абзацев');
      const hasCur=!!readRoot.querySelector('.va-paragraph-current'); paraIndex=hasCur?Math.max(paraIndex-1,0):0;
      paraPausedManually=false; readParagraphAt(paraIndex);
      return finish(`Абзац ${paraIndex+1}/${paras.length}`);
    }

    if (/^остановись через\b/.test(q)){
      const sec=extractNumberSec(q); if(!sec) return finish('Не понял интервал');
      cancelPendingStop(); if(autoStopTimer){ clearTimeout(autoStopTimer); autoStopTimer=null; }
      autoStopTimer=setTimeout(()=>{ stopAllSpeech(); clearParaHighlight(); setStatus('Остановлено по таймеру'); }, sec*1000);
      return finish(`Остановлюсь через ${sec} сек`);
    }
    if (/^через\s+\d/.test(q) && hasPendingStop()){
      const sec=extractNumberSec('остановись '+q); cancelPendingStop(); if(!sec) return finish('Не понял интервал');
      if(autoStopTimer){ clearTimeout(autoStopTimer); autoStopTimer=null; }
      autoStopTimer=setTimeout(()=>{ stopAllSpeech(); clearParaHighlight(); setStatus('Остановлено по таймеру'); }, sec*1000);
      return finish(`Остановлюсь через ${sec} сек`);
    }

    if (/^(озвуч(ь|ить)|прочитай|прочесть)$/.test(q)){
      cancelPendingStop();
      if (paragraphMode && (paraPausedManually || speechSynthesis.paused)){ ttsPlay(); return finish('Абзац: продолжить'); }
      const idx=getHighlightedParagraphIndex(); if(idx>=0){ readParagraphAt(idx); return finish('Чтение выделенного абзаца'); }
      clearParaHighlight(); clearWordHighlight(); paragraphMode=false; paraPausedManually=false; ttsPlay(); return finish('Озвучка: старт');
    }
    if (/пауза|приостанови/.test(q)){ cancelPendingStop(); ttsPause(); return finish('Пауза'); }
    if (/^(стоп|остановись)$/.test(q)){ armStopPending(); return finish('Жду уточнения…'); }
    if (/(^стоп\b|^останови(?!сь через)|^остановись(?! через))/.test(q)){ cancelPendingStop(); stopAllSpeech(); clearParaHighlight(); return finish('Озвучка: стоп'); }

    if (/(увелич(ь|и)|больше).*(шрифт|текст)|шрифт (больше|прибавь|плюс)/.test(q)) return finish(nudgeFont(+0.05),'Шрифт +');
    if (/(уменьш(и|ь)|меньше).*(шрифт|текст)|шрифт (меньше|убавь|минус)/.test(q)) return finish(nudgeFont(-0.05),'Шрифт −');
    if (/сброс(ить)? (масштаб|шрифт)|верни (масштаб|шрифт) (1|один)/.test(q)||/шрифт 100/.test(q)) { setFontScale(1); return finish('Сброс шрифта'); }
    if (/(шрифт|масштаб|зум)/.test(q)){ const n=extractNumber(q); if(n&&n>=50&&n<=300){ setFontScale(n/100); return finish(`Шрифт ${n}%`);} }

    if (/(темная|тёмная) тема|ночн(ая|ой)/.test(q)) { setTheme('dark'); return finish('Тема: тёмная'); }
    if (/син(яя|е-темная|е темная) тема|сине.*темн/.test(q)) { setTheme('blue'); return finish('Тема: синяя/тёмная'); }
    if (/сепия/.test(q)) { setTheme('sepia'); return finish('Тема: сепия'); }
    if (/контраст(ная)?/.test(q)) { setTheme('contrast'); return finish('Тема: контраст'); }
    if (/(обычн|светл(ая|ая тема)|дефолт|стандартная тема)/.test(q)) { setTheme('default'); return finish('Тема: обычная'); }

    if (/(включи|покажи).*(картинк|изображен)/.test(q)) { setImages(true); return finish('Изображения: ВКЛ'); }
    if (/(выключи|скрой).*(картинк|изображен)/.test(q)) { setImages(false); return finish('Изображения: ВЫКЛ'); }

    if (/меж(ду)?строчн(ый|ый интервал)?.*(большой)/.test(q)) { setLineHeight('lg'); return finish('Междустрочный: большой'); }
    if (/меж(ду)?строчн(ый)?.*(средн)/.test(q)) { setLineHeight('md'); return finish('Междустрочный: средний'); }
    if (/меж(ду)?строчн(ый)?.*(стандарт|обычн)/.test(q)) { setLineHeight('std'); return finish('Междустрочный: стандартный'); }
    if (/межбуквенн(ый)?.*(двойн|два)/.test(q)) { setTracking('2'); return finish('Межбуквенный: двойной'); }
    if (/межбуквенн(ый)?.*(полутор|полторы)/.test(q)) { setTracking('1.5'); return finish('Межбуквенный: полуторный'); }
    if (/межбуквенн(ый)?.*(увеличен|больше)/.test(q)) { setTracking('1'); return finish('Межбуквенный: увеличенный'); }
    if (/межбуквенн(ый)?.*(обычн|стандарт)/.test(q)) { setTracking('0'); return finish('Межбуквенный: обычный'); }
    if (/шрифт.*без засеч/.test(q)||/санс|sans/.test(q)) { setFontFamily('без засечек'); return finish('Шрифт: без засечек'); }
    if (/шрифт.*с засеч/.test(q)||/сериф|serif/.test(q)) { setFontFamily('с засечками'); return finish('Шрифт: с засечками'); }
    if (/моно(ширинн)?|mono/.test(q)) { setFontFamily('моноширинный'); return finish('Шрифт: моноширинный'); }

    if (/(показать|открыть).*доп(олнительно)?/.test(q)) { toggleSub(true); return finish('Дополнительно: открыто'); }
    if (/(скрыть|закрыть).*доп(олнительно)?/.test(q)) { toggleSub(false); return finish('Дополнительно: закрыто'); }
    if (/(переключить|дополнительно)/.test(q)) { toggleSub(); return finish('Дополнительно: переключено'); }

    if (/(в самый низ|в конец|вниз до конца)/.test(q)) { scrollToBottom(); return finish('Скролл: в самый низ'); }
    if (/(в самый верх|наверх|в начало)/.test(q)) { scrollToTop(); return finish('Скролл: в самый верх'); }
    if (/(авто|плавно).*(прокрут|скролл).*(вниз)/.test(q)) { startAutoScroll(+1,1); return finish('Автоскролл вниз'); }
    if (/(авто|плавно).*(прокрут|скролл).*(вверх)/.test(q)) { startAutoScroll(-1,1); return finish('Автоскролл вверх'); }
    if (/(стоп|останови).*(прокрут|скролл)/.test(q)) { stopAutoScroll(); return finish('Автоскролл: стоп'); }
    if (/(вниз|прокрут(и|ка) вниз)/.test(q)){ const n=extractNumber(q); if(/%|процент/.test(q)&&n){ doScroll(Math.round(innerHeight*(n/100))); return finish(`Скролл вниз на ${n}%`);} scrollDownScreens(n||1); return finish(`Скролл вниз на ${(n||1)} экран(а)`); }
    if (/(вверх|прокрут(и|ка) вверх)/.test(q)){ const n=extractNumber(q); if(/%|процент/.test(q)&&n){ doScroll(-Math.round(innerHeight*(n/100))); return finish(`Скролл вверх на ${n}%`);} scrollUpScreens(n||1); return finish(`Скролл вверх на ${(n||1)} экран(а)`); }

    if (/(назад|вернись назад|шаг назад)/.test(q)) { if(history.length>1) history.back(); else location.assign((location.origin||'/')+'/'); return finish('Навигация: назад'); }
    if (/(вперед|вперёд)($| по истории)/.test(q)) { history.forward(); return finish('Навигация: вперёд'); }
    if (/(на главную|домой|главная страница)/.test(q)) { location.assign((location.origin||'/')+'/'); return finish('Навигация: на главную'); }

    if (/верни .*масштаб.*(1|один)/.test(q)) { setFontScale(1); return finish('Масштаб = 1'); }
    if (/зум|масштаб/.test(q)){ const n=extractNumber(q); if(n&&n>=50&&n<=300){ setFontScale(n/100); return finish(`Масштаб ${n}%`);} }

    return finish('Команда не распознана');
  }

  const rec = new SpeechRec();
  rec.lang='ru-RU'; rec.continuous=true; rec.interimResults=false; rec.maxAlternatives=1;

  const toggleBtn = $('#va-toggle');
  let active=false, restarting=false, lastHeardTs=Date.now();

  function restartRecognition(reason){
    if(!active||restarting) return;
    restarting=true; log('SR restart:', reason);
    try{ (typeof rec.abort==='function')?rec.abort():rec.stop(); }catch{}
    setTimeout(()=>{ try{ rec.start(); setStatus('Слушаю…'); lastHeardTs=Date.now(); }catch(e){ setStatus('Ожидание…'); log('SR start failed',e);} finally{ restarting=false; }},800);
  }

  function startRec(){ if(active) return; try{ rec.start(); active=true; toggleBtn&&(toggleBtn.textContent='🎙 ВЫКЛ'); setStatus('Слушаю…'); lastHeardTs=Date.now(); }catch(e){ setStatus('Ошибка запуска'); log('Ошибка запуска:',e); } }
  function stopRec(){ if(!active) return; try{ rec.stop(); }catch{} active=false; restarting=false; toggleBtn&&(toggleBtn.textContent='🎙 ВКЛ'); setStatus('Отключено'); stopAutoScroll(); cancelPendingStop(); }

  toggleBtn?.addEventListener('click', ()=>{ active?stopRec():startRec(); });
  window.addEventListener('keydown', e=>{ if(e.altKey && (e.key.toLowerCase()==='g')){ e.preventDefault(); active?stopRec():startRec(); } }, {passive:false});

  const WATCHDOG_MS=15000;
  setInterval(()=>{ if(active && (Date.now()-lastHeardTs>WATCHDOG_MS)) restartRecognition('watchdog idle'); },4000);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && active) restartRecognition('tab visible'); });

  rec.onresult = (ev)=>{
    for(let i=ev.resultIndex;i<ev.results.length;i++){
      const res=ev.results[i];
      if(res.isFinal){
        lastHeardTs=Date.now();
        const phrase=res[0].transcript.trim();
        const norm = normalize(phrase);
        const short = norm.split(' ').length <= 6;
        if (speechSynthesis.speaking && !speechSynthesis.paused){
          if (!(short || isCommandPhrase(norm))){ log('echo muted:', phrase); continue; }
        }
        log('Распознано:', `"${phrase}"`);
        handleCommand(phrase);
      }
    }
  };
  rec.onerror = (ev)=>{ setStatus('Ошибка: ' + (ev.error || 'неизвестно')); log('onerror:', ev.error || ev); if(active && ['no-speech','aborted','network'].includes(ev.error||'')){ restartRecognition('onerror '+ev.error); } };
  rec.onend = ()=>{ log('onend; active=',active,'restarting=',restarting); if(active) restartRecognition('onend'); };

  log('Голосовой помощник инициализирован');
})();