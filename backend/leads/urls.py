from django.urls import path

from . import views

urlpatterns = [path("csrf/", views.csrf_token), path("leads/", views.LeadCreate.as_view()), path("transformer-quote/", views.quote_transformer)]
