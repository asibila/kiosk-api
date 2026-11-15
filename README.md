<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Database

Prisma is wired in through a global `PrismaModule`, so any provider can inject
`PrismaService` and use the generated client (`prisma.user.findMany()`, ...).

```bash
# create a migration after editing prisma/schema.prisma, and regenerate the client
$ npm run prisma:migrate -- --name <change>

# regenerate the client only
$ npm run prisma:generate

# apply pending migrations (production / CI)
$ npm run prisma:deploy

# browse the data
$ npm run prisma:studio
```

The connection string lives in `.env` (`DATABASE_URL`, copy from `.env.example`).
It points at a SQLite file, `prisma/dev.db`, which is created on first connect
and is git-ignored.

## Users API

`UsersController` exposes CRUD for the `User` model. Passwords are hashed with
scrypt and never returned; request bodies are validated with Zod schemas.

| Method | Route | Body | Result |
| --- | --- | --- | --- |
| `POST` | `/users` | `{ name, email, password, role?, isActive? }` | `201` created user |
| `GET` | `/users` | – | `200` array of users |
| `GET` | `/users/:id` | – | `200` user, `404` if missing |
| `PATCH` | `/users/:id` | any of `name`, `email`, `password`, `role`, `isActive` | `200` updated user |
| `DELETE` | `/users/:id` | – | `204`, `404` if missing |

`role` is `USER` (default) or `ADMIN`; `password` must be at least 8 characters;
a duplicate `email` returns `409`.

## Auth API

`AuthController` exposes the sign-in endpoint used by the kiosk frontend. It
validates an email + password pair against the scrypt-verified hash and returns
the matching user's id.

| Method | Route | Body | Result |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | `{ email, password }` | `200` `{ userId }` |
| – | – | – | `401` invalid email or password |

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"tino@example.com","password":"supersecret"}'
```

The response is intentionally minimal (`{ userId }`) — the frontend keeps the
logged-in user client-side and sends the `x-actor-id` header on subsequent writes.

## Catalog API

The rest of the ER model lives in `prisma/schema.prisma` and is exposed by one
CRUD controller per entity. Every resource has the same endpoints:

| Method | Route | Body | Result |
| --- | --- | --- | --- |
| `POST` | `/<resource>` | fields below | `201` created row |
| `GET` | `/<resource>` | – | `200` array, ordered by `id` |
| `GET` | `/<resource>/:id` | – | `200` row, `404` if missing |
| `PATCH` | `/<resource>/:id` | any of the fields below | `200` updated row |
| `DELETE` | `/<resource>/:id` | – | `204`, `404` if missing |

| Resource | Body |
| --- | --- |
| `/listings` | `categoryId`, `orientation` (`buy` or `sell`), `userId` |
| `/categories` | `descriptionId`, `parentCategoryId` (nullable) |
| `/descriptions` | `language` (`en` or `hr`), `text` (max 225) |
| `/chat-messages` | `text` (max 225), `threadId`, `userId` (id of the user which created the message) | `201` created row |
| `/chat-threads` | - (no fields) |
| `/listing-chat-threads` | `listingId`, `chatThreadId` |
| `/inbox-items` | `userId`, `chatThreadId` |
| `/facet-schemas` | `descriptionId`, `name` (max 225), `categoryId` |
| `/facet-value-options` | `descriptionId`, `schemaId` |
| `/facet-value-selections` | `facetValueOptionId`, `listingId` |

Live chat uses `GET /chat-events/stream` (Server-Sent Events). It emits
`message.created` / `message.updated` events with the saved `ChatMessage` row,
plus a `ping` heartbeat; it is not part of the CRUD table above.

A duplicate unique value returns `409`, a reference to a row that does not
exist returns `400`, and an unknown `:id` returns `404`.

### Audit columns

Every entity stores `createdAt`, `updatedAt`, `createdBy` and `updatedBy`.
Prisma maintains the timestamps; `CrudService` fills the actor columns from the
optional `x-actor-id` request header on `POST` and `PATCH`:

```bash
curl -X POST http://localhost:3000/categories \
  -H 'content-type: application/json' \
  -H 'x-actor-id: 1' \
  -d '{"descriptionId": 1}'
```

The keys are stored as plain integer columns rather than foreign keys, so audit
history survives user deletion.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It installs `@nestjs/observe`, wires it into `AppModule` and `main.ts`, and writes the app key and secret into `.env`, which every `nest start` script (`start`, `start:dev`, `start:debug`) then loads. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/sdk) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
