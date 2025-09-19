from django.urls import path
from . import views, api

urlpatterns = [
    path("", views.dashboard, name="studio_dashboard"),
    path("sources/", views.sources, name="studio_sources"),
    path("inbox/", views.inbox, name="studio_inbox"),
    path("drafts/", views.drafts, name="studio_drafts"),
    path("drafts/<int:pk>/", views.draft_edit, name="studio_draft_edit"),

    path("api/inbox/<int:pk>/generate/", api.generate_one, name="studio_generate_one"),
    path("api/draft/<int:pk>/action/", api.draft_action, name="studio_draft_action"),
    path("api/draft/<int:pk>/publish/", api.publish, name="studio_publish"),

    path("api/harvest-now/", api.harvest_now, name="studio_harvest_now"),
    path("api/generate-now/", api.generate_now, name="studio_generate_now"),
]
