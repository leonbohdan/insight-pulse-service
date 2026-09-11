# День 9: InsightPulse — Вирішення N+1 у GraphQL (DataLoader) та захист API

Сьогодні ми завершуємо другий мікропроєкт — **InsightPulse Reporting Engine**. Наша мета — оптимізувати GraphQL API для високих навантажень: подолати класичну проблему $N+1$ за допомогою бібліотеки `dataloader`, реалізувати безпечний request-scoped кеш та захистити ендпоінт від DoS-атак через обмеження глибини (Depth Limit), аналіз складності (Query Complexity) та тротлінг (Rate Limiting).

---

## ⏱️ Розклад Дня 9 (6 годин)

| Блок       | Тривалість | Тема                           | Опис                                                                                         |
| :--------- | :--------- | :----------------------------- | :------------------------------------------------------------------------------------------- |
| **Блок 1** | 1 год      | Алгоритмічний розігрів (TS/JS) | Власний батчер-кешер `BatchLoader<K, V>` у пам'яті на базі черги мікротасків Event Loop      |
| **Блок 2** | 2.5 год    | Усунення N+1 через DataLoader  | Інтеграція `dataloader` у NestJS, фабрика scoped-лоадерів у GraphQL Context, `@ResolveField` |
| **Блок 3** | 1.5 год    | Захист GraphQL API від DoS     | Query Depth Limiting, Query Complexity Analysis та Rate Limiting з `@nestjs/throttler`       |
| **Блок 4** | 1 год      | Рев'ю та інтерв'ю-підготовка   | Архітектурні виклики GraphQL: per-request кеш, захист introspection, Persisted Queries       |

---

## 🔗 Завдання 1: Усунення проблеми N+1 за допомогою DataLoader у NestJS

### Мета

Усунути проблему $N+1$ при побудові складних звітів, де кожен аналітичний запис містить вкладені сутності (наприклад, автора звіту або список асоційованих товарів). Замість $N$ додаткових запитів до MongoDB створити пакетний резолвер із request-scoped лоадером.

### Проблема N+1 у GraphQL

Розглянь запит:

```graphql
query {
  topCategories {
    id
    category
    topPerformerCustomer {
      id
      name
      email
    }
  }
}
```

Якщо категорій 20, і поле `topPerformerCustomer` резолвиться через окремий метод `@ResolveField()`, який виконує `this.customerModel.findById(customerId)`, MongoDB отримає **$1 + 20 = 21$ запит**!

### Кроки реалізації

1. **Встановлення залежності:**

   ```bash
   npm install dataloader
   ```

2. **Створення фабрики DataLoader:**
   Створи файл `src/analytics/loaders/customer.loader.ts`:

   ```typescript
   import DataLoader from 'dataloader';
   import { Injectable, Scope } from '@nestjs/common';
   import { InjectModel } from '@nestjs/mongoose';
   import { Model, Types } from 'mongoose';
   import { Customer, CustomerDocument } from '../schemas/customer.schema';

   export type CustomerDataLoader = DataLoader<string, CustomerDocument | null>;

   @Injectable({ scope: Scope.REQUEST })
   export class CustomerLoaderFactory {
     constructor(
       @InjectModel(Customer.name)
       private readonly customerModel: Model<CustomerDocument>,
     ) {}

     createLoader(): CustomerDataLoader {
       return new DataLoader<string, CustomerDocument | null>(
         async (customerIds) => {
           const objectIds = customerIds.map((id) => new Types.ObjectId(id));
           const customers = await this.customerModel
             .find({
               _id: { $in: objectIds },
             })
             .exec();

           // КРИТИЧНО: DataLoader вимагає повернення результатів
           // строго в тому ж порядку, що й вхідний масив customerIds!
           const customerMap = new Map<string, CustomerDocument>(
             customers.map((c) => [c._id.toString(), c]),
           );

           return customerIds.map((id) => customerMap.get(id) ?? null);
         },
       );
     }
   }
   ```

3. **Інтеграція DataLoader у GraphQL Context:**
   Щоб лоадер створювався на кожен окремий HTTP-запит (уникаючи витоку пам'яті та кешування між різними користувачами), підключи фабрику у конфігурацію `GraphQLModule` у файлі `app.module.ts`:

   ```typescript
   GraphQLModule.forRootAsync<ApolloDriverConfig>({
     driver: ApolloDriver,
     imports: [AnalyticsModule],
     inject: [CustomerLoaderFactory],
     useFactory: (customerLoaderFactory: CustomerLoaderFactory) => ({
       autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
       sortSchema: true,
       context: () => ({
         customerLoader: customerLoaderFactory.createLoader(),
       }),
     }),
   });
   ```

4. **Використання в резолвері через `@Context()`:**
   У `src/analytics/analytics.resolver.ts` заміни пряме звернення до бази у `@ResolveField()`:

   ```typescript
   @ResolveField(() => CustomerModel, { nullable: true })
   async topPerformerCustomer(
     @Parent() report: CategoryReport,
     @Context('customerLoader') customerLoader: CustomerDataLoader,
   ): Promise<Customer | null> {
     if (!report.topCustomerId) return null;
     return customerLoader.load(report.topCustomerId);
   }
   ```

5. **Перевірка роботи:**
   - Увімкни дебаг-лог запитів Mongoose: `mongoose.set('debug', true)`.
   - Виконай запит до `topCategories` на вибірку 10 записів із вкладеним `topPerformerCustomer`.
   - Переконайся у консолі, що до колекції `customers` пішов **рівно 1 запит** вигляду `{ _id: { $in: [...] } }`.

---

## 🛡️ Завдання 2: Захист GraphQL API від DoS-атак

### Мета

Захистити GraphQL сервіс від вичерпання ресурсів через зловмисні або надмірно важкі запити (рекурсивні графи, надглибока вкладеність, перевантаження CPU/RAM).

### Кроки реалізації

1. **Обмеження глибини запиту (Query Depth Limiting):**
   - Встанови бібліотеку:

     ```bash
     npm install graphql-depth-limit
     ```

   - Додай валідаційне правило у конфігурацію `GraphQLModule`:

     ```typescript
     import depthLimit from 'graphql-depth-limit';

     // У конфігурації ApolloDriver:
     validationRules: [depthLimit(5)], // Максимальна глибина вкладеності — 5 рівнів
     ```

   - Перевір: запит глибиною більше 5 рівнів (наприклад: `category -> products -> category -> products -> category -> products`) повинен негайно відхилятися Apollo Server до етапу виконання резолверів.

2. **Аналіз складності запитів (Query Complexity Analysis):**
   - Створи плагін складності за допомогою `graphql-query-complexity`:

     ```bash
     npm install graphql-query-complexity
     ```

   - Налаштуй плагін у `app.module.ts`:

     ```typescript
     import {
       getComplexity,
       simpleEstimator,
       fieldExtensionsEstimator,
     } from 'graphql-query-complexity';

     // Додай плагін до Apollo Server:
     plugins: [
       {
         async requestDidStart() {
           return {
             async didResolveOperation({ request, document }) {
               const complexity = getComplexity({
                 schema,
                 operationName: request.operationName,
                 query: document,
                 variables: request.variables,
                 estimators: [
                   fieldExtensionsEstimator(),
                   simpleEstimator({ defaultComplexity: 1 }),
                 ],
               });

               const maxComplexity = 100;
               if (complexity > maxComplexity) {
                 throw new Error(
                   `Запит занадто складний: ${complexity}. Максимально дозволено: ${maxComplexity}`,
                 );
               }
             },
           };
         },
       },
     ],
     ```

3. **Rate Limiting (Обмеження частоти запитів) через Throttler:**
   - Встанови `@nestjs/throttler`:

     ```bash
     npm install @nestjs/throttler
     ```

   - Створи кастомний гвард `GqlThrottlerGuard`, який витягує HTTP `req` із `GqlExecutionContext`:

     ```typescript
     import { ExecutionContext, Injectable } from '@nestjs/common';
     import { ThrottlerGuard } from '@nestjs/throttler';
     import { GqlExecutionContext } from '@nestjs/graphql';

     @Injectable()
     export class GqlThrottlerGuard extends ThrottlerGuard {
       getRequestResponse(context: ExecutionContext) {
         const gqlCtx = GqlExecutionContext.create(context);
         const ctx = gqlCtx.getContext();
         return { req: ctx.req, res: ctx.res };
       }
     }
     ```

   - Підключи `ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])` (максимум 30 запитів на хвилину) та активуй гвард над GraphQL Resolver.
