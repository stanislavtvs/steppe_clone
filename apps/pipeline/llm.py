import os
import re
import json
from typing import Dict, Any
from openai import OpenAI
import google.generativeai as genai

# LLM_MODEL = os.getenv("LLM_MODEL", "llama3:8b")
# LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
# LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")


# client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)

genai.configure(api_key=os.getenv("API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash') # или gemini-1.5-pro

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


# def _json_loads_loose(s: str) -> Dict[str, Any]:
#     """
#     Пытается распарсить JSON:
#     1) прямой json.loads
#     2) извлечь {...} + заменить «умные» кавычки
#     3) попросить LLM починить до строгого JSON (верни только JSON)
#     """
#     try:
#         return json.loads(s)
#     except Exception:
#         pass

#     s2 = _extract_json_block(s)
#     s2 = s2.replace("“", '"').replace("”", '"').replace("’", "'")
#     try:
#         return json.loads(s2)
#     except Exception:
#         pass

#     fix = client.chat.completions.create(
#         model=LLM_MODEL,
#         messages=[
#             {"role": "system", "content": "Приведи вход к СТРОГОМУ JSON. Верни только JSON-объект."},
#             {"role": "user", "content": s2},
#         ],
#         temperature=0,
#         response_format={"type": "json_object"},
#         extra_body={"format": "json"},
#     ).choices[0].message.content or "{}"

#     fix = _extract_json_block(fix)
#     return json.loads(fix)

def _json_loads_loose(s: str) -> Dict[str, Any]:
    """
    Пытается распарсить JSON:
    1) прямой json.loads
    2) извлечь {...} + заменить «умные» кавычки
    3) попросить Gemini починить до строгого JSON
    """
    # 1. Простая попытка
    try:
        return json.loads(s)
    except Exception:
        pass

    # 2. Очистка и вторая попытка
    s2 = _extract_json_block(s)
    s2 = s2.replace("“", '"').replace("”", '"').replace("’", "'")
    try:
        return json.loads(s2)
    except Exception:
        pass

    # 3. Использование Gemini для исправления
    try:
        # Предполагается, что модель инициализирована ранее: 
        # model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"Приведи вход к СТРОГОМУ JSON. Верни только JSON-объект. Входные данные: {s2}"
        
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0
            )
        )
        
        fix = response.text or "{}"
        fix = _extract_json_block(fix)
        return json.loads(fix)
    except Exception as e:
        print(f"Ошибка Gemini при исправлении JSON: {e}")
        return {}

def _coerce_json(s: str) -> dict:
    """Back-compat: studio.api импортирует эту функцию.
    Возвращает словарь, аккуратно чиня кривой JSON."""
    try:
        return _json_loads_loose(s)
    except Exception:
        return {}

SYSTEM_NEWS = (
    "Ты — опытный шеф-редактор крупного медиа (как The Steppe или Vox). "
    "Твоя задача — превратить сухой текст в захватывающую, глубокую статью. "
    "Верни СТРОГИЙ JSON с ключами: title, lead, body_html, tags (массив строк).\n\n"
    "ТРЕБОВАНИЯ К КОНТЕНТУ:\n"
    "1. ОБЪЕМ: Пиши развернуто. Тело статьи (body_html) должно содержать минимум 2500-4000 знаков.\n"
    "2. СТРУКТУРА: Обязательно разделяй текст подзаголовками <h3>. Внутри каждой секции должно быть 2-4 абзаца <p>.\n"
    "3. СТИЛЬ: Публицистический, экспертный, но понятный. Избегай канцеляризмов.\n"
    "4. ДЕТАЛИ: Если в источнике мало данных, добавь нейтральный контекст по теме, поясни термины, но не выдумывай несуществующие факты.\n"
    "5. ОФОРМЛЕНИЕ: Используй <blockquote> для важных мыслей или цитат. "
    "Используй только разрешенные теги: p, h3, b, i, ul, ol, li, blockquote.\n"
    "Никаких комментариев от себя, только чистый JSON-объект."
)

# def generate_news_json(html: str, url: str, target_lang: str = "ru") -> Dict[str, Any]:
#     """
#     Принимает HTML/текст и URL источника.
#     Возвращает: {title, lead, body_html, tags}
#     """
#     user = (
#         f"Сгенерируй новость на {target_lang}.\n"
#         f"Источник: {url}\n"
#         "Вход ниже (HTML/текст, можно использовать только релевантное):\n"
#         f"{(html or '')[:30000]}"
#     )

#     resp = client.chat.completions.create(
#         model=LLM_MODEL,
#         messages=[{"role":"system","content":SYSTEM_NEWS},
#                 {"role":"user","content":user}],
#         temperature=0.2,
#         max_tokens=1800,
#         response_format={"type":"json_object"},
#         extra_body={"format":"json"},
#     )
#     raw = resp.choices[0].message.content or "{}"
#     data = _json_loads_loose(raw)

#     out = {
#         "title": (data.get("title") or "").strip(),
#         "lead": (data.get("lead") or "").strip(),
#         "body_html": (data.get("body_html") or "").strip(),
#         "tags": data.get("tags") or [],
#     }
#     if isinstance(out["tags"], str):
#         out["tags"] = [t.strip() for t in out["tags"].split(",") if t.strip()]

#     if not out["body_html"]:
#         out["body_html"] = f"<p><a href=\"{url}\">Источник</a></p>"

#     print(1, out["body_html"])
#     return out

def generate_news_json(html: str, url: str, target_lang: str = "ru") -> Dict[str, Any]:
    """
    Принимает HTML/текст и URL источника.
    Возвращает: {title, lead, body_html, tags} через Gemini
    """
    
    # --- ДЕБАГ: Проверяем входные данные ---
    input_len = len(html or "")
    print(f"--- DEBUG START ---")
    print(f"DEBUG: URL источника: {url}")
    print(f"DEBUG: Длина входного HTML/текста: {input_len}")
    if input_len < 100:
        print(f"DEBUG WARNING: Входной текст подозрительно короткий! Проверьте экстрактор.")
    # ---------------------------------------

    # Формируем промпт для Gemini
    user_prompt = (
        f"{SYSTEM_NEWS}\n\n"
        f"ЗАДАНИЕ: Сгенерируй новость на языке: {target_lang}.\n"
        f"Источник (URL): {url}\n"
        "Входные данные (HTML/текст):\n"
        f"{(html or '')[:30000]}"
    )

    raw = "{}"
    try:
        # Вызов Gemini
        resp = model.generate_content(
            user_prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
                max_output_tokens=2048,
            ),
        )
        
        raw = resp.text or "{}"
        # --- ДЕБАГ: Что ответила нейросеть ---
        print(f"DEBUG: Сырой ответ от Gemini: {raw}")
        # --------------------------------------
        
    except Exception as e:
        print(f"Ошибка Gemini при генерации новости: {e}")
        raw = "{}"

    # Используем функцию парсинга
    data = _json_loads_loose(raw)
    
    # --- ДЕБАГ: Результат после парсинга JSON ---
    print(f"DEBUG: Распознанный JSON (keys): {list(data.keys())}")
    # --------------------------------------------

    out = {
        "title": (data.get("title") or "").strip(),
        "lead": (data.get("lead") or "").strip(),
        "body_html": (data.get("body_html") or "").strip(),
        "tags": data.get("tags") or [],
    }

    # Обработка тегов, если модель вернула их строкой
    if isinstance(out["tags"], str):
        out["tags"] = [t.strip() for t in out["tags"].split(",") if t.strip()]

    # Запасной вариант для тела статьи
    if not out["body_html"]:
        print("DEBUG ALERT: Поле body_html пустое! Применяется запасной вариант (только ссылка).")
        out["body_html"] = f"<p><a href=\"{url}\">Источник</a></p>"
    else:
        print(f"DEBUG: Успех! Длина сгенерированного контента: {len(out['body_html'])}")

    print(f"--- DEBUG END ---")
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
    "Ты — профессиональный корректор и литературный редактор. "
    "Твоя цель — сделать текст безупречным, сохраняя его информативность. "
    "Верни СТРОГИЙ JSON: { \"lead\": \"...\", \"body_html\": \"...\" }\n"
    "ВАЖНО: При улучшении (improve) или расширении (expand) не сокращай текст, "
    "наоборот, делай его более насыщенным и профессиональным."
)
# MODEL = LLM_MODEL
SYS_EDITOR = _ACTION_SYSTEM

# def prompt_action_json(
#     action: str,
#     title: str,
#     lead: str,
#     body_html: str,
#     target_lang: str = "ru",
# ) -> Dict[str, str]:
#     """
#     Выполняет действие над текстом (improve/shorten/expand/regenerate) и
#     возвращает словарь: {"lead": str, "body_html": str}
#     """
#     action = (action or "").lower().strip()
#     instruction = _ACTION_PROMPTS.get(action, _ACTION_PROMPTS["improve"])

#     user = (
#         f"ACTION: {action}\n"
#         f"TARGET_LANG: {target_lang}\n\n"
#         f"TITLE:\n{title or ''}\n\n"
#         f"LEAD:\n{lead or ''}\n\n"
#         "BODY_HTML:\n"
#         f"{(body_html or '')[:28000]}"
#     )

#     resp = client.chat.completions.create(
#         model=LLM_MODEL,
#         messages=[
#             {"role": "system", "content": _ACTION_SYSTEM},
#             {"role": "user", "content": instruction + "\n\n" + user},
#         ],
#         temperature=0.2,
#         max_tokens=2000,
#         response_format={"type": "json_object"},
#         extra_body={"format": "json"},
#     )
#     raw = resp.choices[0].message.content or "{}"
#     data = _json_loads_loose(raw)

#     out = {
#         "lead": (data.get("lead") or lead or "").strip(),
#         "body_html": (data.get("body_html") or body_html or "").strip(),
#     }
#     if not out["body_html"]:
#         out["body_html"] = (body_html or lead or title or "").strip() or "<p></p>"
#     return out

def prompt_action_json(
    action: str,
    title: str,
    lead: str,
    body_html: str,
    target_lang: str = "ru",
) -> Dict[str, str]:
    """
    Выполняет действие над текстом (improve/shorten/expand/regenerate) через Gemini
    и возвращает словарь: {"lead": str, "body_html": str}
    """
    action = (action or "").lower().strip()
    instruction = _ACTION_PROMPTS.get(action, _ACTION_PROMPTS["improve"])

    # Формируем единый промпт для Gemini
    user_query = (
        f"{_ACTION_SYSTEM}\n\n"
        f"ИНСТРУКЦИЯ: {instruction}\n\n"
        f"ACTION: {action}\n"
        f"TARGET_LANG: {target_lang}\n\n"
        f"TITLE:\n{title or ''}\n\n"
        f"LEAD:\n{lead or ''}\n\n"
        "BODY_HTML:\n"
        f"{(body_html or '')[:28000]}"
    )

    try:
        # Вызов Gemini API
        resp = model.generate_content(
            user_query,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
                max_output_tokens=2500,
            ),
        )
        raw = resp.text or "{}"
    except Exception as e:
        print(f"Ошибка Gemini в prompt_action_json: {e}")
        raw = "{}"

    # Используем вашу функцию _json_loads_loose (которую мы обновили под Gemini выше)
    data = _json_loads_loose(raw)

    out = {
        "lead": (data.get("lead") or lead or "").strip(),
        "body_html": (data.get("body_html") or body_html or "").strip(),
    }

    # Если вдруг тело пустое, возвращаем оригинал
    if not out["body_html"]:
        out["body_html"] = (body_html or lead or title or "").strip() or "<p></p>"

    return out

prompt_action = prompt_action_json
