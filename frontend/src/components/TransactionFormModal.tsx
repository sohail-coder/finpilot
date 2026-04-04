import { useState, useMemo } from "react";
import type {
  Category,
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
} from "../types";
import { createCategory } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD"];

interface Props {
  categories: Category[];
  initialData: Transaction | null;
  onSubmit: (data: CreateTransactionInput | UpdateTransactionInput) => void;
  onCancel: () => void;
  pending: boolean;
  error: string;
}

export default function TransactionFormModal({
  categories,
  initialData,
  onSubmit,
  onCancel,
  pending,
  error,
}: Props) {
  // Derive initial type & parent from initialData
  const initCategory = categories.find(
    (c) => c.id === initialData?.categoryId,
  );
  const initParent = initCategory?.parentId
    ? categories.find((c) => c.id === initCategory.parentId)
    : initCategory;

  const [txnType, setTxnType] = useState<"EXPENSE" | "INCOME">(
    initParent?.categoryType ?? "EXPENSE",
  );
  const [parentCategoryId, setParentCategoryId] = useState(
    initParent?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? "");
  const [amount, setAmount] = useState(
    initialData ? String(Number(initialData.amount)) : "",
  );
  const [currency, setCurrency] = useState(initialData?.currency ?? "USD");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [transactionDate, setTransactionDate] = useState(
    initialData
      ? (new Date(initialData.transactionDate).toISOString().split("T")[0] ??
          "")
      : (new Date().toISOString().split("T")[0] ?? ""),
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [tags, setTags] = useState(initialData?.tags?.join(", ") ?? "");

  // Category creation
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // Subcategory creation
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [addingSubcat, setAddingSubcat] = useState(false);
  const queryClient = useQueryClient();

  // Derived lists
  const topLevel = useMemo(
    () =>
      categories.filter(
        (c) => c.parentId === null && c.categoryType === txnType,
      ),
    [categories, txnType],
  );

  const subcategories = useMemo(() => {
    if (!parentCategoryId) return [];
    const parent = categories.find((c) => c.id === parentCategoryId);
    return parent?.children ?? [];
  }, [categories, parentCategoryId]);

  // Reset dependent fields when type changes
  function handleTypeChange(type: "EXPENSE" | "INCOME") {
    setTxnType(type);
    setParentCategoryId("");
    setCategoryId("");
    setShowAddCat(false);
    setShowAddSub(false);
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const cat = await createCategory({
        name: newCatName.trim(),
        categoryType: txnType,
      });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setParentCategoryId(cat.id);
      setCategoryId("");
      setNewCatName("");
      setShowAddCat(false);
    } catch {
      // Silently fail
    } finally {
      setAddingCat(false);
    }
  }

  // Reset subcategory when parent changes
  function handleParentChange(id: string) {
    setParentCategoryId(id);
    setCategoryId("");
    setShowAddSub(false);
  }

  async function handleAddSubcategory() {
    if (!newSubName.trim() || !parentCategoryId) return;
    setAddingSubcat(true);
    try {
      const sub = await createCategory({
        name: newSubName.trim(),
        categoryType: txnType,
        parentId: parentCategoryId,
      });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryId(sub.id);
      setNewSubName("");
      setShowAddSub(false);
    } catch {
      // Silently fail — the category list will stay as-is
    } finally {
      setAddingSubcat(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const effectiveCategoryId = categoryId || parentCategoryId;

    if (initialData) {
      const payload: UpdateTransactionInput = {};
      if (effectiveCategoryId && effectiveCategoryId !== initialData.categoryId)
        payload.categoryId = effectiveCategoryId;
      if (amount && Number(amount) !== Number(initialData.amount))
        payload.amount = Number(amount);
      if (currency !== initialData.currency) payload.currency = currency;
      if (description !== (initialData.description ?? ""))
        payload.description = description || undefined;
      if (
        transactionDate !==
        new Date(initialData.transactionDate).toISOString().split("T")[0]
      )
        payload.transactionDate = transactionDate;
      if (notes !== (initialData.notes ?? ""))
        payload.notes = notes || undefined;
      payload.tags = parsedTags.length > 0 ? parsedTags : undefined;
      onSubmit(payload);
    } else {
      onSubmit({
        categoryId: effectiveCategoryId,
        amount: Number(amount),
        currency,
        description: description || undefined,
        transactionDate,
        notes: notes || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      } as CreateTransactionInput);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          {initialData ? "Edit Transaction" : "New Transaction"}
        </h3>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 mb-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("EXPENSE")}
                className={`flex-1 py-2 text-sm font-medium rounded-md border transition ${
                  txnType === "EXPENSE"
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("INCOME")}
                className={`flex-1 py-2 text-sm font-medium rounded-md border transition ${
                  txnType === "INCOME"
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                }`}
              >
                Income
              </button>
            </div>
          </div>

          {/* Category + Subcategory Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={parentCategoryId}
                onChange={(e) => handleParentChange(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select category...</option>
                {topLevel.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!showAddCat && (
                <button
                  type="button"
                  onClick={() => setShowAddCat(true)}
                  className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  + Add Category
                </button>
              )}
              {showAddCat && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={addingCat || !newCatName.trim()}
                    className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {addingCat ? "..." : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCat(false);
                      setNewCatName("");
                    }}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subcategory
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={!parentCategoryId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {parentCategoryId
                    ? "Select subcategory..."
                    : "Pick a category first"}
                </option>
                {subcategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {parentCategoryId && !showAddSub && (
                <button
                  type="button"
                  onClick={() => setShowAddSub(true)}
                  className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  + Add Subcategory
                </button>
              )}
              {showAddSub && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="Subcategory name"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcategory}
                    disabled={addingSubcat || !newSubName.trim()}
                    className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {addingSubcat ? "..." : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSub(false);
                      setNewSubName("");
                    }}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required={!initialData}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required={!initialData}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags{" "}
              <span className="text-gray-400 font-normal">
                (comma-separated)
              </span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="groceries, weekly"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "Saving..." : initialData ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
