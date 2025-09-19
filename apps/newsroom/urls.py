from django.urls import path
from .views import article_demo, article_list, article_news

urlpatterns = [
    path("", article_list, name="news_list"),
    path("<str:id>/", article_news, name="article_news"),
]
