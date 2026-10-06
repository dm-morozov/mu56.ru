"""Shared, deliberately restricted file handling for private deployment bundles."""
import hashlib
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile

from django.core.management.base import CommandError


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def safe_name(name):
    if not isinstance(name, str) or not name or "\\" in name or ":" in name:
        raise CommandError("Invalid media path.")
    parts = name.split("/")
    if any(part in {"", ".", ".."} for part in parts) or PurePosixPath(name).is_absolute():
        raise CommandError("Invalid media path.")
    return name


def media_path(root, name):
    safe_name(name)
    root = Path(root).resolve()
    path = root / name
    if not path.resolve().is_relative_to(root):
        raise CommandError("Media path escapes MEDIA_ROOT.")
    current = path
    while current != root:
        if current.is_symlink():
            raise CommandError("Symlinks are not supported in media bundles.")
        current = current.parent
    return path


def pack_media(target, root, names, *, fallback_root=None):
    checksums = {}
    with ZipFile(target, "x", ZIP_DEFLATED) as archive:
        for name in sorted(set(names)):
            source = media_path(root, name)
            if not source.is_file() and fallback_root is not None:
                source = media_path(fallback_root, name)
            if not source.is_file():
                raise CommandError(f"Referenced media is missing: {name}")
            checksums[name] = digest(source)
            archive.write(source, name)
    verify_media(target, checksums)
    return checksums


def verify_media(target, checksums):
    with ZipFile(target) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(set(names)) != len(names) or set(names) != set(checksums):
            raise CommandError("Media archive file list differs from manifest.")
        for entry in entries:
            safe_name(entry.filename)
            if entry.is_dir() or (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise CommandError("Unsupported media archive entry.")
            with archive.open(entry) as stream:
                actual = hashlib.file_digest(stream, "sha256").hexdigest()
            if actual != checksums[entry.filename]:
                raise CommandError("Media checksum mismatch.")
