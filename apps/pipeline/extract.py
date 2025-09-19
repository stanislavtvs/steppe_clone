import re
import html
import requests
from urllib.parse import urlparse, urlunparse
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}
TIMEOUT = 15


def _http_get(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.text or ""


def _normalize(url: str) -> str:
    """убираем tracking query, фрагменты и т.п."""
    if not url:
        return ""
    p = urlparse(url)
    clean = p._replace(query="", fragment="")
    return urlunparse(clean)


def _maybe_amp(url: str) -> str:
    """
    BBC/медиа часто имеют AMP-версию.
    - если уже есть '/amp', вернём такой же
    - иначе пытаемся вставить '/amp' в конце пути
    """
    try:
        p = urlparse(url)
        if p.path.endswith("/amp"):
            return url
        return urlunparse(p._replace(path=p.path.rstrip("/") + "/amp"))
    except Exception:
        return url


def _extract_paragraphs(html_text: str) -> str:
    """
    Достаём 'основной' текст: <article> или <main>, иначе весь body.
    Возвращаем HTML из <p> (без скриптов, стилей).
    """
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, "html.parser")

    for tag in soup(["script", "style", "noscript", "iframe"]):
        tag.decompose()

    root = (
        soup.find("article")
        or soup.find("main")
        or soup.find("div", attrs={"role": "main"})
        or soup.body
        or soup
    )

    paragraphs = []
    for p in root.find_all("p"):
        text = p.get_text(separator=" ", strip=True)
        if not text:
            continue
        if len(text) < 30:
            continue
        paragraphs.append(f"<p>{html.escape(text)}</p>")
    
    print("\n".join(paragraphs))
    return "\n".join(paragraphs)


def _fallback_jina(url: str) -> str:
    """
    r.jina.ai — текстовая прокси-«ридер».
    Работает как r.jina.ai/http(s)://example.com/...
    """
    if not url:
        return ""
    if url.startswith("http://"):
        rurl = "https://r.jina.ai/http://" + url[len("http://") :]
    elif url.startswith("https://"):
        rurl = "https://r.jina.ai/https://" + url[len("https://") :]
    else:
        rurl = "https://r.jina.ai/" + url
    try:
        txt = _http_get(rurl)
    except Exception:
        return ""
    soup = BeautifulSoup(txt, "html.parser")
    paras = []
    for p in soup.find_all("p"):
        t = p.get_text(separator=" ", strip=True)
        if len(t) >= 30:
            paras.append(f"<p>{html.escape(t)}</p>")
    if not paras:
        blocks = [b.strip() for b in re.split(r"\n{2,}", soup.get_text("\n")) if len(b.strip()) >= 30]
        paras = [f"<p>{html.escape(b)}</p>" for b in blocks]
    return "\n".join(paras)


def fetch_main_html(url: str) -> str:
    """
    Главная функция: возвращает чистый HTML с абзацами <p>.
    Порядок:
      1) обычная страница
      2) AMP
      3) r.jina.ai
    """
    url = _normalize(url)
    if not url:
        return ""

    try:
        raw = _http_get(url)
        body = _extract_paragraphs(raw)
        if len(body) >= 400:
            return body
    except Exception:
        pass

    try:
        amp_url = _maybe_amp(url)
        if amp_url and amp_url != url:
            raw_amp = _http_get(amp_url)
            body_amp = _extract_paragraphs(raw_amp)
            if len(body_amp) >= 400:
                return body_amp
    except Exception:
        pass

    try:
        body_jina = _fallback_jina(url)
        if len(body_jina) >= 400:
            return body_jina
    except Exception:
        pass

    return ""
