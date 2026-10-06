from datetime import time

SLOTS = {"eve-18": (12, 31, 18), "eve-20": (12, 31, 20), "eve-22": (12, 31, 22), "night-00": (1, 1, 0), "night-02": (1, 1, 2)}


def schedule_error(code, date, start):
    if code in SLOTS:
        month, day, hour = SLOTS[code]
        if not date or not start or (date.month, date.day) != (month, day) or start != time(hour):
            return "Для вечернего тарифа укажите соответствующую дату и точное время начала по Оренбургу."
    elif date and ((date.month, date.day) == (12, 31) and (not start or start >= time(18)) or (date.month, date.day) == (1, 1) and (not start or start < time(4))):
        return "Уточните время: вечером 31 декабря и до 04:00 1 января доступна только сказка на 50 минут по отдельному тарифу."
    if date and start and (date.month, date.day) == (1, 1) and time(3) <= start <= time(4):
        return "Последнее начало новогодней ночи — 02:00. Другое время согласуйте с нами."
    return None
