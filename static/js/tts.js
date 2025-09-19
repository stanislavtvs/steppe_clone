(function(){
  if (window.__NEWS_VA_INITED__) return;
  window.__NEWS_VA_INITED__ = true;

  const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SR_SUPPORTED  = !!SRClass;
  const TTS_SUPPORTED = 'speechSynthesis' in window;

  const feed = document.querySelector('section.feed') || document;
  const cards = [...feed.querySelectorAll('article')];
  if (!cards.length) return;

  (function ensureCss(){
    if (document.getElementById('va-css-outline')) return;
    const st = document.createElement('style');
    st.id = 'va-css-outline';
    st.textContent = `
      .va-current{outline:3px solid #2563eb; outline-offset:6px; border-radius:12px}
      .va-news-ui{position:fixed;right:12px;bottom:12px;display:flex;gap:8px;align-items:center;z-index:99999;font:14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
      .va-news-ui #va-news-toggle{background:#111;color:#fff;border:none;border-radius:999px;padding:10px 14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18)}
      .va-news-ui #va-news-toggle[aria-pressed="true"]{background:#2563eb}
      .va-news-ui #va-news-status{background:#111;color:#fff;padding:6px 10px;border-radius:999px;opacity:.85}
    `;
    document.head.appendChild(st);
  })();

  let toggleBtn = document.getElementById('va-news-toggle');
  let statusEl  = document.getElementById('va-news-status');
  if (!toggleBtn || !statusEl){
    const wrap = document.createElement('div');
    wrap.className = 'va-news-ui';
    wrap.innerHTML = `
      <button id="va-news-toggle" type="button" aria-pressed="false">🎙 Запустить голос</button>
      <span id="va-news-status" aria-live="polite">Отключено</span>
    `;
    document.body.appendChild(wrap);
    toggleBtn = wrap.querySelector('#va-news-toggle');
    statusEl  = wrap.querySelector('#va-news-status');
  }
  const setStatus = (t)=>{ statusEl.textContent = t; };

  let curIndex = 0;
  function inViewport(el){
    const r = el.getBoundingClientRect();
    const vh = innerHeight || document.documentElement.clientHeight;
    return r.top >= 0 && r.bottom <= vh;
  }
  function highlight(i, {scroll=true} = {}){
    cards.forEach(c=>c.classList.remove('va-current'));
    const el = cards[i]; if (!el) return;
    el.classList.add('va-current');
    if (scroll && !inViewport(el)) el.scrollIntoView({block:'center', behavior:'smooth'});
  }
  function goto(i){
    curIndex = Math.max(0, Math.min(i, cards.length-1));
    highlight(curIndex);
    setStatus(`Новость ${curIndex+1}/${cards.length}`);
  }
  function next(){ if (curIndex < cards.length-1){ stopTTS(true); goto(curIndex+1); } else setStatus('Это последняя'); }
  function prev(){ if (curIndex > 0){ stopTTS(true); goto(curIndex-1); } else setStatus('Это первая'); }

  let isNavigating = false;
  function openCurrent(){
    if (isNavigating) return;
    const el = cards[curIndex];
    const a = el && (el.querySelector('.post__title a, a.post__thumb, a[href]'));
    const url = a && (a.getAttribute('href') || a.href);
    if (!url){ setStatus('Ссылка не найдена'); return; }
    isNavigating = true;
    stopTTS(true);
    setTimeout(()=>{ location.assign(url); }, 160);
  }

  highlight(curIndex, {scroll:false});

  const SCREEN_STEP = ()=> Math.round((innerHeight||document.documentElement.clientHeight)*0.9);
  function scrollByPx(px){ window.scrollBy({top:px, behavior:'smooth'}); }
  function scrollDownScreens(n=1){ scrollByPx(SCREEN_STEP()*(n||1)); }
  function scrollUpScreens(n=1){ scrollByPx(-SCREEN_STEP()*(n||1)); }
  function scrollByPercent(p){
    const max = document.documentElement.scrollHeight - (innerHeight||0);
    scrollByPx(Math.round(max*(p/100)));
  }

  let newsUtter = null;
  let ttsPaused = false;
  let ttsStopping = false;

  function normText(s){ return (s||'').replace(/\s+/g,' ').trim(); }
  function buildCardText(el){
    const tag   = normText(el.querySelector('.post__tag')?.textContent);
    const title = normText(el.querySelector('.post__title')?.textContent);
    const lead  = normText(el.querySelector('.post__lead')?.textContent);
    const date  = normText(el.querySelector('time')?.textContent);
    const auth  = normText(el.querySelector('.post__author')?.textContent);
    const parts = [];
    if (tag) parts.push(tag);
    if (title) parts.push(title);
    if (lead) parts.push(lead);
    if (date || auth) parts.push([date, auth].filter(Boolean).join(', '));
    return parts.join('. ') + (parts.length ? '.' : '');
  }
  function speakCard(i = curIndex){
    if (!TTS_SUPPORTED){ setStatus('Озвучка недоступна'); return; }
    isNavigating = false;
    stopTTS(true);
    const el = cards[i]; if (!el){ setStatus('Нет карточки'); return; }
    const text = buildCardText(el); if (!text){ setStatus('Пусто для чтения'); return; }

    newsUtter = new SpeechSynthesisUtterance(text);
    newsUtter.lang = 'ru-RU';
    newsUtter.rate = 1.0;
    newsUtter.onstart = ()=>{ ttsPaused=false; setStatus('Читаю новость'); };
    newsUtter.onend   = ()=>{ if(!ttsStopping) setStatus('Готово'); newsUtter=null; ttsPaused=false; ttsStopping=false; };
    newsUtter.onerror = (e)=>{
      if (ttsStopping || (e && (e.error==='canceled' || e.error==='interrupted'))) {
        setStatus('Остановлено');
      } else {
        setStatus('Ошибка озвучки');
      }
      newsUtter=null; ttsPaused=false; ttsStopping=false;
    };
    try { window.speechSynthesis.speak(newsUtter); }
    catch { setStatus('Ошибка озвучки'); newsUtter=null; ttsPaused=false; ttsStopping=false; }
  }
  function robustPause(retries=6){
    const tick=()=>{ try{ speechSynthesis.pause(); }catch{}; if(!speechSynthesis.paused && retries-- > 0) setTimeout(tick,70); else { ttsPaused=speechSynthesis.paused; if(ttsPaused) setStatus('Пауза'); } };
    tick();
  }
  function stopTTS(silent=false){
    if (newsUtter || speechSynthesis.speaking){ ttsStopping=true; try{ speechSynthesis.cancel(); }catch{} }
    newsUtter=null; ttsPaused=false;
    if (!silent) setStatus('Остановлено');
    setTimeout(()=>{ ttsStopping=false; }, 200);
  }
  function pauseTTS(){ if (!newsUtter && !speechSynthesis.speaking) return; if (!speechSynthesis.paused) robustPause(); }
  function resumeTTS(){
    if (speechSynthesis.paused){ try{ speechSynthesis.resume(); ttsPaused=false; setStatus('Читаю новость'); }catch{} }
    else if (!newsUtter){ speakCard(curIndex); }
  }

  if (!SR_SUPPORTED){
    if (toggleBtn) toggleBtn.disabled = true;
    setStatus('Голос недоступен');
    return;
  }

  const newsRec = new SRClass();
  newsRec.lang = 'ru-RU';
  newsRec.continuous = true;
  newsRec.interimResults = false;
  newsRec.maxAlternatives = 1;

  let newsActive = false;
  let newsRestarting = false;
  let newsHeardAt = Date.now();

  function startSR(){
    if (newsActive) return;
    try{
      newsRec.start(); newsActive = true; newsHeardAt = Date.now();
      if (toggleBtn){ toggleBtn.setAttribute('aria-pressed','true'); toggleBtn.textContent='■ Остановить'; }
      setStatus('Слушаю…');
    }catch{ setStatus('Ошибка запуска'); }
  }
  function stopSR(){
    if (!newsActive) return;
    try{ newsRec.stop(); }catch{}
    newsActive = false; newsRestarting = false;
    if (toggleBtn){ toggleBtn.setAttribute('aria-pressed','false'); toggleBtn.textContent='🎙 Запустить голос'; }
    setStatus('Отключено');
  }
  function restartSR(){
    if (!newsActive || newsRestarting) return;
    newsRestarting = true;
    try{ (typeof newsRec.abort==='function') ? newsRec.abort() : newsRec.stop(); }catch{}
    setTimeout(()=>{ try{ newsRec.start(); newsHeardAt = Date.now(); setStatus('Слушаю…'); }catch{ setStatus('Ожидание…'); } finally{ newsRestarting=false; } }, 700);
  }
  if (toggleBtn) toggleBtn.addEventListener('click', ()=> newsActive ? stopSR() : startSR());

  const WATCHDOG_MS = 15000;
  setInterval(()=>{ if (newsActive && Date.now()-newsHeardAt > WATCHDOG_MS) restartSR(); }, 4000);
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState==='visible' && newsActive) restartSR(); });

  function norm(s){
    return s
      .toLowerCase()
      .replace(/\u00a0/g, ' ')
      .replace(/[ё]/g,'е')
      .replace(/[^0-9a-zа-я\s№-]/giu,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  const CARDINALS = {
    'ноль':0,'один':1,'одна':1,'два':2,'две':2,'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'восемь':8,'девять':9,
    'десять':10,'одиннадцать':11,'двенадцать':12,'тринадцать':13,'четырнадцать':14,'пятнадцать':15,
    'шестнадцать':16,'семнадцать':17,'восемнадцать':18,'девятнадцать':19,
    'двадцать':20,'тридцать':30,'сорок':40,'пятьдесят':50,'шестьдесят':60,'семьдесят':70,'восемьдесят':80,'девяносто':90
  };
  const ORDINALS = {
    'первая':1,'первый':1,'вторая':2,'второй':2,'третья':3,'третий':3,'четвертая':4,'четвертый':4,
    'пятая':5,'пятый':5,'шестая':6,'шестой':6,'седьмая':7,'седьмой':7,'восьмая':8,'восьмой':8,'девятая':9,'девятый':9,
    'десятая':10,'десятый':10
  };

  function wordsToNumber(q){
    const tens = ['двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
    const unitsMap = {'один':1,'одна':1,'два':2,'две':2,'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'восемь':8,'девять':9};
    const re = new RegExp(`(?:^|\\s)(?:новост[ьи]\\s*)?(?:(${tens.join('|')})\\s+(${Object.keys(unitsMap).join('|')}))(?:\\s|$)`, 'iu');
    const m = q.match(re);
    if (m){
      const u = (m[2]==='одна') ? 'один' : m[2];
      return (CARDINALS[m[1]]||0) + (unitsMap[u]||0);
    }
    return null;
  }

  function parseIndex(q){
    let m = q.match(/(?:^|\s)(?:к\s*)?(?:новост[ьи]|номер)\s*(?:под\s*номером|№|номер)?\s*(\d{1,3})(?:\s|$)/iu);
    if (m) return +m[1];

    m = q.match(/(?:^|\s)(?:выбери|выдели|покажи|перейди|открой)\s*(?:к\s*)?(?:новост[ьи]\s*)?(?:под\s*номером|№|номер)?\s*(\d{1,3})(?:\s|$)/iu);
    if (m) return +m[1];

    for (const [w,n] of Object.entries(ORDINALS)){
      if (new RegExp(`(?:^|\\s)${w}\\s+новост[ьи](?:\\s|$)`, 'iu').test(q)) return n;
      if (new RegExp(`(?:^|\\s)новост[ьи]\\s+${w}(?:\\s|$)`, 'iu').test(q)) return n;
    }

    for (const [w,n] of Object.entries(CARDINALS)){
      if (new RegExp(`(?:^|\\s)(?:новост[ьи]\\s+)?${w}(?:\\s|$)`, 'iu').test(q)) return n;
    }

    const comp = wordsToNumber(q);
    if (comp!=null) return comp;

    return null;
  }

  function parseCount(q){
    let m = q.match(/(\d{1,2})\s*экран/iu); if (m) return +m[1];
    for (const [w,n] of Object.entries(CARDINALS)){ const re=new RegExp(`\\b${w}\\s*экран`, 'iu'); if(re.test(q)) return n; }
    return 1;
  }
  function parsePercent(q){ const m = q.match(/(\d{1,3})\s*%|(\d{1,3})\s*процент/iu); return m ? +(m[1]||m[2]) : null; }
  function allowedWhileSpeaking(q){
    return /(стоп|остановись|пауза|продолжи|дальше|следующ|назад|предыдущ|прошл|зайти|открыть|перейти|озвучь|вверх|вниз|прокрут|новост|номер|экран|%|процент)/iu.test(q);
  }

  function handleSpeech(cmdRaw){
    const q = norm(cmdRaw);

    if (TTS_SUPPORTED && speechSynthesis.speaking && !speechSynthesis.paused){
      if (!allowedWhileSpeaking(q)) return;
    }

    const pick = parseIndex(q);
    if (pick!=null && pick>=1 && pick<=cards.length){ stopTTS(true); goto(pick-1); return; }

    if (/(дальше|следующ(ая|ую)|вперед|вперёд)/iu.test(q)) { next(); return; }
    if (/(назад|предыдущ(ая|ую)|прошл(ая|ую))/iu.test(q))   { prev(); return; }
    if (/(зайти|открыть|перейти|войти|читать)/iu.test(q))   { openCurrent(); return; }

    if (/(озвучь|прочитай|прочесть)/iu.test(q)) { speakCard(curIndex); return; }
    if (/(стоп|остановись|хватит|заткнись)/iu.test(q)) { stopTTS(); return; }
    if (/пауза/iu.test(q)) { pauseTTS(); return; }
    if (/продолж(и|ить)/iu.test(q)) { resumeTTS(); return; }

    if (/(в самый верх|наверх|в начало)/iu.test(q)) { window.scrollTo({top:0,behavior:'smooth'}); return; }
    if (/(в самый низ|в конец|вниз до конца)/iu.test(q)) { window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'}); return; }
    if (/(вниз|прокрут[и]? вниз)/iu.test(q)){
      const pct = parsePercent(q); if (pct!=null){ scrollByPercent(pct); return; }
      const n = parseCount(q); scrollDownScreens(n); return;
    }
    if (/(вверх|прокрут[и]? вверх)/iu.test(q)){
      const pct = parsePercent(q); if (pct!=null){ scrollByPercent(-pct); return; }
      const n = parseCount(q); scrollUpScreens(n); return;
    }
  }

  newsRec.onresult = (ev)=>{
    for (let i=ev.resultIndex; i<ev.results.length; i++){
      const r = ev.results[i];
      if (r.isFinal){ newsHeardAt = Date.now(); handleSpeech(r[0].transcript.trim()); }
    }
  };
  newsRec.onerror = (ev)=>{ setStatus('Ошибка: '+(ev.error||'неизвестно')); if(newsActive && ['no-speech','aborted','network'].includes(ev.error||'')) restartSR(); };
  newsRec.onend   = ()=>{ if(newsActive) restartSR(); };

  setStatus('Отключено');
})();