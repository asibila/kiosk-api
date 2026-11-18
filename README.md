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

# insert missing UI descriptions (run after migrations, once per environment)
$ npm run prisma:seed

# browse the data
$ npm run prisma:studio
```

The connection string lives in `.env` (`DATABASE_URL`, copy from `.env.example`).
It is a PostgreSQL connection string; URL-encode special characters in the
password (`!` becomes `%21`). Create the local database once with:

```bash
$ createdb -U postgres kiosk
# or: psql -U postgres -c "CREATE DATABASE kiosk;"
```

Then apply migrations with `npm run prisma:deploy` (or `npm run prisma:migrate`
while developing). The SQLite migrations from before the switch are kept in
`prisma/migrations-sqlite/` for reference and are not applied anymore.

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

`AuthController` exposes the sign-in endpoints used by the kiosk frontend. A
successful login creates a server-side session and sets an HTTP-only cookie; the
frontend never holds a user id or sends an actor header.

| Method | Route | Body | Result |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | `{ email, password }` | `200` user + `Set-Cookie: kiosk_session=…` |
| `GET` | `/auth/me` | – | `200` user, or an empty `200` for a guest |
| `POST` | `/auth/logout` | – | `204`; deletes the session row and clears the cookie |
| – | – | – | `401` invalid email or password |

```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"tino@example.com","password":"supersecret"}'
```

`Session.id` is the SHA-256 of the cookie token, so a database leak cannot be
replayed as a session. `AuthGuard` is registered globally: every route needs a
session unless it is `@Public()`; `@Roles('ADMIN')` protects catalog writes.
Listing writes, translations, images and selections are limited to the listing
owner, drafts are private, and chat endpoints only return threads the caller
takes part in. The SSE stream is authenticated and filtered the same way.

Cookie flags come from the environment: `SESSION_COOKIE_NAME`,
`SESSION_TTL_DAYS` and `SESSION_COOKIE_SAMESITE`. The deployed static frontend
is a different origin from the API, so production defaults to
`SameSite=None; Secure`; a same-origin proxy/BFF can set `lax`.


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
| `/listings` | `categoryId`, `regionId` (optional, default `0`), `orientation` (`buy` or `sell`), `userId`, optional `isActive` |
| `/listing-translations` | `listingId`, `language`, `title` (upsert per language) |
| `/categories` | `descriptionId`, `parentCategoryId` (nullable), `iconSvg` (optional inline SVG, sanitized) |
| `/descriptions` | `{ translations: { en, hr } }` (both language texts; update accepts a subset) |
| `/languages` | read-only: `GET /languages`, `GET /languages/:code` (`en`, `hr`) |
| `/chat-messages` | `text` (max 225), `threadId`, `userId` (id of the user which created the message) | `201` created row |
| `/chat-threads` | - (no fields) |
| `/listing-chat-threads` | `listingId`, `chatThreadId` |
| `/inbox-items` | `userId`, `chatThreadId` |
| `/facet-schemas` | `descriptionId`, `name` (max 225), `categoryId`, `isGeneric` (default false), `type` (`option` or `numeric`), `required` (default false) |
| `/facet-value-options` | `descriptionId`, `schemaId` |
| `/facet-value-selections` | `facetValueOptionId`, `listingId` |
| `/listing-outcomes` | `listingId`, `outcome` (`sold`/`sale_fell_through`/`kept`/`gave_away` for a sale, `purchased`/`purchase_fell_through`/`no_longer_needed`/`bought_elsewhere` for a wanted ad), optional `finalPrice` (>= 0; cleared for outcomes that are not a completed deal) |

Live chat uses `GET /chat-events/stream` (Server-Sent Events). It emits
`message.created` / `message.updated` events with the saved `ChatMessage` row,
plus a `ping` heartbeat; it is not part of the CRUD table above.

The `Language` table is seeded by the migration with `en` (English) and `hr`
(Hrvatski); it is exposed read-only. A `Description` is stored as one row per
language with the composite primary key `(id, language)`, so every description
id always has both texts. `POST /descriptions` therefore creates both rows and
returns a single object with a `translations` map; `PATCH /descriptions/:id`
accepts `{ "translations": { "hr": "..." } }` and updates only the supplied
language(s). `Category.descriptionId`, `FacetSchema.descriptionId` and
`FacetValueOption.descriptionId` reference the description `id` (the API checks
that it exists, but the description id is not unique on its own — it is half of
the `(id, language)` primary key — so there is no DB-level constraint).

Descriptions with a non-null `name` are interface strings. The name is the React
i18n key (`common.close`) and is unique per language (`(name, language)`). The
frontend loads them from `GET /descriptions` at startup and builds its
dictionaries from the `translations` map; the 233 current keys are inserted by
`npm run prisma:seed` after applying migrations. Entity
descriptions for categories and facets leave `name` null.

`Region` is a small seeded table: id `0` is "All regions", the other rows are
the EU member states plus Bosnia and Herzegovina, Serbia and Montenegro, each
with a translated name stored like a category description. Listings reference a
region through `Listing.regionId`. `GET /regions` returns the rows ordered by
id; `GET /regions/detect` resolves the caller's country from the request IP
(`x-forwarded-for` and friends) through `api.country.is` (override with
`GEO_LOOKUP_URL`), caches the answer in memory for six hours, and answers
`{ regionId: 0, countryCode: null }` for private addresses, unknown countries
or a failed lookup.

The catalog migration associated with the language work also marks `condition`
as a generic (and required) facet, adds generic orientation, price and year
facets, moves `brand` to its parent Electronics category and adds a Mobile
phones `screen_size` facet. Orientation is a facet in the UI/API but its value
is stored on `Listing.orientation`; price and year use `Listing.price` and
`Listing.year`.

### Category icons

`Category.iconSvg` holds an optional inline SVG icon. The API sanitizes it on
write (`src/categories/category-icon.ts`): only `svg`, `g`, `path`, `circle`,
`rect`, `line`, `polyline`, `polygon` and `ellipse` are kept, attributes are
validated against a per-attribute allow-list (`d`, geometry, `fill`, `stroke`,
…), a `viewBox` is required, and `class`/`id`/`style`/`href`/event handlers are
dropped. Executable elements (`script`, `style`, `foreignObject`, `use`,
`image`, `a`) and `url(...)`/`javascript:` values are rejected with `400`, and
the normalized result must stay under 4096 characters. Because
`GET /categories` is loaded on every page, keep icons small; draw strokes with
`currentColor` so they follow the theme.

`npm run prisma:icons` backfills the seeded categories from
`prisma/category-icons.json` (matched by English description). It only fills
icons that are empty; pass `--force` to re-apply the defaults after editing the
file. A category without an icon is drawn by the frontend's title-based
fallback, so the column can stay `null`.

### Drafts and listing titles

`Listing.isActive` defaults to `true`. The wizard creates a listing with
`isActive: false` when the interview's Next button opens the edit step, writes
the interview answers to it, and flips it to `true` on Publish. Inactive drafts
are shown italic in the owner's drawer with a `Draft` marker; public search and
the listing page hide them from other users.

`ListingTranslation` stores one title per `(listingId, language)` and cascades
with the listing. `POST /listing-translations` upserts, so the edit screen can
save the current language and the translate dialog can add English/Croatian
titles independently. Missing languages fall back to another saved title and
finally to the generated `"Category #id"` label.

### Facet suggestions

`GET /suggest` powers the structured search input. It returns facet values (not
ad free text) with counts derived from `FacetValueSelection` rows:

```bash
curl 'http://localhost:3000/suggest?q=new&lang=en&category=2'
# {"suggestions":[{"facet":"condition","facetLabel":"Condition","valueId":"1","label":"New","count":1}]}
```

Query parameters: `q`, `lang` (`en`/`hr`), `category` (selected category id),
optional `orientation` (`buy`/`sell`) and optional `chips` (JSON array of
committed chips). A facet is included when it is generic (`isGeneric`) or
defined on the selected category or one of its ancestors, so parent-category
facets apply to subcategories. Chips are AND constraints; a facet that already
has a value chip is omitted. Only non-zero counts are returned, sorted by facet
then count. Range chips are accepted but ignored until numeric facets exist. The
Vite frontend calls this as `/api/suggest`.

Listing images are not plain CRUD rows: `POST /listing-images` accepts a
multipart upload (`file` + `listingId`), re-encodes it to WebP (max 1600 px,
quality 82), and stores the bytes in PostgreSQL in the `ListingImageData` table.
`ListingImage` keeps the metadata (`listingId`, `fileName`, `mimeType`, `size`,
`primaryImage`), so redeploys never lose images. The first image is primary
automatically; `PATCH /listing-images/:id` with `{ "primaryImage": true }`
promotes another image (clearing the siblings). Fetch bytes with
`GET /listing-images/:id/file`; `GET /listing-images?listingId=<id>` lists a
listing's images (primary first) and `DELETE /listing-images/:id` removes the
row and its stored bytes. JPEG, PNG, WebP, GIF and AVIF are accepted up to
10 MB; animated GIFs keep their first frame.

A duplicate unique value returns `409`, a reference to a row that does not
exist returns `400`, and an unknown `:id` returns `404`.

### Audit columns

Every entity stores `createdAt`, `updatedAt`, `createdBy` and `updatedBy`.
Prisma maintains the timestamps; `CrudService` fills the actor columns from the
signed-in session (`request.user.id`) on `POST` and `PATCH`:

```bash
# after logging in, the cookie jar holds kiosk_session
curl -X POST http://localhost:3000/categories \
  -H 'content-type: application/json' \
  -b session-cookies.txt \
  -d '{"descriptionId": 1}'
```

`createdBy` / `updatedBy` cannot be supplied by the client.

Create descriptions with both language texts before the category. UI strings
also carry the React i18n key in `name`:

```bash
curl -X POST http://localhost:3000/descriptions \
  -H 'content-type: application/json' \
  -d '{"translations":{"en":"Cars","hr":"Automobili"}}'

curl -X POST http://localhost:3000/descriptions \
  -H 'content-type: application/json' \
  -d '{"name":"common.close","translations":{"en":"Close","hr":"Zatvori"}}'
```

The keys are stored as plain integer columns rather than foreign keys, so audit
history survives user deletion.

## Deployment

The API needs a PostgreSQL database in production. On Render:

1. Create a **Postgres** instance in the same region as the web service.
2. Set the web service's `DATABASE_URL` to the instance's **Internal Database
   URL** (it already includes `sslmode=require`).
3. Deploy. `npm run start:prod` runs `prisma migrate deploy`, inserts any
   missing interface descriptions with `prisma/seed.mjs`, and then starts the
   server, so the schema, seeded languages and UI strings are created on every
   start. The seed is insert-only, so database edits to existing keys survive.
   Make sure the host's start command is `npm run start:prod` (or runs
   `prisma/seed.mjs`): with a bare `node dist/main`, migrations apply but new UI
   keys are never inserted and the frontend renders raw keys such as
   `search.regionTitle`. The `20261117223000_add_missing_ui_strings` migration
   backfills keys that were added after a deployment had last seeded.

Beyond the seeded languages and UI descriptions, the database starts empty, so
create categories, facets and listings through the API before expecting search
results. This replaces the old SQLite file, which was wiped on every deploy
because the web service has no persistent disk.

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
