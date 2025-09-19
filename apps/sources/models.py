from django.db import models

class Source(models.Model):
    name = models.CharField(max_length=120)
    rss_url = models.URLField()
    lang = models.CharField(max_length=10, default="en")
    priority = models.IntegerField(default=5)
    enabled = models.BooleanField(default=True)
    def __str__(self): return self.name
