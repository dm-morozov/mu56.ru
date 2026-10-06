import json
from pathlib import Path

from django.core.management.base import BaseCommand
from catalog.backup_checks import check_latest_backup


class Command(BaseCommand):
    help = "Read-only check of the latest backup_site bundle, freshness and disk space."

    def add_arguments(self, parser):
        parser.add_argument("directory", type=Path)
        parser.add_argument("--max-age-hours", type=float, default=36)
        parser.add_argument("--min-free-gib", type=float, default=1)

    def handle(self, directory, max_age_hours, min_free_gib, **options):
        result = check_latest_backup(directory, max_age_hours=max_age_hours,
                                     min_free_gib=min_free_gib)
        self.stdout.write(json.dumps(result))
