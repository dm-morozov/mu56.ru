"""Add a reviewed image bundle to existing galleries; dry-run unless --apply.

Run with the application's environment. Originals and descriptions are never
overwritten. The bundle must be prepared and visually reviewed beforehand.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    root = args.bundle.resolve()
    backend = Path(os.environ.get('MU56_BACKEND_DIR', Path(__file__).resolve().parents[1] / 'backend'))
    sys.path.insert(0, str(backend))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    import django
    django.setup()
    from django.core.files import File
    from django.db import transaction
    from catalog.models import Character, CharacterPhoto

    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    items = manifest['photos']
    characters = {c.slug: c for c in Character.objects.filter(slug__in={i['slug'] for i in items})}
    keys = set()
    for item in items:
        character = characters.get(item['slug'])
        if not character or not character.is_listed:
            raise ValueError('Missing or unlisted character: ' + item['slug'])
        path = (root / item['file']).resolve()
        if not path.is_relative_to(root) or path.suffix != '.webp':
            raise ValueError('Invalid image path')
        if hashlib.sha256(path.read_bytes()).hexdigest() != item['output_sha256']:
            raise ValueError('Image hash mismatch: ' + item['file'])
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            if image.format != 'WEBP' or max(image.size) > 1800 or image.getexif():
                raise ValueError('Image is not a prepared public copy')
        if not item['alt'] or len(item['alt']) > 250 or len(item['source_key']) > 500:
            raise ValueError('Invalid photo metadata')
        if item['source_key'] in keys:
            raise ValueError('Duplicate source key in bundle')
        keys.add(item['source_key'])

    report = {'applied': args.apply, 'created': [], 'skipped': [], 'before': {}, 'after': {}}
    created_files = []
    try:
        with transaction.atomic():
            for slug in sorted(characters):
                character = Character.objects.select_for_update().get(pk=characters[slug].pk)
                existing = list(character.photos.all())
                report['before'][slug] = sum(p.is_listed for p in existing)
                existing_keys = {p.source_key for p in existing}
                existing_hashes = set()
                for photo in existing:
                    if photo.image and photo.image.storage.exists(photo.image.name):
                        with photo.image.open('rb') as handle:
                            existing_hashes.add(hashlib.file_digest(handle, 'sha256').hexdigest())
                position = max((p.position for p in existing), default=-1) + 1
                added = 0
                for item in (i for i in items if i['slug'] == slug):
                    if item['source_key'] in existing_keys or item['original_sha256'] in existing_hashes or item['output_sha256'] in existing_hashes:
                        report['skipped'].append({'slug': slug, 'source_key': item['source_key'], 'reason': 'already-present'})
                        continue
                    if args.apply:
                        photo = CharacterPhoto(character=character, alt=item['alt'], position=position, source_key=item['source_key'])
                        with (root / item['file']).open('rb') as handle:
                            photo.image.save(Path(item['file']).name, File(handle), save=False)
                        created_files.append((photo.image.storage, photo.image.name))
                        photo.full_clean()
                        photo.save(force_insert=True)
                    report['created'].append({'slug': slug, 'source_key': item['source_key'], 'position': position})
                    position += 1
                    added += 1
                    existing_hashes.add(item['output_sha256'])
                report['after'][slug] = report['before'][slug] + added
    except Exception:
        for storage, name in created_files:
            storage.delete(name)
        raise
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'applied': args.apply, 'added': len(report['created']), 'skipped': len(report['skipped']), 'galleries': report['after']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
