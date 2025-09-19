from django.db import models
from django.utils import timezone

class InboxItem(models.Model):
    source = models.ForeignKey("sources.Source", on_delete=models.CASCADE)
    url = models.URLField(unique=True)
    title = models.CharField(max_length=300, blank=True)
    html = models.TextField()
    lang = models.CharField(max_length=10, default="en")
    created_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False)

class AIDraft(models.Model):
    url = models.URLField()
    title = models.CharField(max_length=200)
    lead = models.TextField(blank=True)
    body_html = models.TextField()
    tags = models.JSONField(default=list, blank=True)
    lang = models.CharField(max_length=10, default="ru")
    jsonld = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    quality = models.IntegerField(default=0)
    published = models.BooleanField(default=False)
    source_name = models.CharField(max_length=120, blank=True)
