# День 8: InsightPulse — GraphQL API в NestJS з Apollo Server (Code-First)

Сьогодні ми створюємо гнучкий рівень API для аналітичного сервісу **InsightPulse**. Ми підключаємо Apollo Server до NestJS, проєктуємо схему за підходом Code-First за допомогою TypeScript-декораторів, реалізуємо запити (Queries), мутації (Mutations) та резолвери для зв'язку зі створеними агрегаціями MongoDB.

---

## ⏱️ Розклад Дня 8 (6 годин)

| Блок       | Тривалість | Тема                             | Опис                                                                           |
| :--------- | :--------- | :------------------------------- | :----------------------------------------------------------------------------- |
| **Блок 1** | 1 год      | Алгоритмічний розігрів (TS/JS)   | Власний селектор полів (Field Masking) у пам'яті за графом вибірки             |
| **Блок 2** | 2.5 год    | Apollo Server & Code-First схема | Інтеграція `@nestjs/graphql`, створення Object Types, Input Types та валідація |
| **Блок 3** | 1.5 год    | GraphQL Resolvers для аналітики  | Побудова Queries, `@ResolveField`, Mutations та тестування в Apollo Sandbox    |
| **Блок 4** | 1 год      | Рев'ю та інтерв'ю-підготовка     | GraphQL vs REST: Over/Under-fetching, специфіка кешування та статус-коди       |

---

## 🌐 Завдання 1: Налаштування Apollo Server та Code-First схеми

### Мета

Інтегрувати Apollo Server у NestJS-застосунок `insight-pulse-service`, описати типи GraphQL за допомогою класів і декораторів TypeScript та налаштувати автоматичну генерацію файлу `schema.gql`.

### Кроки реалізації

1. **Встановлення залежностей:**

   ```bash
   npm i @nestjs/graphql @nestjs/apollo @apollo/server graphql class-validator class-transformer
   ```

2. **Конфігурація `GraphQLModule` у `AppModule`:**

   ```typescript
   import { Module } from '@nestjs/common';
   import { GraphQLModule } from '@nestjs/graphql';
   import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
   import { join } from 'path';

   @Module({
     imports: [
       GraphQLModule.forRoot<ApolloDriverConfig>({
         driver: ApolloDriver,
         autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
         sortSchema: true,
         playground: true,
       }),
     ],
   })
   export class AppModule {}
   ```

3. **Опис моделей через декоратори (`Code-First`):**
   Створи файл `src/analytics/models/category-report.model.ts`:

   ```typescript
   import { Field, ObjectType, Float, Int, ID } from '@nestjs/graphql';

   @ObjectType('CategoryMetrics')
   export class CategoryMetrics {
     @Field(() => Float)
     totalRevenue: number;

     @Field(() => Int)
     totalOrders: number;

     @Field(() => Float)
     averageOrderValue: number;
   }

   @ObjectType('CategoryReport')
   export class CategoryReport {
     @Field(() => ID)
     id: string;

     @Field(() => String)
     category: string;

     @Field(() => CategoryMetrics)
     metrics: CategoryMetrics;
   }
   ```

4. **Створення DTO вхідних параметрів:**
   Створи файл `src/analytics/dto/date-range.input.ts`:

   ```typescript
   import { InputType, Field } from '@nestjs/graphql';
   import { IsDate, IsOptional } from 'class-validator';

   @InputType('DateRangeInput')
   export class DateRangeInput {
     @Field(() => Date, { nullable: true })
     @IsOptional()
     @IsDate()
     startDate?: Date;

     @Field(() => Date, { nullable: true })
     @IsOptional()
     @IsDate()
     endDate?: Date;
   }
   ```

### ❓ Додаткові запитання до Завдання 1

1. У чому полягає відмінність між декораторами `@ObjectType()` та `@InputType()` в екосистемі GraphQL?
2. Навіщо в декораторах полів явно вказувати стрілочну функцію типу на зразок `@Field(() => Float)`, якщо в TypeScript поле вже типізовано як `number`?

---

## 📊 Завдання 2: GraphQL Resolvers для аналітики та Mutations

### Мета

Створити GraphQL-резолвери, які зв'язують вхідні GraphQL-запити з конвеєром агрегацій MongoDB, реалізованим у попередні дні, та підтримують точкову вибірку даних через `@ResolveField()`.

### Кроки реалізації

1. **Створення `AnalyticsResolver`:**
   Створи файл `src/analytics/analytics.resolver.ts`:

   ```typescript
   import {
     Resolver,
     Query,
     Mutation,
     Args,
     ResolveField,
     Parent,
   } from '@nestjs/graphql';
   import { AnalyticsService } from './analytics.service';
   import {
     CategoryReport,
     CategoryMetrics,
   } from './models/category-report.model';
   import { DateRangeInput } from './dto/date-range.input';

   @Resolver(() => CategoryReport)
   export class AnalyticsResolver {
     constructor(private readonly analyticsService: AnalyticsService) {}

     @Query(() => [CategoryReport], { name: 'categoryReports' })
     async getCategoryReports(
       @Args('filter', { type: () => DateRangeInput, nullable: true })
       filter?: DateRangeInput,
     ): Promise<CategoryReport[]> {
       return this.analyticsService.getCategoryRevenueReport(
         filter?.startDate ?? new Date(0),
         filter?.endDate ?? new Date(),
       );
     }

     @ResolveField(() => String)
     formattedSummary(@Parent() report: CategoryReport): string {
       return `Category ${report.category}: $${report.metrics.totalRevenue}`;
     }

     @Mutation(() => Boolean, { name: 'triggerDailyAnalytics' })
     async triggerDailyAnalytics(
       @Args('targetDate', { type: () => Date }) targetDate: Date,
     ): Promise<boolean> {
       return this.analyticsService.recalculateDailyAnalytics(targetDate);
     }
   }
   ```

2. **Підключення резолвера до модуля:**
   Додай `AnalyticsResolver` до масиву `providers` у файлі `analytics.module.ts`.
3. **Тестування запитів в Apollo Sandbox:**
   - Запусти сервіс: `npm run start:dev`.
   - Відкрий у браузері `http://localhost:3000/graphql`.
   - Виконай запит, у якому запроси лише обмежений набір полів:

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

### ❓ Додаткові запитання до Завдання 2

1. Коли виконується метод із декоратором `@ResolveField()`: для кожного елемента масиву окремо чи для всього масиву одразу?
2. Яким чином глобальний `ValidationPipe` підключається для валідації полів усередині `InputType` у додатку з GraphQL?
