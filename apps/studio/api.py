from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required, user_passes_test
from apps.pipeline.extract import fetch_main_html
from django.contrib import messages
from django.utils import timezone
from apps.pipeline.urltools import normalize_url

from apps.pipeline.models import InboxItem, AIDraft
from apps.newsroom.models import Article
from apps.pipeline.llm import (
    client,
    generate_news_json,
    prompt_action_json,
    _coerce_json,
    SYS_EDITOR,
    MODEL,
)

def staff_required(view):
    return user_passes_test(lambda u: u.is_staff)(view)

@login_required
@staff_required
@require_POST
def generate_one(request, pk):
    """
    Генерация одного AI-черновика по записи из Инбокса:
      - нормализуем URL (убираем мусорные query);
      - если у RSS был текст — используем его; иначе подкачиваем HTML со страницы
        (обычная, AMP, r.jina.ai);
      - вызываем LLM (generate_news_json) и сохраняем черновик;
      - помечаем InboxItem.processed = True.
    """
    ib = get_object_or_404(InboxItem, pk=pk, processed=False)

    norm = normalize_url(ib.url or "")
    work_url = ib.url
    if norm and norm != ib.url:
        dup = InboxItem.objects.filter(url=norm).exclude(pk=ib.pk).first()
        if dup:
            if ib.html and (not dup.html or len(dup.html) < len(ib.html)):
                dup.html = ib.html
                dup.save(update_fields=["html"])
            ib.processed = True
            ib.save(update_fields=["processed"])
            ib = dup
        else:
            ib.url = norm
            ib.save(update_fields=["url"])
        work_url = ib.url

    if not ib.html or len(ib.html) < 200:
        try:
            fetched = fetch_main_html(work_url)
            if fetched and len(fetched) >= 200:
                ib.html = fetched
                ib.save(update_fields=["html"])
        except Exception:
            pass

    html = (ib.html or "").strip()
    if not html:
        html = f"<p>{(ib.title or '').strip()}</p><p><a href='{work_url}'>Источник</a></p>"

    try:
        data = generate_news_json(html, work_url, target_lang="ru")

        bad_titles = {"news article", "article", "untitled"}
        title = (data.get("title") or "").strip() or (ib.title or "Черновик")
        if title.lower() in bad_titles:
            title = (ib.title or "Черновик")

        draft = AIDraft.objects.create(
            url=work_url,
            title=title[:200],
            lead=data.get("lead", ""),
            body_html=data.get("body_html", ""),
            tags=data.get("tags", []),
            lang="ru",
            source_name=ib.source.name if ib.source_id else "",
        )
        ib.processed = True
        ib.save(update_fields=["processed"])
        print(2, "created draft", draft.body_html)
        return redirect("studio_draft_edit", pk=draft.pk)

    except Exception as e:
        draft = AIDraft.objects.create(
            url=work_url,
            title=(ib.title or "Черновик")[:200],
            lead="",
            body_html=f"<p>Не удалось сгенерировать: {e}</p>",
            tags=[],
            lang="ru",
            source_name=ib.source.name if ib.source_id else "",
        )
        ib.processed = True
        ib.save(update_fields=["processed"])
        messages.error(
            request,
            "LLM: проверь локальную модель/endpoint или подтяни модель в Ollama."
        )
        return redirect("studio_draft_edit", pk=draft.pk)

@login_required
@staff_required
@require_POST
def draft_action(request, pk):
    """Improve / Shorten / Expand / Regenerate — тоже через JSON."""
    it = get_object_or_404(AIDraft, pk=pk, published=False)
    action = request.POST.get("action")
    lang = request.POST.get("lang", it.lang or "ru")

    prompt = prompt_action_json(action, it.title or "", it.lead or "", it.body_html or "", lang=lang)
    out = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": SYS_EDITOR},
                  {"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1200,
    ).choices[0].message.content

    try:
        data = _coerce_json(out)
        it.title = (data.get("title") or it.title)[:200]
        it.lead = data.get("lead", it.lead)
        it.body_html = data.get("body_html", it.body_html)
        if data.get("tags"):
            it.tags = data["tags"]
        it.lang = lang
        it.save()
        return JsonResponse({"ok": True})
    except Exception:
        return JsonResponse({"ok": False, "error": "LLM вернул не-JSON"}, status=400)


@login_required
@staff_required
@require_POST
def publish(request, pk):
    """Публикация черновика в Article."""
    it = get_object_or_404(AIDraft, pk=pk, published=False)
    art = Article.objects.create(
        title=it.title, lead=it.lead, body_html=it.body_html,
        cover_url="", cover_alt="",slug=it.id,
        published_at=timezone.now(), draft=False,
    )
    try:
        from apps.newsroom.utils import build_news_jsonld
        art.jsonld = build_news_jsonld(art)
        art.save()
    except Exception:
        pass
    it.published = True
    it.save()
    return JsonResponse({"ok": True, "article_id": art.id})


@login_required
@staff_required
@require_POST
def harvest_now(request):
    from apps.pipeline.tasks import harvest_sources
    try:
        harvest_sources.delay()
    except Exception:
        harvest_sources()
    return redirect("studio_inbox")


@login_required
@staff_required
@require_POST
def generate_now(request):
    pass
