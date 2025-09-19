from django.shortcuts import render
from apps.newsroom.models import Article

def home(request):
    qs = Article.objects.filter(draft=False).order_by("-published_at")[:20]
    return render(request, "newsroom/list.html", {"articles": qs})
