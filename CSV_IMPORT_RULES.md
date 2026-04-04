# CSV Import Rules

## Accepted Columns

| Column        | Required | Description                                 | Example          |
|---------------|----------|---------------------------------------------|------------------|
| `date`        | Yes      | Transaction date (any parseable format)     | `2026-03-15`     |
| `amount`      | Yes      | Numeric amount (positive)                   | `45.50`          |
| `type`        | Yes      | `INCOME` or `EXPENSE` (case-insensitive)    | `EXPENSE`        |
| `category`    | Yes      | Category name (must exist in your account)  | `Groceries`      |
| `description` | No       | Free text                                   | `Weekly shopping` |
| `currency`    | No       | 3-letter ISO code (defaults to `USD`)       | `EUR`            |

The first row **must** be the header row with exact column names shown above.

## Validation Rules

1. **date** — Must be a parseable date string. Recommended format: `YYYY-MM-DD`.
2. **amount** — Must be a positive number. Negative amounts, zero, and non-numeric values are rejected.
3. **type** — Must be exactly `INCOME` or `EXPENSE` (case-insensitive). Any other value is rejected.
4. **category** — Must match an existing category name in your account (case-insensitive). If the category doesn't exist, the row fails — create it beforehand on the Categories page.
5. **type ↔ category consistency** — The `type` column must match the category's type. For example, you cannot assign `INCOME` type to an `EXPENSE` category.
6. **currency** — If provided, must be a valid 3-letter code. Defaults to `USD` if omitted. Currency conversion to your base currency happens automatically.

## File Constraints

- File must be `.csv` format
- Maximum file size: **2 MB**
- UTF-8 encoding recommended
- Commas as delimiters (standard CSV)

## Import Behavior

- Each row is processed independently — **invalid rows do not block valid ones**
- Valid rows are inserted as transactions with automatic currency conversion
- The response includes a summary: count of imported rows, count of failed rows, and per-row error details
- Duplicate detection is **not** performed — importing the same file twice will create duplicate transactions

## Common Failure Cases

| Error | Cause | Fix |
|-------|-------|-----|
| `Category "X" not found` | The category name in CSV doesn't match any category in your account | Create the category first, or fix the spelling in the CSV |
| `Type "X" doesn't match category` | Row says `INCOME` but the category is an EXPENSE category (or vice versa) | Fix the `type` column or use the correct category |
| `Invalid date "X"` | Date string cannot be parsed | Use `YYYY-MM-DD` format |
| `Expected number, received nan` | Amount column is empty or non-numeric | Ensure amount is a plain number like `45.50` |
| `Invalid enum value` | Type column is not `INCOME` or `EXPENSE` | Fix the typo in the type column |
| `No file uploaded` | Request was sent without a file | Select a file before clicking Import |
| `Only .csv files are accepted` | File extension is not `.csv` | Rename or re-export as `.csv` |

## Sample CSV

```csv
date,amount,type,category,description,currency
2026-03-01,1200.00,INCOME,Salary,March salary,USD
2026-03-02,45.50,EXPENSE,Groceries,Weekly groceries,USD
2026-03-05,60.00,EXPENSE,Dining,Dinner out,EUR
```

A sample file is included at `sample-transactions.csv` in the project root.
