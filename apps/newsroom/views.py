from django.shortcuts import render
from django.utils import timezone
from .models import Article

def article_list(request):
    qs = Article.objects.filter(draft=False).order_by("-published_at")[:20]
    return render(request, "newsroom/list.html", {"articles": qs})

def article_demo(request):
    article = {
        "title": "Демо-новость STEPPE",
        "lead": "Короткий лид-абзац для проверки типографики и сетки.",
        "cover_url": "",
        "cover_alt": "",
        "published_at": timezone.now(),
        "body_html": "<p>Это демонстрационная новость. Здесь будет основной текст с подзаголовками, цитатами и ссылками.</p>",
        "sources": [],
    }
    return render(request, "newsroom/article_detail.html", {"article": article})

def article_news(request, id):
    news = Article.objects.get(slug=id)
    return render(request,"newsroom/article_detail.html",{"news": news})