from datetime import date, time
from django.test import SimpleTestCase
from catalog.new_year import schedule_error


class NewYearScheduleTests(SimpleTestCase):
    def test_exact_evening_slots(self):
        for code, day, hour in [("eve-18", date(2026, 12, 31), 18), ("eve-20", date(2026, 12, 31), 20), ("eve-22", date(2026, 12, 31), 22), ("night-00", date(2027, 1, 1), 0), ("night-02", date(2027, 1, 1), 2)]:
            with self.subTest(code=code):
                self.assertIsNone(schedule_error(code, day, time(hour)))
                self.assertTrue(schedule_error(code, day, time(hour, 15)))
                self.assertTrue(schedule_error(code, None, time(hour)))
                self.assertTrue(schedule_error("minutes-15", day, time(hour)))
                self.assertTrue(schedule_error("minutes-50", day, time(hour)))
                self.assertTrue(schedule_error("group-with-sound", day, time(hour)))

    def test_daytime_and_last_start(self):
        self.assertIsNone(schedule_error("minutes-50", date(2026, 12, 31), time(17)))
        self.assertIsNone(schedule_error("minutes-30", date(2026, 12, 30), time(20)))
        self.assertTrue(schedule_error("minutes-50", date(2027, 1, 1), time(4)))
        self.assertTrue(schedule_error("minutes-50", date(2026, 12, 31), None))
