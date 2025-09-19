(function(){
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SpeechRec;

  const DEBUG = true;
  const log = (...a)=>{ if(DEBUG) console.log('[VA]', ...a); };
  const group = (t)=>{ if(DEBUG) console.groupCollapsed('[VA]', t); };
  const end = ()=>{ if(DEBUG) console.groupEnd(); };

  const NUMBER_WORDS = {
    "ноль": 0, "пятьдесят": 50, "шестьдесят": 60, "семьдесят": 70,
    "восемьдесят": 80, "девяносто": 90, "сто": 100, "сто десять": 110,
    "сто двадцать": 120, "сто тридцать": 130, "сто сорок": 140,
    "сто пятьдесят": 150, "сто шестьдесят": 160, "сто семьдесят": 170,
    "сто восемьдесят": 180, "сто девяносто": 190, "двести": 200
  };
  group('Поддерживаемые числовые слова');
  Object.entries(NUMBER_WORDS).forEach(([k,v])=>console.log(`${k} → ${v}`));
  end();

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
  $('#va-back')?.addEventListener('click', ()=>{
    if (history.length > 1) history.back();
    else location.assign((location.origin || '/') + '/');
  });
  $('#va-home')?.addEventListener('click', ()=>{
    location.assign((location.origin || '/') + '/');
  });

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

  function setFontScale(scale){
    if (typeof state !== 'object') return;
    const s = Math.max(0.5, Math.min(3, Number(scale) || 1));
    state.fontScale = +s.toFixed(3);
    if (typeof apply === 'function') apply();
  }
  function nudgeFont(delta){
    if (btn.fsInc && btn.fsDec){
      (delta > 0 ? btn.fsInc : btn.fsDec).click();
    } else if (typeof state === 'object' && typeof apply === 'function'){
      state.fontScale = +(state.fontScale + delta).toFixed(3);
      apply();
    }
  }
  function setTheme(name){
    if (typeof state !== 'object' || typeof apply !== 'function') return;
    const map = { 'default':'default','обычная':'default','светлая':'default','тёмная':'dark','темная':'dark','синяя':'blue','сине-тёмная':'blue','сепия':'sepia','контраст':'contrast','контрастная':'contrast' };
    state.theme = map[name] || name || 'default'; apply();
  }
  function setImages(on){ if(typeof state==='object'&&typeof apply==='function'){ state.images = on?'on':'off'; apply(); } }
  function setLineHeight(kind){
    const map = { 'стандартный':'std','обычный':'std','средний':'md','большой':'lg' };
    if(typeof state==='object'&&typeof apply==='function'){ state.lineHeight = map[kind]||kind||'std'; apply(); }
  }
  function setTracking(kind){
    const map = { 'обычный':'0','ноль':'0','увеличенный':'1','полуторный':'1.5','полторы':'1.5','двойной':'2','два':'2' };
    if(typeof state==='object'&&typeof apply==='function'){ state.tracking = map[kind]||kind||'0'; apply(); }
  }
  function setFontFamily(kind){
    const map = { 'без засечек':'sans','с засечками':'serif','моноширинный':'mono','моно':'mono' };
    if(typeof state==='object'&&typeof apply==='function'){ state.font = map[kind]||kind||'sans'; apply(); }
  }
  function toggleSub(open){
    if(typeof state!=='object'||typeof apply!=='function') return;
    state.subOpen = (typeof open==='boolean') ? open : !state.subOpen; apply();
  }

  const SCROLL_STEP = ()=> Math.round(window.innerHeight * 0.85);
  let autoScrollTimer = null;

  function doScroll(px){ window.scrollBy({ top: px, behavior: 'smooth' }); }
  function scrollDownScreens(n=1){ doScroll( SCROLL_STEP() * (n||1) ); }
  function scrollUpScreens(n=1){ doScroll( -SCROLL_STEP() * (n||1) ); }
  function scrollToTop(){ window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function scrollToBottom(){ window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); }
  function startAutoScroll(dir=1, speed=1){
    stopAutoScroll();
    const pxPerTick = 16 * speed * (dir>0 ? 1 : -1);
    autoScrollTimer = setInterval(()=> window.scrollBy(0, pxPerTick), 16);
  }
  function stopAutoScroll(){ if (autoScrollTimer){ clearInterval(autoScrollTimer); autoScrollTimer=null; } }

  function ttsPlay(){ btn.ttsPlay?.click(); }
  function ttsPause(){ btn.ttsPause?.click(); }
  function ttsStop(){ btn.ttsStop?.click(); }

  function extractNumber(text){
    group('extractNumber'); console.log('вход:', text);
    const m = text.match(/(\d{1,3})(?:\s*%| процент| процентов)?/i);
    if (m){ const val = parseInt(m[1],10); console.log('найдены цифры →', val); end(); return val; }
    for (const [k,v] of Object.entries(NUMBER_WORDS)){
      if (text.includes(k)){ console.log(`найдено словом: "${k}" →`, v); end(); return v; }
    }
    console.log('число не найдено'); end(); return null;
  }

  function normalize(s){
    return s.toLowerCase()
      .replace(/[ё]/g,'е')
      .replace(/[^\p{L}\p{N}\s%]/gu,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function handleCommand(raw){
    group('handleCommand'); console.log('распознанная фраза:', raw);
    const q = normalize(raw); console.log('нормализовано:', q);
    const finish = (msg)=>{ console.log('действие:', msg); end(); return msg; };

    if (/(увелич(ь|и)|больше).*(шрифт|текст)|шрифт (больше|прибавь|плюс)/.test(q)) { nudgeFont(+0.05); return finish('Шрифт +'); }
    if (/(уменьш(и|ь)|меньше).*(шрифт|текст)|шрифт (меньше|убавь|минус)/.test(q)) { nudgeFont(-0.05); return finish('Шрифт −'); }
    if (/сброс(ить)? (масштаб|шрифт)|верни (масштаб|шрифт) (1|один)/.test(q) || /шрифт 100/.test(q)) { setFontScale(1); return finish('Сброс шрифта'); }
    if (/(шрифт|масштаб|зум)/.test(q)){
      const n = extractNumber(q);
      if (n && n >= 50 && n <= 300){ setFontScale(n/100); return finish(`Шрифт ${n}%`); }
    }

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
    if (/шрифт.*без засеч/.test(q) || /санс|sans/.test(q)) { setFontFamily('без засечек'); return finish('Шрифт: без засечек'); }
    if (/шрифт.*с засеч/.test(q) || /сериф|serif/.test(q)) { setFontFamily('с засечками'); return finish('Шрифт: с засечками'); }
    if (/моно(ширинн)?|mono/.test(q)) { setFontFamily('моноширинный'); return finish('Шрифт: моноширинный'); }

    if (/(показать|открыть).*доп(олнительно)?/.test(q)) { toggleSub(true); return finish('Дополнительно: открыто'); }
    if (/(скрыть|закрыть).*доп(олнительно)?/.test(q)) { toggleSub(false); return finish('Дополнительно: закрыто'); }
    if (/(переключить|дополнительно)/.test(q)) { toggleSub(); return finish('Дополнительно: переключено'); }

    if (/озвуч(ь|ить)|прочитай|прочесть/.test(q)) { ttsPlay(); return finish('Озвучка: старт'); }
    if (/пауза|приостанови/.test(q)) { ttsPause(); return finish('Озвучка: пауза'); }
    if (/продолж(и|ить)/.test(q)) { ttsPlay(); return finish('Озвучка: продолжить'); }
    if (/стоп|останови/.test(q)) { ttsStop(); return finish('Озвучка: стоп'); }

    if (/(в самый низ|в конец|вниз до конца)/.test(q)) { scrollToBottom(); return finish('Скролл: в самый низ'); }
    if (/(в самый верх|наверх|в начало)/.test(q)) { scrollToTop(); return finish('Скролл: в самый верх'); }

    if (/(авто|плавно).*(прокрут|скролл).*(вниз)/.test(q)) { startAutoScroll(+1, 1); return finish('Автоскролл вниз'); }
    if (/(авто|плавно).*(прокрут|скролл).*(вверх)/.test(q)) { startAutoScroll(-1, 1); return finish('Автоскролл вверх'); }
    if (/(стоп|останови).*(прокрут|скролл)/.test(q)) { stopAutoScroll(); return finish('Автоскролл: стоп'); }

    if (/(вниз|прокрут(и|ка) вниз)/.test(q)) {
      const n = extractNumber(q);
      if (/%|процент/.test(q) && n){ doScroll(Math.round(window.innerHeight * (n/100))); return finish(`Скролл вниз на ${n}%`); }
      scrollDownScreens(n||1); return finish(`Скролл вниз на ${(n||1)} экран(а)`);
    }
    if (/(вверх|прокрут(и|ка) вверх)/.test(q)) {
      const n = extractNumber(q);
      if (/%|процент/.test(q) && n){ doScroll(-Math.round(window.innerHeight * (n/100))); return finish(`Скролл вверх на ${n}%`); }
      scrollUpScreens(n||1); return finish(`Скролл вверх на ${(n||1)} экран(а)`);
    }

    if (/(назад|вернись назад|шаг назад)/.test(q)) { if(history.length>1) history.back(); else location.assign((location.origin||'/')+'/'); return finish('Навигация: назад'); }
    if (/(вперед|вперёд)($| по истории)/.test(q)) { history.forward(); return finish('Навигация: вперёд'); }
    if (/(на главную|домой|главная страница)/.test(q)) { location.assign((location.origin||'/')+'/'); return finish('Навигация: на главную'); }

    if (/верни .*масштаб.*(1|один)/.test(q)) { setFontScale(1); return finish('Масштаб = 1'); }
    if (/зум|масштаб/.test(q)){
      const n = extractNumber(q);
      if (n && n >= 50 && n <= 300){ setFontScale(n/100); return finish(`Масштаб ${n}%`); }
    }

    return finish('Команда не распознана');
  }

  const rec = new SpeechRec();
  rec.lang = 'ru-RU'; 
  rec.continuous = true;
  rec.interimResults = false;

  const toggleBtn = $('#va-toggle');
  const statusChip = $('#va-status');
  let active = false;
  let restarting = false;

  const setStatus = (txt)=>{ if (statusChip) statusChip.textContent = txt; };

  function startRec(){
    if (active) return;
    try{
      rec.start(); active = true;
      toggleBtn && (toggleBtn.textContent = '🎙 ВЫКЛ');
      setStatus('Слушаю…'); log('Прослушивание включено');
    }catch(e){ setStatus('Ошибка запуска'); log('Ошибка запуска:', e); }
  }
  function stopRec(){
    if (!active) return;
    try{ rec.stop(); }catch(e){}
    active = false; restarting = false;
    toggleBtn && (toggleBtn.textContent = '🎙 ВКЛ');
    setStatus('Отключено'); log('Прослушивание выключено');
    stopAutoScroll();
  }

  toggleBtn?.addEventListener('click', ()=>{ active ? stopRec() : startRec(); });
  window.addEventListener('keydown', (e)=>{
    if (e.altKey && (e.key.toLowerCase()==='g')){
      e.preventDefault(); active ? stopRec() : startRec();
    }
  }, {passive:false});

  rec.onresult = (ev)=>{
    for (let i = ev.resultIndex; i < ev.results.length; i++){
      const res = ev.results[i];
      if (res.isFinal){
        const phrase = res[0].transcript.trim();
        log('Распознано:', `"${phrase}"`);
        const outcome = handleCommand(phrase);
        setStatus(outcome);
      }
    }
  };
  rec.onerror = (ev)=>{
    setStatus('Ошибка: ' + (ev.error || 'неизвестно'));
    log('onerror:', ev.error || ev);
    if (active && ['no-speech','aborted','network'].includes(ev.error)) {
      try { restarting = true; rec.stop(); } catch(e){}
    }
  };
  rec.onend = ()=>{
    log('onend; active=', active, 'restarting=', restarting);
    if (active || restarting){
      setTimeout(()=>{
        try { rec.start(); setStatus('Слушаю…'); log('Перезапуск…'); }
        catch(e){ setStatus('Ожидание…'); log('Не удалось перезапустить:', e); }
      }, 1000);
    }
  };
})();