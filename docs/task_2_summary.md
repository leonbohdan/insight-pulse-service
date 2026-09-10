# 📋 Підсумок виконання: День 7 (Завдання 1 та Завдання 2)

## 📌 Загальний огляд
У рамках другого дня роботи з **InsightPulse Reporting Engine** було реалізовано просунуті можливості **MongoDB Aggregation Pipeline** у середовищі **NestJS** та **Mongoose ODM**:
1. **Реляційні джоїни у NoSQL**: об'єднання колекцій за допомогою оператора `$lookup` (простого equality match та корельованого підзапиту з вкладеним конвеєром) і деконструкція масивів оператором `$unwind`.
2. **Багатовимірна фасетна аналітика**: побудова комплексного бізнес-дашборду за **один запит до бази даних** за допомогою операторів `$facet` та `$bucket`.

---

## 🔗 Завдання 1: Реляційні джоїни у NoSQL ($lookup та $unwind)

### Що реалізовано:

1. **Створення зв'язаних схем та сутностей**:
   - **`Customer`** (`src/analytics/schemas/customer.schema.ts`):
     - `_id`: string (UUID, унікальний).
     - `name`: string (індексований).
     - `email`: string (унікальний, regex-валідація).
     - `tier`: enum `'BRONZE' | 'SILVER' | 'GOLD'`.
   - **`Product`** (`src/analytics/schemas/product.schema.ts`):
     - `_id`: string (UUID, унікальний).
     - `sku`: string (унікальний).
     - `title`: string (індексований).
     - `costPrice`: number (собівартість для розрахунку маржинальності).
   - **Розширення `OrderAnalytics`** (`src/analytics/schemas/order-analytics.schema.ts`):
     - Додано поле `items`:
       ```typescript
       items: {
         productId: string;
         quantity: number;
         price: number;
       }[];
       ```

2. **Оновлений скрипт Seeding (`seedOrders`)**:
   - Автоматично створює 100 клієнтів із випадковими рівнями лояльності.
   - Генерує 50 товарів із собівартістю `costPrice` та унікальними артикулами `sku`.
   - Створює замовлення, які посилаються на реальні `customerId` та містять від 1 до 4 реальних товарів із розрахованими цінами з націнкою (`unitPrice`) та сумарним підрахунком `totalPrice` і `itemsCount`.

3. **Простий `$lookup` (Equality Match) — `getOrderDetailsWithCustomer`**:
   - **Мета**: збагатити дані замовлення інформацією про покупця.
   - **Реалізація**:
     ```typescript
     {
       $lookup: {
         from: this.customerModel.collection.name, // 'customers'
         localField: 'customerId',
         foreignField: '_id',
         as: 'customer',
       }
     },
     {
       $unwind: {
         path: '$customer',
         preserveNullAndEmptyArrays: true,
       }
     }
     ```
   - **Особливість**: опція `preserveNullAndEmptyArrays: true` гарантує, що замовлення не буде видалено з вибірки, якщо відповідний профіль клієнта було видалено з бази.
   - У разі відсутності самого замовлення викидається стандартний `NotFoundException` (404).
   - **Ендпоінт**: `GET /analytics/orders/:orderId`.

4. **Корельований `$lookup` із розрахунком чистого прибутку — `getTopOrdersWithMargin`**:
   - **Мета**: обрахувати чистий прибуток ($Margin = TotalPrice - TotalCost$) та маржинальність у відсотках для топових замовлень.
   - **Конвеєр**:
     - `$match`: відбір лише завершених замовлень (`OrderStatus.COMPLETED`).
     - `$lookup`: приєднання лише куплених товарів через `let: { itemIds: '$items.productId' }` та вкладений `pipeline` з умовою `$expr: { $in: ['$_id', '$$itemIds'] }`.
     - **Точний розрахунок собівартості**: для врахування кількості куплених одиниць (`quantity`) використано `$map` по масиву `$items`, пошук відповідного товару через `$filter` та множення `quantity * costPrice`, з подальшим сумуванням через `$sum`.
     - **Маржинальність**: `margin = totalPrice - totalCost`.
     - **Захист від ділення на 0**: у розрахунку `marginPercentage` використано `$cond: [{ $gt: ['$totalPrice', 0] }, ..., 0]`.
     - `$sort: { margin: -1 }` та безпечне обмеження `$limit: Math.max(1, Math.floor(Number(limit) || 10))`.
   - **Ендпоінт**: `GET /analytics/orders/top-margin`.

---

## 📊 Завдання 2: Фасетні звіти ($facet) та цінові сегменти ($bucket)

### Що реалізовано:

1. **Типізація відповіді (`ExecutiveDashboardResponseDto`)**:
   - Створено DTO-файл `src/analytics/dto/executive-dashboard-response.dto.ts`.
   - Типізовано всі 4 блоки бізнес-аналітики:
     - `DashboardSummary`: `totalRevenue`, `avgOrderValue`, `totalOrders`.
     - `TopProductItem`: `productId`, `title`, `totalSold`, `totalRevenue`.
     - `CategoryBreakdownItem`: `category`, `totalRevenue`, `orderCount`.
     - `PriceTierItem`: `_id`, `count`, `totalRevenue`.

2. **Мульти-аналітика за один запит (`getExecutiveDashboard`)**:
   - **Етап `$match` (Попередня фільтрація)**:
     - Фільтрує замовлення за `status: OrderStatus.COMPLETED` та діапазоном `orderedAt: { $gte: startDate, $lte: endDate }`. Застосовується перед `$facet`, що суттєво прискорює запит завдяки індексам.
   - **4 паралельні гілки у `$facet`**:
     1. **`summary`**:
        - `$group` (`_id: null`): підсумовує загальний виторг (`totalRevenue`), кількість замовлень (`totalOrders`), середній чек (`avgOrderValue`).
        - `$project`: округлення середнього чека до 2 знаків (`$round`) із захистом від `null`.
     2. **`topProducts`**:
        - `$unwind: '$items'`: розгортання вкладеного масиву товарів.
        - `$group`: групування за `items.productId`, підрахунок проданих штук (`totalSold`) та виручки (`totalRevenue = sum(quantity * price)`).
        - `$sort: { totalRevenue: -1 }` + `$limit: 5`: відбір топ-5 найприбутковіших товарів.
        - `$lookup` + `$unwind`: приєднання колекції `products` для виведення людиночитабельної назви товару `title`.
     3. **`categoryBreakdown`**:
        - `$group`: групування за `category`, підрахунок виручки та кількості замовлень.
        - `$sort: { totalRevenue: -1 }`: сортування категорій за успішністю.
     4. **`priceTiers`**:
        - `$bucket`: розподіл замовлень за ціновими сегментами:
          - Межі (`boundaries`): `[0, 100, 500, 1000, 5000]`.
          - Дефолтний сегмент: `'VIP (5000+)'`.
          - Підрахунок кількості замовлень та сумарної виручки в кожному кошику.
   - **Нормалізація результату**:
     - Оскільки `$facet` повертає масив `[ { summary: [...], topProducts: [...], ... } ]`, результат деструктурується: `const [result] = ...`.
     - Передбачено безпечні дефолтні значення (`totalRevenue: 0`, `avgOrderValue: 0`, `totalOrders: 0`), якщо за обраний період замовлень не було.
   - **Ендпоінт у контролері**:
     - `GET /analytics/dashboard?startDate=...&endDate=...` з валідацією через `DateRangeDto`.

---

## 🧪 Результати тестування та перевірки

### 1. Юніт-тести (Vitest)
Повністю оновлено та розширено тестові набори:
- **`src/analytics/analytics.service.spec.ts`**:
  - Налаштовано моки для моделей `OrderAnalyticsModel`, `ProductModel`, `CustomerModel`.
  - Покрито тести для:
    - `getOrderDetailsWithCustomer` (успіх та NotFoundException).
    - `getTopOrdersWithMargin` (коректність розрахунку маржі, дефолтний ліміт).
    - `getCategoryRevenueReport` (агрегація за категоріями).
    - `getExecutiveDashboard` (коректний розбір фасетів, обробка порожнього результату).
    - `seedOrders` та `deleteOrders`.
- **`src/analytics/analytics.controller.spec.ts`**:
  - Покрито делегування всіх методів контролера до `AnalyticsService`.

```bash
✓ src/app.controller.spec.ts (1 test)
✓ src/analytics/analytics.service.spec.ts (11 tests)
✓ src/analytics/analytics.controller.spec.ts (7 tests)

Test Files  3 passed (3)
Tests       19 passed (19)
Duration    ~1s
```

### 2. Перевірка якості коду (Oxlint & TypeScript)
- `npm run lint`: **0 помилок, 0 попереджень**.
- `npx tsc --noEmit`: сувора відповідність типам Mongoose PipelineStage та DTO.

### 3. Приклад відповіді `GET /analytics/dashboard` (Postman / curl)
```json
{
  "summary": {
    "totalRevenue": 208543,
    "totalOrders": 142,
    "avgOrderValue": 1468.61
  },
  "topProducts": [
    {
      "productId": "8bfda7c2-a1fa-461b-9541-22e99fe988e2",
      "title": "Tech Product 9",
      "totalSold": 48,
      "totalRevenue": 12192
    },
    {
      "productId": "03b13e82-3868-44ef-8126-34ef5ceed8bb",
      "title": "Auto Product 19",
      "totalSold": 45,
      "totalRevenue": 10980
    }
  ],
  "categoryBreakdown": [
    {
      "category": "Tech",
      "totalRevenue": 68420,
      "orderCount": 44
    },
    {
      "category": "Auto",
      "totalRevenue": 51200,
      "orderCount": 36
    }
  ],
  "priceTiers": [
    {
      "_id": 100,
      "count": 18,
      "totalRevenue": 6240
    },
    {
      "_id": 500,
      "count": 42,
      "totalRevenue": 31500
    },
    {
      "_id": 1000,
      "count": 78,
      "totalRevenue": 154800
    },
    {
      "_id": "VIP (5000+)",
      "count": 4,
      "totalRevenue": 22003
    }
  ]
}
```

---

## 💡 Архітектурні висновки та Best Practices

1. **Продуктивність `$lookup`**:
   - Простий `$lookup` (`localField` $\rightarrow$ `foreignField`) використовує індекси зовнішньої колекції (за замовчуванням `_id` вже індексований у `customers`).
   - Для корельованого `$lookup` обов'язково фільтрувати документи через `$match` якомога раніше, щоб мінімізувати кількість підзапитів.
2. **Переваги денормалізації vs Джоїни**:
   - Для часто запитуваних незмінних даних (наприклад, знімок ціни товару на момент замовлення) використовується **Embedding** (`items: [{ productId, quantity, price }]`).
   - Для динамічних або великих даних (профіль користувача, собівартість постачальника) використовується **Referencing** із `$lookup`.
3. **Обмеження пам'яті `$facet`**:
   - Оператор `$facet` має ліміт у **100 MB RAM** для проміжних результатів.
   - Завдяки попередній фільтрації `$match` на першому кроці конвеєра обсяг даних зберігається в межах безпечного діапазону. За необхідності для дуже великих масивів даних конвеєр підтримує опцію `{ allowDiskUse: true }`.
