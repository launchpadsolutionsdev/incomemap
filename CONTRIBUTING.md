# Contributing to IncomeMap

IncomeMap is currently a solo project. This document exists to keep development practices consistent as the project grows.

---

## Branch Strategy

- `main` — production branch, deployed to Render automatically
- `dev` — active development branch
- Feature branches — `feature/feature-name` off of `dev`

## Commit Style

Use clear, descriptive commit messages:

```
Add holdings CRUD with FMP ticker search
Fix USD/CAD conversion for monthly distributions
Update dashboard chart to show year-over-year comparison
```

## Code Style

- Use `const` and `let`, never `var`
- Use async/await over raw promises
- Handle all errors explicitly — no silent catches
- Keep route handlers thin — business logic goes in `/services`
- SQL queries use parameterized inputs (`$1, $2`) — never string concatenation

## Database Changes

- All schema changes go in `db/schema.sql`
- For migrations on a live database, create numbered migration files in `db/migrations/`
- Always test migrations against a local copy first

## Testing

- Test FMP API responses against cached data to avoid burning API calls
- Test DRIP projection math with known inputs/outputs
- Verify USD/CAD conversion with Bank of Canada published rates
