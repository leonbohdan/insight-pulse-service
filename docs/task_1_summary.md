# 📋 Підсумок виконання: День 6 (Завдання 1 та Завдання 2)

## 📌 Загальний огляд
У рамках мікропроєкту **InsightPulse Reporting Engine** було успішно розгорнуто контейнеризоване середовище NoSQL бази даних MongoDB 7.0 та створено аналітичний сервіс на базі **NestJS (v12, ESM)** і **Mongoose ODM** для побудови оптимізованих звітів через **MongoDB Aggregation Pipeline**.

---

## 🐳 Завдання 1: Docker-середовище для MongoDB

### Що реалізовано:
1. **Конфігурація `docker-compose.yml`**:
   - **`mongo_db`**:
     - Образ: `mongo:7.0`.
     - Порт: `27017:27017`.
     - Іменований том: `mongo_analytics_data:/data/db` для персистентного зберігання даних рушієм WiredTiger.
     - Healthcheck: автоматична перевірка доступності за допомогою `mongosh` (`echo 'db.runCommand("ping").ok'`).
     - Змінні середовища: `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_INITDB_DATABASE` (підтягуються з `.env`).
   - **`mongo_express`**:
     - Образ: `mongo-express:latest`.
     - Порт: `8081:8081`.
     - Залежність `depends_on` із `condition: service_healthy` від сервісу `mongo_db`.
     - Відокремлено змінні підключення до MongoDB (`ME_CONFIG_MONGODB_ADMIN...`) від облікових даних входу у веб-панель (`ME_CONFIG_BASICAUTH_...`).
   - **Мережа**: спільна кастомна bridge-мережа `analytics_network`.

### Результати верифікації:
- Контейнер `mongo_db` стабільно переходить у статус `healthy`.
- Веб-панель Mongo Express доступна за адресою `http://localhost:8081` і підключається до бази `insight_pulse_db`.
- Налаштовано підключення через MongoDB Compass за рядком:
  `mongodb://admin:secretpassword@localhost:27017/insight_pulse_db?authSource=admin`.

---

## 🍃 Завдання 2: Базовий Aggregation Pipeline у NestJS

### Що реалізовано:

1. **Ініціалізація та модульна архітектура**:
   - Розгорнуто NestJS застосунок із підтримкою сучасних стандартів **ES Modules (`"type": "module"`)** та швидким тестовим фреймворком **Vitest**.
   - Підключено `@nestjs/config` для централізованого завантаження конфігурації.
   - Асинхронно налаштовано `MongooseModule.forRootAsync(...)` в `AppModule`.
   - Створено ізольований `AnalyticsModule` (`schemas/`, `dto/`, `analytics.service.ts`, `analytics.controller.ts`).

2. **Схема документа `OrderAnalytics` та індексація**:
   - Описано поля документа з використанням безпечного патерну `as const`:
     - `orderId`: string (UUID, унікальний індекс).
     - `customerId`: string (індексований).
     - `category`: string (індексований).
     - `totalPrice`: number.
     - `itemsCount`: number.
     - `status`: enum `'COMPLETED' | 'REFUNDED' | 'CANCELLED'`.
     - `orderedAt`: Date (індексований).
   - **Складений індекс (Compound Index)**:
     ```typescript
     OrderAnalyticsSchema.index({ status: 1, orderedAt: -1 });
     ```
     > **Правило ESR (Equality, Sort, Range)**: забезпечує миттєву вибірку записів зі статусом `COMPLETED` у діапазоні дат без повного перебору колекції (`COLLSCAN`).

3. **Скрипт Seeding та керування даними**:
   - Реалізовано метод `seedOrders(count = 10000)`:
     - Генерація категорій (`Tech`, `Home`, `Fashion`, `Auto`).
     - Ймовірнісний розподіл статусів: ~70% `COMPLETED`, 15% `CANCELLED`, 15% `REFUNDED`.
     - Випадкові дати за останні 60 днів.
     - Оптимізована пакетна вставка через `insertMany`, що займає менше 1 секунди на 10,000 записів.
   - Додано метод `deleteOrders()` для швидкого скидання даних перед тестуванням.

4. **Конвеєр агрегацій (`AnalyticsService.getCategoryRevenueReport`)**:
   Послідовно реалізовано 5 етапів Aggregation Pipeline:
   - **Етап 1 (`$match`)**: Фільтрація документів за статусом `COMPLETED` та діапазоном дат `orderedAt: { $gte: startDate, $lte: endDate }` (використовує складений індекс).
   - **Етап 2 (`$project`)**: Відбір лише релевантних полів для зменшення навантаження на пам'ять наступних етапів.
   - **Етап 3 (`$group`)**:
     - `_id: '$category'`
     - `totalRevenue: { $sum: '$totalPrice' }`
     - `totalOrders: { $sum: 1 }`
     - `totalItems: { $sum: '$itemsCount' }`
     - `averageOrderValue: { $avg: '$totalPrice' }`
   - **Етап 4 (`$project`)**: Реструктуризація виводу (перейменування `_id` в `category`, математичне округлення середнього чека до 2 знаків: `{ $round: ['$averageOrderValue', 2] }`).
   - **Етап 5 (`$sort`)**: Сортування результатів за виручкою від найбільшої до найменшої (`totalRevenue: -1`).

5. **Контролер та валідація DTO**:
   - `GET /analytics/categories?startDate=...&endDate=...`:
     - Валідація вхідних параметрів за допомогою `DateRangeDto` (`@IsNotEmpty()`, `@IsDate()`, `@Type(() => Date)`).
     - Глобальне перетворення рядків дати на об'єкти `Date` через `ValidationPipe({ transform: true, whitelist: true })`.
   - `POST /analytics/seed?count=10000`: генерація тестової вибірки.
   - `DELETE /analytics/delete`: очищення колекції.

---

## 🧪 Результати тестування

### 1. Тест вибірки даних (Seeding)
Після виклику `POST /analytics/seed?count=10000`:
- `COMPLETED`: 6,986 (~70%)
- `CANCELLED`: 1,519 (~15%)
- `REFUNDED`: 1,495 (~15%)
- **Разом**: 10,000 документів.

### 2. Тест звіту агрегації
Запит `GET /analytics/categories?startDate=2026-07-01T00:00:00.000Z&endDate=2026-09-08T23:59:59.999Z`:
```json
[
  {
    "category": "Tech",
    "totalRevenue": 915877,
    "totalOrders": 1788,
    "totalItems": 10101,
    "averageOrderValue": 512.24
  },
  {
    "category": "Fashion",
    "totalRevenue": 872872,
    "totalOrders": 1764,
    "totalItems": 9907,
    "averageOrderValue": 494.83
  },
  {
    "category": "Auto",
    "totalRevenue": 871295,
    "totalOrders": 1707,
    "totalItems": 9365,
    "averageOrderValue": 510.42
  },
  {
    "category": "Home",
    "totalRevenue": 854991,
    "totalOrders": 1727,
    "totalItems": 9489,
    "averageOrderValue": 495.07
  }
]
```
*Підсумок замовлень у звіті:* `1788 + 1764 + 1707 + 1727 = 6986`. Пайплайн точно обробив 100% замовлень зі статусом `COMPLETED` і проігнорував незавершені замовлення.

---

## 🎓 Інтерв'ю-підготовка: Ключові концепції MongoDB Aggregation

1. **Pipeline-модель обробки даних:**
   Документи проходять крізь конвеєр послідовно від етапу до етапу, подібно до потоку (Stream) або Unix-пайпів (`|`). Результат попереднього етапу є входом для наступного.

2. **Обмеження оперативної пам'яті (RAM Limit) та `allowDiskUse`:**
   - За замовчуванням кожен окремий етап агрегації (особливо `$group` та `$sort`) обмежений **100 MB RAM**.
   - Якщо обсяг даних на етапі перевищує 100 MB, MongoDB повертає помилку `QueryExceededMemoryLimitNoDiskUseAllowed`.
   - Для подолання цього використовується прапорець:
     ```typescript
     this.orderAnalyticsModel.aggregate([...]).allowDiskUse(true);
     ```
     Це дозволяє MongoDB скидати проміжні результати на диск (у тимчасові файли `_tmp`), що запобігає падінню запиту, хоча й дещо знижує швидкість через дискові I/O операції.

3. **Використання індексів у конвеєрі:**
   - Індекси можуть використовуватися **лише на початку конвеєра** (етапи `$match` та `$sort`).
   - Як тільки конвеєр доходить до `$project`, `$group` або `$unwind`, структура документів змінюється, і на наступних етапах MongoDB вже не може використовувати індекси вихідної колекції.
   - Саме тому `$match` завжди ставиться **першим** етапом.

4. **Проєкція перед групуванням:**
   Використання `$project` перед `$group` відкидає зайві важкі поля документа (наприклад, текстові описи, великі масиви), залишаючи лише ті, що беруть участь у групуванні, що значно знижує використання пам'яті всередині ліміту 100 MB.
