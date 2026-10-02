"""Copy selected originals unchanged. Compression is a separate future step."""
from pathlib import Path
import shutil
import hashlib
import json
from gallery_sources import GALLERY_FOLDERS

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Дополнительные фото для сайта"
DEST = ROOT / "frontend/public/media"
CHAR_DIR = next(p for p in SOURCE.iterdir() if p.is_dir() and p.name.startswith("Персонажи на"))
CHARACTERS = {
    "nolik": "1. Фиксик.png", "mcqueen": "2. Молния Маквин.png", "clown-kesha": "3. клоун.png",
    "chase": "4. Гонщик.png", "prince": "5. Принц.png", "hatter": "6. Шляпник.png",
    "kutamba": "7. Индеец.png", "ninja-turtle": "8. Черепашка-Ниндзя.png", "deadpool": "9. ДэдПул.png",
    "james-bond": "10. Джеймс Бонд.png", "captain-america": "11. Капитан Америка.png",
    "black-spider-man": "12. Человек-Паук Черный.png", "cat-noir": "14. Супер Кот.png",
    "luke-skywalker": "15. Джедай.png", "harry-potter": "16. Гарри Поттер.png",
    "hawaiian": "17. Гавайская.png", "jack-sparrow": "18. пират.png", "alice": "21. Алиса.png",
    "korzhik": "22.1. Коржик.png", "karamelka": "22. Коржик и Карамелька.png",
    "ladybug": "23. леди баг.png", "football": "24. Футболист.png", "aladdin": "25. Алладин.png",
    "batman": "26. Бэтмен.png", "superman": "27. СуперМен.png", "spider-man": "29. Человек Паук.png",
    "among-us": "30. Among Us.png", "leon": "31. BrawlStars.png", "tiktok": "32. TikTok.png",
    "creeper": "33. МайнКрафт.png", "new-year-duo": "20. Дед Мороз и Снегурочка.png",
}

def copy(source, relative):
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)

for slug, filename in CHARACTERS.items():
    copy(CHAR_DIR / filename, f"characters/{slug}.png")
for folder, name, target in [
    ("Бамблби", "bumblebee-with-children.jpg", "bumblebee-live.jpg"),
    ("Бамблби", "bumblebee-captain-america-party.jpg", "bumblebee-party.jpg"),
    ("Оптимус Прайм", "optimus-prime-spider-man-show.png", "optimus.png"),
    ("Железный человек", "iron-man-superman-studio.png", "iron-man.png"),
]:
    copy(SOURCE / "трансформеры" / folder / name, target)
for filename, target in [("BC15-554.jpg", "party-colour.jpg"), ("DSC_0151(1).jpg", "party-games.jpg"), ("13.jpg", "hatter-live.jpg"), ("3.jpg", "party-friends.jpg")]:
    copy(SOURCE / "фото подборка для общей галареи" / filename, target)
copy(SOURCE / "logo" / "5.5.png", "logo.png")
copy(SOURCE / "logo" / "logo_no_name.svg", "logo-kite.svg")

gallery = {}
for slug, folder in GALLERY_FOLDERS.items():
    photos, hashes = [], set()
    for source in sorted((ROOT / "scraper/data/characters" / folder).glob("*.jpg")):
        # This photo shows lifting a child by the head; it is not suitable for publication.
        if slug == "deadpool" and source.name == "slider_photo_2.jpg":
            continue
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if digest in hashes:
            continue
        hashes.add(digest)
        relative = f"gallery/{slug}/{len(photos) + 1}.jpg"
        copy(source, relative)
        photos.append(f"/media/{relative}")
        if len(photos) == (1 if slug == "deadpool" else 2):
            break
    if photos:
        gallery[slug] = photos
gallery["bumblebee"] = ["/media/bumblebee-live.jpg", "/media/bumblebee-party.jpg"]
gallery["optimus-prime"] = ["/media/optimus.png"]
gallery["iron-man"] = ["/media/iron-man.png"]
(ROOT / "frontend/src/lib/character-gallery.json").write_text(json.dumps(gallery, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Copied {len(CHARACTERS) + 9} original assets; source files unchanged.")
