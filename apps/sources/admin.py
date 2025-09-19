from django.contrib import admin
from .models import Source

@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ("name", "rss_url", "lang", "priority", "enabled")
    list_filter = ("lang", "enabled")
    search_fields = ("name", "rss_url")
    ordering = ("-enabled", "priority", "name")
    list_editable = ("priority", "enabled")

    fieldsets = (
        (None, {"fields": ("name", "rss_url")}),
        ("Настройки", {"fields": ("lang", "priority", "enabled")}),
    )