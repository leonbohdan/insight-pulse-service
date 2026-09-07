# День 6: InsightPulse — MongoDB Aggregation Pipeline (Основи) та Docker для NoSQL

Сьогодні ми розпочинаємо мікропроєкт — **InsightPulse Reporting Engine**. Наша мета — розгорнути NoSQL базу даних MongoDB з вебпанеллю у Docker, опанувати конвеєр агрегацій (Aggregation Pipeline) та створити перший аналітичний модуль на базі NestJS і Mongoose.

---

## ⏱️ Розклад Дня 6 (6 годин)

| Блок | Тривалість | Тема | Опис |
| :--- | :--- | :--- | :--- |
| **Блок 1** | 1 год | Алгоритмічний розігрів (TS/JS) | Власний багатовимірний агрегатор масиву об'єктів з розрахунком метрик |
| **Блок 2** | 1.5 год | Інфраструктура (Docker) | Підняття кластера MongoDB 7.0 та вебінтерфейсу Mongo Express у мережі Docker |
| **Блок 3** | 2.5 год | Базовий Aggregation Pipeline | Створення аналітичного сервісу в NestJS: етапи `$match`, `$project`, `$group`, `$sort` |
| **Блок 4** | 1 год | Рев'ю та інтерв'ю-підготовка | Pipeline-модель обробки, пам'ять (`allowDiskUse`), індекси у пайплайнах |

---

## 🐳 Завдання 1: Docker-середовище для MongoDB

### Мета:
Створити ізольоване контейнеризоване середовище для NoSQL-бази даних аналітичного сервісу із збереженням даних та вебінтерфейсом.

### Кроки реалізації:
1. **Файл конфігурації `docker-compose.mongo.yml`:**
   Опиши два сервіси:
   - **`mongo_db`:**
     - Образ: `mongo:7.0`.
     - Змінні середовища: `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_INITDB_DATABASE` (через `.env`).
     - Порти: `27017:27017`.
     - Volumes: іменований том `mongo_analytics_data:/data/db`.
     - Healthcheck: перевірка працездатності за допомогою `mongosh` (`echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet`).
   - **`mongo_express`:**
     - Образ: `mongo-express:latest`.
     - Порти: `8081:8081`.
     - Змінні середовища: `ME_CONFIG_MONGODB_ADMINUSERNAME`, `ME_CONFIG_MONGODB_ADMINPASSWORD`, `ME_CONFIG_MONGODB_SERVER=mongo_db`.
     - Залежність: `depends_on` із `condition: service_healthy` від `mongo_db`.
   - **Мережа:** кастомна bridge-мережа `analytics_network`.
2. **Запуск та верифікація:**
   - Запусти стек: `docker compose -f docker-compose.mongo.yml up -d`.
   - Перевір статус `healthy` для контейнера `mongo_db`.
   - Відкрий у браузері інтерфейс Mongo Express (`http://localhost:8081`) та переконайся у підключенні до бази `insight_pulse`.

---

## 🍃 Завдання 2: Базовий Aggregation Pipeline у NestJS

### Мета:
Створити NestJS мікросервіс `insight-pulse-service`, описати схему документів Mongoose з індексами та реалізувати звітний конвеєр агрегації.

### Кроки реалізації:
1. **Ініціалізація модуля:**
   - Встанови необхідні пакети:
     ```bash
     npm i @nestjs/mongoose mongoose class-validator class-transformer
     ```
   - Налаштуй підключення `MongooseModule.forRoot()` через змінні середовища.
2. **Схема документа `OrderAnalytics`:**
   Створи файл `order-analytics.schema.ts`:
   - Поля:
     - `orderId`: string (UUID), унікальний.
     - `customerId`: string, індексований.
     - `category`: string, індексований.
     - `totalPrice`: number.
     - `itemsCount`: number.
     - `status`: enum (`'COMPLETED' | 'REFUNDED' | 'CANCELLED'`).
     - `orderedAt`: Date, індексований.
   - Створи складений індекс `{ status: 1, orderedAt: -1 }` для оптимізації вибірки замовлень за період.
3. **Скрипт Seeding:**
   - Напиши метод для генерації 10,000 тестових замовлень за останні 60 днів з категоріями (`Tech`, `Home`, `Fashion`, `Auto`).
4. **Конвеєр агрегації в `AnalyticsService`:**
   Реалізуй метод `getCategoryRevenueReport(startDate: Date, endDate: Date)`:
   - **Етап 1 (`$match`):** Фільтрація документів зі статусом `COMPLETED` у діапазоні дат `orderedAt: { $gte: startDate, $lte: endDate }`.
   - **Етап 2 (`$project`):** Відбір необхідних полів для обробки.
   - **Етап 3 (`$group`):**
     - `_id: '$category'`
     - `totalRevenue: { $sum: '$totalPrice' }`
     - `totalOrders: { $sum: 1 }`
     - `totalItems: { $sum: '$itemsCount' }`
     - `averageOrderValue: { $avg: '$totalPrice' }`
   - **Етап 4 (`$project`):** Форматування вихідних даних (перейменування `_id` на `category`, округлення `averageOrderValue` до 2 знаків за допомогою `$round`).
   - **Етап 5 (`$sort`):** Сортування результатів за спаданням `totalRevenue: -1`.
5. **Ендпоінт:**
   - Створи `AnalyticsController` з маршрутом `GET /analytics/categories` та валідацією вхідних query-параметрів через `DateRangeDto`.
