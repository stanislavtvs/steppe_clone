import logging
from typing import Tuple
import feedparser

from celery import shared_task
from django.db import IntegrityError, transaction

from apps.pipeline.models import InboxItem
from apps.pipeline.urltools import normalize_url


from apps.sources.models import Source

logger = logging.getLogger(__name__)


def _get_rss_url(src: Source) -> str:
    """Безопасно достаём URL фида (rss или rss_url)."""
    return getattr(src, "rss", None) or getattr(src, "rss_url", "") or ""


def _join_content_from_entry(entry) -> str:
    """Склейка HTML-контента из записи feedparser."""
    html = ""
    if entry.get("content"):
        parts = []
        for c in entry.get("content", []):
            val = (c.get("value") or "").strip()
            if val:
                parts.append(val)
        html = "\n".join(parts)
    elif entry.get("summary"):
        html = entry.get("summary") or ""
    return html


def _lang_from_entry(entry, feed) -> str:
    return (entry.get("language")
            or getattr(feed.feed, "language", None)
            or getattr(feed, "language", None)
            or "ru")[:10]


def _create_or_update_inbox_item(src: Source, url: str, title: str,
                                 content_html: str, lang: str) -> Tuple[InboxItem, bool]:
    """
    Создаём InboxItem или обновляем, если уже есть.
    Возвращаем (объект, created).
    """
    nu = normalize_url(url)
    if not nu:
        raise ValueError("URL пустой после нормализации")

    defaults = {
        "source": src,
        "title": (title or "")[:300],
        "html": (content_html or "")[:200000],
        "lang": lang or "ru",
    }

    try:
        with transaction.atomic():
            obj, created = InboxItem.objects.get_or_create(url=nu, defaults=defaults)
            if not created:
                changed = False
                if not obj.title and defaults["title"]:
                    obj.title = defaults["title"]
                    changed = True
                if (content_html and
                        (not obj.html or len(content_html) > len(obj.html))):
                    obj.html = defaults["html"]
                    changed = True
                if changed:
                    obj.save(update_fields=["title", "html"])
            return obj, created
    except IntegrityError:
        obj = InboxItem.objects.filter(url=nu).first()
        return obj, False


@shared_task(name="apps.pipeline.tasks.harvest_sources")
def harvest_sources() -> int:
    """
    Проходит по всем включённым источникам и наполняет InboxItem.
    Возвращает число новых записей.
    """
    created_total = 0
    src_qs = Source.objects.filter(enabled=True).order_by("-priority", "id")

    for src in src_qs:
        rss = _get_rss_url(src)
        if not rss:
            continue

        try:
            feed = feedparser.parse(rss)
            if getattr(feed, "bozo", 0):
                logger.warning("feedparser bozo=%s for %s", feed.bozo, rss)

            for entry in feed.entries:
                url = entry.get("link") or entry.get("id")
                if not url:
                    continue

                title = entry.get("title", "") or ""
                content_html = _join_content_from_entry(entry)
                lang = _lang_from_entry(entry, feed)

                _, created = _create_or_update_inbox_item(
                    src=src,
                    url=url,
                    title=title,
                    content_html=content_html,
                    lang=lang,
                )
                if created:
                    created_total += 1

        except Exception as e:
            logger.exception("harvest_sources: source=%s rss=%s error=%s", src.id, rss, e)

    logger.info("harvest_sources: created=%s", created_total)
    return created_total
