from django.urls import path

from . import views

urlpatterns = [
    path("reviews/", views.ReviewList.as_view()),
    path("articles/", views.ArticleList.as_view()),
    path("articles/<slug:slug>/", views.ArticleDetail.as_view()),
    path("offerings/", views.OfferingList.as_view()),
    path("offerings/<slug:slug>/", views.OfferingDetail.as_view()),
    path("characters/", views.CharacterList.as_view()),
    path("characters/<slug:slug>/", views.CharacterDetail.as_view()),
    path("contacts/", views.ContactList.as_view()),
]
