## Проблема
CHECK `order_items_status_check` не содержит `received` и `returned` — подтверждение получения падает.

## Решение
Миграция: DROP + ADD ограничения со списком `new, confirmed, processing, shipped, delivered, received, returned, cancelled`.