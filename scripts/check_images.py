import json
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from PIL import Image

root = Path(__file__).resolve().parents[1]
report = []
for source, width in [("/media/characters/spider-man.png", 384), ("/media/bumblebee-live.jpg", 750), ("/media/optimus.png", 750)]:
    original = root / "frontend/public" / source.lstrip("/")
    url = "http://127.0.0.1:3000/_next/image?" + urlencode({"url":source,"w":width,"q":75})
    with urlopen(Request(url, headers={"Accept":"image/webp"}), timeout=45) as response:
        data = response.read()
        assert response.headers.get("Content-Type") == "image/webp"
    image = Image.open(BytesIO(data))
    assert image.width <= width
    if source.endswith("spider-man.png"):
        assert "A" in image.getbands(), "Transparent background was lost"
    assert len(data) < original.stat().st_size
    report.append({"source":source,"original_bytes":original.stat().st_size,"served_bytes":len(data),"width":image.width,"reduction_percent":round(100*(1-len(data)/original.stat().st_size),2)})
characters = json.loads(urlopen("http://127.0.0.1:8000/api/v1/characters/spider-man/").read())
photo = characters["photos"][0]["url"]
url = "http://127.0.0.1:3000/_next/image?" + urlencode({"url":photo,"w":750,"q":75})
with urlopen(Request(url, headers={"Accept":"image/webp"}), timeout=45) as response:
    assert response.headers.get("Content-Type") == "image/webp"
    assert Image.open(BytesIO(response.read())).width <= 750
(root / "docs/image-check.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))
