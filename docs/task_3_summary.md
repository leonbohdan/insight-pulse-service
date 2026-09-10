# 📋 Підсумок виконання: День 8 (Завдання 1 та Завдання 2)

## 📌 Загальний огляд
У рамках третього дня роботи над проєктом **InsightPulse Reporting Engine** було спроєктовано та реалізовано повноцінний **GraphQL API** за допомогою **Apollo Server** та **NestJS**:
1. **Інтеграція Apollo Server за підходом Code-First**: налаштування `GraphQLModule`, типізація моделей за допомогою TypeScript-класів і декораторів, автоматична кодогенерація SDL-схеми `src/schema.gql`.
2. **GraphQL Resolvers та обчислювані поля**: створення запиту `categoryReports`, валідація вхідних фільтрів через `InputType`, мапінг результатів агрегації MongoDB та впровадження динамічного віртуального поля через декоратор `@ResolveField()`.

---

## 🌐 Завдання 1: Налаштування Apollo Server та Code-First схеми

### Що реалізовано:

1. **Встановлення та конфігурація залежностей**:
   - Встановлено базові пакети GraphQL: `@nestjs/graphql`, `@nestjs/apollo`, `@apollo/server`, `graphql`.
   - **Вирішення специфіки NestJS 12 (Express 5)**: оскільки NestJS 12 за замовчуванням базується на `Express 5`, для зв'язки з Apollo Server було додано офіційний адаптер `@as-integrations/express5`.

2. **Конфігурація `GraphQLModule` у [src/app.module.ts](file:///home/bohdan/MyProjects/test_projects/insight-pulse-service/src/app.module.ts)**:
   ```typescript
   GraphQLModule.forRoot<ApolloDriverConfig>({
     driver: ApolloDriver,
     autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
     sortSchema: true,
     playground: true,
   }),
   ```
   - `driver: ApolloDriver` — підключення Apollo Server як рушія обробки запитів.
   - `autoSchemaFile` — увімкнення підходу Code-First із збереженням згенерованого контракту у файл `src/schema.gql`.
   - `sortSchema: true` — сортування типів і полів за алфавітом для запобігання зайвим diff-ам у Git.
   - `playground: true` — інтеграція веб-інтерфейсу для інтерактивного тестування запитів.

3. **Опис моделей через декоратори (`Code-First`)**:
   - Створено файл [src/analytics/models/category-report.model.ts](file:///home/bohdan/MyProjects/test_projects/insight-pulse-service/src/analytics/models/category-report.model.ts):
     - **`CategoryMetrics`**: описує аналітичні показники (`totalRevenue: Float`, `totalOrders: Int`, `averageOrderValue: Float`).
     - **`CategoryReport`**: описує звіт категорії (`id: ID`, `category: String`, вкладений об'єкт `metrics: CategoryMetrics`).

4. **Створення DTO вхідних параметрів (`InputType`)**:
   - Створено файл [src/analytics/dto/date-range.input.ts](file:///home/bohdan/MyProjects/test_projects/insight-pulse-service/src/analytics/dto/date-range.input.ts):
     - Клас `DateRangeInput` позначено декоратором `@InputType('DateRangeInput')`.
     - Поля `startDate` та `endDate` з типом `Date`, налаштовані як `{ nullable: true }` та валідовані за допомогою `@IsOptional()` і `@IsDate()`.

5. **Автоматично згенерована схема [src/schema.gql](file:///home/bohdan/MyProjects/test_projects/insight-pulse-service/src/schema.gql)**:
   ```graphql
   type CategoryMetrics {
     averageOrderValue: Float!
     totalOrders: Int!
     totalRevenue: Float!
   }

   type CategoryReport {
     category: String!
     formattedSummary: String!
     id: ID!
     metrics: CategoryMetrics!
   }

   input DateRangeInput {
     endDate: DateTime
     startDate: DateTime
   }

   scalar DateTime

   type Query {
     categoryReports(filter: DateRangeInput): [CategoryReport!]!
   }
   ```

---

### ❓ Відповіді на контрольні запитання Завдання 1:

1. **У чому полягає відмінність між декораторами `@ObjectType()` та `@InputType()` в екосистемі GraphQL?**
   - **`@ObjectType()`** описує типи **вихідних даних** (Output Types) — це те, що сервер повертає клієнту. У SDL-схемі вони генеруються як `type Name { ... }`.
   - **`@InputType()`** описує типи **вхідних аргументів** (Input Types) — це складні структури об'єктів, які клієнт передає на сервер у параметрах запитів (`query`) чи мутацій (`mutation`). У SDL-схемі вони генеруються як `input Name { ... }`.
   - GraphQL суворо розділяє вхідні та вихідні типи: ви не можете використовувати `@ObjectType` як аргумент функції, і навпаки.

2. **Навіщо в декораторах полів явно вказувати стрілочну функцію типу на зразок `@Field(() => Float)`, якщо в TypeScript поле вже типізовано як `number`?**
   - У TypeScript є тільки один базовий числовий тип — `number`.
   - У специфікації GraphQL є два різних скалярних типи: `Int` (32-бітне ціле число) та `Float` (число з рухомою комою подвійної точності).
   - Крім того, TypeScript компілюється в JavaScript, де вся інформація про інтерфейси та складні типи стирається (Type Erasure). Явна функція `() => Float` передає інформацію про тип у runtime для генератора схеми NestJS за допомогою рефлексії метаданих.

---

## 📊 Завдання 2: GraphQL Resolvers для аналітики

### Що реалізовано:

1. **Створення `AnalyticsResolver` у [src/analytics/analytics.resolver.ts](file:///home/bohdan/MyProjects/test_projects/insight-pulse-service/src/analytics/analytics.resolver.ts)**:
   - Декоратор `@Resolver(() => CategoryReport)` пов'язує резолвер із моделлю звіту.
   - Впроваджено залежність `AnalyticsService` через конструктор (Dependency Injection).

2. **Реалізація запиту `categoryReports` (`@Query`)**:
   - Приймає опціональний вхідний аргумент `filter` типу `DateRangeInput`.
   - Встановлює дефолтні значення діапазону дат за їх відсутності:
     `startDate: filter?.startDate ?? new Date(0)` (початок епохи Unix),  
     `endDate: filter?.endDate ?? new Date()` (поточний момент).
   - Зв'язує GraphQL з агрегаційним пайплайном MongoDB `getCategoryRevenueReport()`.

3. **Усунення невідповідності структур даних (Data Shape Mapping)**:
   - Конвеєр MongoDB повертав плаский об'єкт `{ category, totalRevenue, totalOrders, averageOrderValue }` без поля `id`.
   - У резолвері реалізовано трансформацію:
     ```typescript
     return rawReports.map((report: any) => ({
       id: report.category,
       category: report.category,
       metrics: {
         totalRevenue: report.totalRevenue,
         totalOrders: report.totalOrders,
         averageOrderValue: report.averageOrderValue,
       },
     }));
     ```
   - Це запобігло помилкам `Cannot return null for non-nullable field CategoryReport.id` та `CategoryReport.metrics`.

4. **Віртуальне обчислюване поле (`@ResolveField`)**:
   - Реалізовано метод `formattedSummary(@Parent() report: CategoryReport)`:
     ```typescript
     @ResolveField(() => String)
     formattedSummary(@Parent() report: CategoryReport): string {
       return `Category ${report.category}: $${report.metrics?.totalRevenue ?? 0}`;
     }
     ```
   - Поле обчислюється динамічно на льоту лише тоді, коли клієнт явно запитує його в тілі GraphQL-запиту.

5. **Підключення до модуля [src/analytics/analytics.module.ts](file:///home/bohdan/MyProjects/test_projects/insight-pulse-service/src/analytics/analytics.module.ts)**:
   - `AnalyticsResolver` додано до масиву `providers`.

---

### 🧪 Тестування запиту в Apollo Sandbox

**Виконаний GraphQL-запит:**
```graphql
query GetFilteredReports {
  categoryReports(filter: { startDate: "2026-01-01T00:00:00Z" }) {
    id
    category
    metrics {
      totalRevenue
    }
    formattedSummary
  }
}
```

**Отримана відповідь сервера (JSON):**
```json
{
  "data": {
    "categoryReports": [
      {
        "id": "Tech",
        "category": "Tech",
        "metrics": {
          "totalRevenue": 68420.5
        },
        "formattedSummary": "Category Tech: $68420.5"
      },
      {
        "id": "Auto",
        "category": "Auto",
        "metrics": {
          "totalRevenue": 51200
        },
        "formattedSummary": "Category Auto: $51200"
      }
    ]
  }
}
```

---

### ❓ Відповіді на контрольні запитання Завдання 2:

1. **Коли виконується метод із декоратором `@ResolveField()`: для кожного елемента масиву окремо чи для всього масиву одразу?**
   - Метод із `@ResolveField()` виконується **для кожного елемента масиву окремо**.
   - Якщо кореневий запит повертає 100 категорій, метод `formattedSummary` викликається 100 разів, отримуючи через декоратор `@Parent()` окремий екземпляр звіту.
   - **Важливий висновок:** Якщо всередині `@ResolveField()` виконувати звернення до бази даних чи зовнішнього API, виникає класична проблема **N+1 Queries** (1 запит на вибірку списку + N запитів для кожного елемента). Для вирішення цієї проблеми застосовують бібліотеку **`DataLoader`** (тема Дня 9).

2. **Яким чином глобальний `ValidationPipe` підключається для валідації полів усередині `InputType` у додатку з GraphQL?**
   - Глобальний `ValidationPipe` підключається стандартно в `main.ts`:
     ```typescript
     app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
     ```
   - Завдяки інтеграції `@nestjs/graphql` з життєвим циклом запитів NestJS, будь-який вхідний аргумент з декоратором `@Args()` або клас із декоратором `@InputType()` автоматично проходить крізь пайплайни валідації так само, як і `Body` у звичайних REST-контролерах. Декоратори `class-validator` (`@IsDate`, `@IsOptional` тощо) спрацьовують автоматично до передачі аргументу в метод резолвера.

---

## 💡 Ключові архітектурні висновки (GraphQL vs REST)

| Критерій | REST API | GraphQL API |
| :--- | :--- | :--- |
| **Вибірка даних** | Фіксована структура DTO ендпоінта | Клієнт запитує лише необхідні поля (захист від **Over-fetching**) |
| **Кількість запитів** | Може вимагати кількох запитів (Under-fetching) | Отримання агрегованих даних за 1 запит |
| **Статус-коди помилок** | Різні HTTP-коди (400, 401, 404, 500) | Завжди HTTP `200 OK`, деталі помилок у масиві `errors` у тілі відповіді |
| **Кешування** | Нативно на рівні HTTP (заголовки `Cache-Control`, CDN, ETag) | Ускладнене на рівні HTTP (оскільки всі запити йдуть через POST на `/graphql`), вимагає клієнтського кешу (Apollo Client Normalized Cache) |
| **Контракт схеми** | OpenAPI / Swagger (часто як доповнення) | Строго типізована схема — обов'язкова основа роботи API |
