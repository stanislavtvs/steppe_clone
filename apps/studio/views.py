from django.contrib.auth.decorators import login_required, user_passes_test
from django.shortcuts import render, redirect, get_object_or_404
from apps.sources.models import Source
from apps.pipeline.models import InboxItem, AIDraft

staff_required = user_passes_test(lambda u: u.is_active and u.is_staff)

@login_required
@staff_required
def dashboard(request):
    ctx = {
        "sources_count": Source.objects.count(),
        "inbox_count": InboxItem.objects.filter(processed=False).count(),
        "drafts_count": AIDraft.objects.filter(published=False).count(),
    }
    return render(request, "studio/dashboard.html", ctx)

@login_required
@staff_required
def sources(request):
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        rss = request.POST.get("rss_url", "").strip()
        lang = request.POST.get("lang", "ru").strip()
        prio = int(request.POST.get("priority", 5) or 5)
        en = request.POST.get("enabled") == "on"
        if name and rss:
            Source.objects.create(name=name, rss_url=rss, lang=lang, priority=prio, enabled=en)
        return redirect("studio_sources")
    items = Source.objects.order_by("-enabled", "-priority", "name")
    return render(request, "studio/sources.html", {"items": items})

@login_required
@staff_required
def inbox(request):
    qs = InboxItem.objects.filter(processed=False).order_by("-id")[:100]
    return render(request, "studio/inbox.html", {"items": qs})

@login_required
@staff_required
def drafts(request):
    qs = AIDraft.objects.filter(published=False).order_by("-updated_at")[:100]
    return render(request, "studio/drafts.html", {"items": qs})

@login_required
@staff_required
def draft_edit(request, pk):
    it = get_object_or_404(AIDraft, pk=pk)
    if request.method == "POST":
        it.title = request.POST.get("title", it.title)
        it.lead = request.POST.get("lead", it.lead)
        it.body_html = request.POST.get("body_html", it.body_html)
        it.lang = request.POST.get("lang", it.lang)
        it.save()
        return redirect("studio_draft_edit", pk=it.pk)
    return render(request, "studio/draft_edit.html", {"it": it})
