import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "steppe_clone.settings")
app = Celery("steppe_clone")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
