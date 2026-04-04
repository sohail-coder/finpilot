import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── 1. Users ──────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      name: "Alice Johnson",
      passwordHash,
      baseCurrency: "USD",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      name: "Bob Smith",
      passwordHash,
      baseCurrency: "EUR",
    },
  });

  console.log(`✓ Users: ${alice.name}, ${bob.name}`);

  // ── 2. Categories (with subcategories) ────────────────────
  const categoryData = [
    // Income categories
    { name: "Salary", categoryType: "INCOME", color: "#22C55E", isDefault: true },
    { name: "Freelance", categoryType: "INCOME", color: "#10B981", isDefault: true },
    { name: "Investments", categoryType: "INCOME", color: "#14B8A6", isDefault: true },
    // Expense parent categories
    { name: "Food & Dining", categoryType: "EXPENSE", color: "#EF4444", isDefault: true },
    { name: "Transportation", categoryType: "EXPENSE", color: "#F97316", isDefault: true },
    { name: "Housing", categoryType: "EXPENSE", color: "#8B5CF6", isDefault: true },
    { name: "Utilities", categoryType: "EXPENSE", color: "#6366F1", isDefault: true },
    { name: "Entertainment", categoryType: "EXPENSE", color: "#EC4899", isDefault: true },
    { name: "Healthcare", categoryType: "EXPENSE", color: "#06B6D4", isDefault: true },
    { name: "Shopping", categoryType: "EXPENSE", color: "#F59E0B", isDefault: true },
    { name: "Education", categoryType: "EXPENSE", color: "#3B82F6", isDefault: true },
  ];

  const categories: Record<string, string> = {}; // name → id

  for (const cat of categoryData) {
    const created = await prisma.category.upsert({
      where: {
        userId_name_parentId: { userId: alice.id, name: cat.name, parentId: null as unknown as string },
      },
      update: {},
      create: { userId: alice.id, ...cat },
    });
    categories[cat.name] = created.id;
  }

  // Subcategories
  const subcategories = [
    { name: "Groceries", parentName: "Food & Dining" },
    { name: "Restaurants", parentName: "Food & Dining" },
    { name: "Coffee Shops", parentName: "Food & Dining" },
    { name: "Gas", parentName: "Transportation" },
    { name: "Public Transit", parentName: "Transportation" },
    { name: "Rent", parentName: "Housing" },
    { name: "Maintenance", parentName: "Housing" },
    { name: "Electricity", parentName: "Utilities" },
    { name: "Internet", parentName: "Utilities" },
  ];

  for (const sub of subcategories) {
    const parentId = categories[sub.parentName];
    const created = await prisma.category.upsert({
      where: {
        userId_name_parentId: { userId: alice.id, name: sub.name, parentId },
      },
      update: {},
      create: {
        userId: alice.id,
        name: sub.name,
        parentId,
        categoryType: "EXPENSE",
        isDefault: true,
      },
    });
    categories[sub.name] = created.id;
  }

  console.log(`✓ Categories: ${Object.keys(categories).length} total (${subcategories.length} subcategories)`);

  // ── 3. Transactions (3 months of data) ────────────────────
  const now = new Date();
  const transactions: Prisma.TransactionCreateManyInput[] = [
    // Current month
    { userId: alice.id, categoryId: categories["Salary"], amount: 5000, baseCurrencyAmount: 5000, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 1), transactionType: "INCOME", description: "Monthly salary" },
    { userId: alice.id, categoryId: categories["Freelance"], amount: 1200, baseCurrencyAmount: 1200, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 5), transactionType: "INCOME", description: "Web design project" },
    { userId: alice.id, categoryId: categories["Groceries"], amount: 320, baseCurrencyAmount: 320, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 3), transactionType: "EXPENSE", description: "Weekly groceries", tags: ["essentials"] },
    { userId: alice.id, categoryId: categories["Restaurants"], amount: 85, baseCurrencyAmount: 85, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 7), transactionType: "EXPENSE", description: "Dinner with friends" },
    { userId: alice.id, categoryId: categories["Rent"], amount: 1500, baseCurrencyAmount: 1500, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 1), transactionType: "EXPENSE", description: "Monthly rent", isRecurring: true },
    { userId: alice.id, categoryId: categories["Electricity"], amount: 95, baseCurrencyAmount: 95, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 10), transactionType: "EXPENSE", description: "Electricity bill" },
    { userId: alice.id, categoryId: categories["Internet"], amount: 60, baseCurrencyAmount: 60, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 10), transactionType: "EXPENSE", description: "Internet bill", isRecurring: true },
    { userId: alice.id, categoryId: categories["Entertainment"], amount: 45, baseCurrencyAmount: 45, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 12), transactionType: "EXPENSE", description: "Movie tickets" },
    { userId: alice.id, categoryId: categories["Gas"], amount: 55, baseCurrencyAmount: 55, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 8), transactionType: "EXPENSE", description: "Gas fill-up" },
    { userId: alice.id, categoryId: categories["Shopping"], amount: 200, baseCurrencyAmount: 200, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth(), 14), transactionType: "EXPENSE", description: "New headphones", tags: ["electronics"] },
    // Previous month
    { userId: alice.id, categoryId: categories["Salary"], amount: 5000, baseCurrencyAmount: 5000, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth() - 1, 1), transactionType: "INCOME", description: "Monthly salary" },
    { userId: alice.id, categoryId: categories["Groceries"], amount: 280, baseCurrencyAmount: 280, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth() - 1, 4), transactionType: "EXPENSE", description: "Weekly groceries" },
    { userId: alice.id, categoryId: categories["Rent"], amount: 1500, baseCurrencyAmount: 1500, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth() - 1, 1), transactionType: "EXPENSE", description: "Monthly rent", isRecurring: true },
    { userId: alice.id, categoryId: categories["Healthcare"], amount: 150, baseCurrencyAmount: 150, currency: "USD", exchangeRate: 1, transactionDate: new Date(now.getFullYear(), now.getMonth() - 1, 15), transactionType: "EXPENSE", description: "Doctor visit" },
    // Multi-currency transaction (Bob uses EUR)
    { userId: bob.id, categoryId: categories["Salary"] || "", amount: 4200, baseCurrencyAmount: 4578, currency: "EUR", exchangeRate: new Prisma.Decimal("1.090000"), transactionDate: new Date(now.getFullYear(), now.getMonth(), 1), transactionType: "INCOME", description: "Monthly salary" },
  ];

  // Bob needs his own categories first
  const bobSalary = await prisma.category.upsert({
    where: { userId_name_parentId: { userId: bob.id, name: "Salary", parentId: null as unknown as string } },
    update: {},
    create: { userId: bob.id, name: "Salary", categoryType: "INCOME", color: "#22C55E", isDefault: true },
  });
  // Fix Bob's transaction to use his own category
  transactions[transactions.length - 1].categoryId = bobSalary.id;

  await prisma.transaction.createMany({ data: transactions, skipDuplicates: true });
  console.log(`✓ Transactions: ${transactions.length} records`);

  // ── 4. Budgets (current month) ────────────────────────────
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const budgets: Prisma.BudgetCreateManyInput[] = [
    { userId: alice.id, categoryId: categories["Food & Dining"], amount: 500, month: currentMonth },
    { userId: alice.id, categoryId: categories["Transportation"], amount: 200, month: currentMonth },
    { userId: alice.id, categoryId: categories["Entertainment"], amount: 100, month: currentMonth },
    { userId: alice.id, categoryId: categories["Shopping"], amount: 300, month: currentMonth },
    { userId: alice.id, categoryId: categories["Utilities"], amount: 200, month: currentMonth },
  ];

  await prisma.budget.createMany({ data: budgets, skipDuplicates: true });
  console.log(`✓ Budgets: ${budgets.length} for current month`);

  // ── 5. Exchange Rates ─────────────────────────────────────
  const rates: Prisma.ExchangeRateCreateManyInput[] = [
    { baseCurrency: "EUR", targetCurrency: "USD", rate: 1.09 },
    { baseCurrency: "GBP", targetCurrency: "USD", rate: 1.27 },
    { baseCurrency: "INR", targetCurrency: "USD", rate: 0.012 },
    { baseCurrency: "JPY", targetCurrency: "USD", rate: 0.0067 },
    { baseCurrency: "CAD", targetCurrency: "USD", rate: 0.74 },
    { baseCurrency: "AUD", targetCurrency: "USD", rate: 0.65 },
    // Reverse rates
    { baseCurrency: "USD", targetCurrency: "EUR", rate: 0.917 },
    { baseCurrency: "USD", targetCurrency: "GBP", rate: 0.787 },
    { baseCurrency: "USD", targetCurrency: "INR", rate: 83.12 },
    { baseCurrency: "USD", targetCurrency: "JPY", rate: 149.5 },
    { baseCurrency: "USD", targetCurrency: "CAD", rate: 1.351 },
    { baseCurrency: "USD", targetCurrency: "AUD", rate: 1.538 },
  ];

  await prisma.exchangeRate.createMany({ data: rates, skipDuplicates: true });
  console.log(`✓ Exchange rates: ${rates.length} pairs`);

  // ── 6. Bank Sync Log (sample CSV import) ──────────────────
  await prisma.bankSyncLog.create({
    data: {
      userId: alice.id,
      fileName: "bank-statement-march.csv",
      source: "CSV",
      transactionCount: 5,
      status: "SUCCESS",
    },
  });
  console.log("✓ Bank sync log: 1 sample import");

  // ── 7. AI Recommendation (sample) ────────────────────────
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  await prisma.aIRecommendation.create({
    data: {
      userId: alice.id,
      month: prevMonth,
      inputSummary: {
        "Food & Dining": 450,
        Transportation: 180,
        Entertainment: 120,
        Shopping: 350,
        Utilities: 155,
      },
      recommendations: [
        {
          category: "Food & Dining",
          currentSpending: 450,
          suggestedTarget: 380,
          potentialSavings: 70,
          rationale: "Reducing restaurant visits from 3x to 1x per week could save ~$70/month.",
        },
        {
          category: "Shopping",
          currentSpending: 350,
          suggestedTarget: 250,
          potentialSavings: 100,
          rationale: "Applying a 24-hour cooling-off rule before non-essential purchases can curb impulse spending.",
        },
        {
          category: "Entertainment",
          currentSpending: 120,
          suggestedTarget: 80,
          potentialSavings: 40,
          rationale: "Consider free community events and library resources as alternatives.",
        },
      ],
      totalSavings: 210,
      status: "GENERATED",
    },
  });
  console.log("✓ AI recommendations: 1 sample history entry");

  // ── 8. Audit Log (sample) ─────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId: alice.id,
      entityType: "User",
      entityId: alice.id,
      action: "REGISTER",
      newValues: { email: alice.email, name: alice.name },
    },
  });
  console.log("✓ Audit log: 1 sample entry");

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
