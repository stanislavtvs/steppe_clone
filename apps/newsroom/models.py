from django.db import models
from django.utils import timezone
from django.utils.text import slugify

class Category(models.Model):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name

class Article(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True)
    lead = models.TextField(blank=True)
    body_html = models.TextField()
    jsonld = models.TextField(blank=True)
    cover_url = models.URLField(blank=True)
    cover_alt = models.CharField(max_length=160, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    published_at = models.DateTimeField(default=timezone.now)
    draft = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
