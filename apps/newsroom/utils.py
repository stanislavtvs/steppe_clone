import json
from django.utils.timezone import localtime

def build_news_jsonld(article):
    """
    Вернёт JSON-LD (NewsArticle) как строку JSON.
    Хранить в поле article.jsonld или выводить в шаблон.
    """
    data = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "datePublished": localtime(article.published_at).isoformat() if article.published_at else None,
        "dateModified": localtime(article.published_at).isoformat() if article.published_at else None,
        "author": {"@type": "Organization", "name": "STEPPE"},
        "image": [article.cover_url] if getattr(article, "cover_url", "") else [],
        "articleSection": getattr(article.category, "name", "Новости"),
        "publisher": {"@type": "Organization", "name": "STEPPE"},
    }
    return json.dumps(data, ensure_ascii=False)
