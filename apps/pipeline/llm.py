import os
import re
import json
from typing import Dict, Any
from openai import OpenAI

LLM_MODEL = os.getenv("LLM_MODEL", "llama3:8b")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")


client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)


def _extract_json_block(s: str) -> str:
    """
    Вырезает первый «балансный» блок {...} из строки.
    Срезает обёртки вида ```json ... ``` если они есть.
    """
    if not s:
        return "{}"
    s = s.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.I)
    s = re.sub(r"\s*```$", "", s)
    depth = 0
    start = -1
    for i, ch in enumerate(s):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start != -1:
                    return s[start : i + 1]
    return s


def _json_loads_loose(s: str) -> Dict[str, Any]:
    """
    Пытается распарсить JSON:
    1) прямой json.loads
    2) извлечь {...} + заменить «умные» кавычки
    3) попросить LLM починить до строгого JSON (верни только JSON)
    """
    try:
        return json.loads(s)
    except Exception:
        pass

    s2 = _extract_json_block(s)
    s2 = s2.replace("“", '"').replace("”", '"').replace("’", "'")
    try:
        return json.loads(s2)
    except Exception:
        pass

    fix = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "Приведи вход к СТРОГОМУ JSON. Верни только JSON-объект."},
            {"role": "user", "content": s2},
        ],
        temperature=0,
        response_format={"type": "json_object"},
        extra_body={"format": "json"},
    ).choices[0].message.content or "{}"

    fix = _extract_json_block(fix)
    return json.loads(fix)

def _coerce_json(s: str) -> dict:
    """Back-compat: studio.api импортирует эту функцию.
    Возвращает словарь, аккуратно чиня кривой JSON."""
    try:
        return _json_loads_loose(s)
    except Exception:
        return {}

SYSTEM_NEWS = (
    "Ты — редактор новостей. Верни СТРОГИЙ JSON с ключами: "
    "title, lead, body_html, tags (массив строк)."
    "Никаких комментариев, markdown и бэктиков — только JSON-объект."
    "Новости должны быть объёмными. Пиши детально, со всеми подробностями, в литературном или публицистическом стиле."
    "Текст не должен быть сплошным. Оформление создаётся с помощью HTML тегов."
    "Допустимые HTML теги для форматирования: p, h1, h2, h3, h4, h5, h6, b, i, u, ul, ol, li, s, ins, mark, sup, sub, q, blockquote, cite, abbr, dfn."
    "Не используй те теги, что не входят в список допустимых для форматирования."
    "В теле новости должны быть подзаголовки h3, разбивающие текст на логические части."
    "Сохраняй все факты из входного текста, не выдумывай ничего."
    "Если в тексте есть цитаты, сохраняй их и выделяй тегом blockquote."
    "Ты должен генерировать новость. Не генерируй просто пустой <div/>."
)

def generate_news_json(html: str, url: str, target_lang: str = "ru") -> Dict[str, Any]:
    """
    Принимает HTML/текст и URL источника.
    Возвращает: {title, lead, body_html, tags}
    """
    user = (
        f"Сгенерируй новость на {target_lang}.\n"
        f"Источник: {url}\n"
        "Вход ниже (HTML/текст, можно использовать только релевантное):\n"
        f"{(html or '')[:30000]}"
    )

    resp = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role":"system","content":SYSTEM_NEWS},
                {"role":"user","content":user}],
        temperature=0.2,
        max_tokens=1800,
        response_format={"type":"json_object"},
        extra_body={"format":"json"},
    )
    raw = resp.choices[0].message.content or "{}"
    data = _json_loads_loose(raw)

    out = {
        "title": (data.get("title") or "").strip(),
        "lead": (data.get("lead") or "").strip(),
        "body_html": (data.get("body_html") or "").strip(),
        "tags": data.get("tags") or [],
    }
    if isinstance(out["tags"], str):
        out["tags"] = [t.strip() for t in out["tags"].split(",") if t.strip()]

    if not out["body_html"]:
        out["body_html"] = f"<p><a href=\"{url}\">Источник</a></p>"

    print(1, out["body_html"])
    return out



_ACTION_PROMPTS: Dict[str, str] = {
    "improve": (
        "Улучши читабельность и стиль, сохрани факты и нейтральный тон. "
        "Сделай лид чётким и информативным. Устрани повторы, сохрани структуру HTML, цитаты и ссылки."
    ),
    "shorten": (
        "Сократи объём текста на ~25–35%, сохрани факты, цитаты и ключевые детали. "
        "Строго сохраняй нейтральность и структуру HTML."
    ),
    "expand": (
        "Расширь текст на ~25–40% за счёт контекста и нейтральных деталей, не выдумывай фактов. "
        "Сохрани структуру HTML, цитаты и ссылки."
    ),
    "regenerate": (
        "Перепиши лид и тело нейтрально и ясно, сохраняя факты и структуру HTML. "
        "Не добавляй неподтверждённых сведений."
    ),
}

_ACTION_SYSTEM = (
    "Ты — редактор новостей. Тебе дадут title/lead/body_html. "
    "Выполни запрошенное действие и верни СТРОГИЙ JSON:\n"
    '{ "lead": "<p>...</p>", "body_html": "<p>...</p>" }\n'
    "Без комментариев и бэктиков — только JSON-объект."
)

MODEL = LLM_MODEL
SYS_EDITOR = _ACTION_SYSTEM

def prompt_action_json(
    action: str,
    title: str,
    lead: str,
    body_html: str,
    target_lang: str = "ru",
) -> Dict[str, str]:
    """
    Выполняет действие над текстом (improve/shorten/expand/regenerate) и
    возвращает словарь: {"lead": str, "body_html": str}
    """
    action = (action or "").lower().strip()
    instruction = _ACTION_PROMPTS.get(action, _ACTION_PROMPTS["improve"])

    user = (
        f"ACTION: {action}\n"
        f"TARGET_LANG: {target_lang}\n\n"
        f"TITLE:\n{title or ''}\n\n"
        f"LEAD:\n{lead or ''}\n\n"
        "BODY_HTML:\n"
        f"{(body_html or '')[:28000]}"
    )

    resp = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": _ACTION_SYSTEM},
            {"role": "user", "content": instruction + "\n\n" + user},
        ],
        temperature=0.2,
        max_tokens=2000,
        response_format={"type": "json_object"},
        extra_body={"format": "json"},
    )
    raw = resp.choices[0].message.content or "{}"
    data = _json_loads_loose(raw)

    out = {
        "lead": (data.get("lead") or lead or "").strip(),
        "body_html": (data.get("body_html") or body_html or "").strip(),
    }
    if not out["body_html"]:
        out["body_html"] = (body_html or lead or title or "").strip() or "<p></p>"
    return out

prompt_action = prompt_action_json
