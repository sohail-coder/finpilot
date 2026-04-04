import { useState } from "react";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "../hooks/useCategories";
import { extractErrorMessage } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import type { Category } from "../types";

const COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

export default function CategoriesPage() {
  const { data: categories, isLoading, error } = useCategories();
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();

  const [name, setName] = useState("");
  const [categoryType, setCategoryType] = useState<"INCOME" | "EXPENSE">(
    "EXPENSE"
  );
  const [color, setColor] = useState(COLORS[0]!);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [formError, setFormError] = useState("");

  const incomeCategories = categories?.filter(
    (c) => c.categoryType === "INCOME" && !c.parentId
  );
  const expenseCategories = categories?.filter(
    (c) => c.categoryType === "EXPENSE" && !c.parentId
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) return;
    try {
      await createMut.mutateAsync({ name: name.trim(), categoryType, color });
      setName("");
    } catch (err) {
      setFormError(extractErrorMessage(err, "Failed to create category"));
    }
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  }

  async function handleUpdate() {
    if (!editingId || !editName.trim()) return;
    try {
      await updateMut.mutateAsync({
        id: editingId,
        input: { name: editName.trim(), color: editColor },
      });
      setEditingId(null);
    } catch (err) {
      setFormError(extractErrorMessage(err, "Failed to update category"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteTarget(null);
      setFormError(extractErrorMessage(err, "Failed to delete category"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        Failed to load categories:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Categories</h1>

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={categoryType}
            onChange={(e) =>
              setCategoryType(e.target.value as "INCOME" | "EXPENSE")
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Color
          </label>
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition ${
                  color === c ? "border-gray-900 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={createMut.isPending}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMut.isPending ? "Adding..." : "Add Category"}
        </button>
      </form>

      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {formError}
          <button onClick={() => setFormError("")} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Category lists */}
      <div className="grid md:grid-cols-2 gap-6">
        <CategoryGroup
          title="Expense"
          categories={expenseCategories ?? []}
          editingId={editingId}
          editName={editName}
          editColor={editColor}
          onEditNameChange={setEditName}
          onEditColorChange={setEditColor}
          onStartEdit={startEdit}
          onSaveEdit={handleUpdate}
          onCancelEdit={() => setEditingId(null)}
          onDelete={setDeleteTarget}
          updatePending={updateMut.isPending}
        />
        <CategoryGroup
          title="Income"
          categories={incomeCategories ?? []}
          editingId={editingId}
          editName={editName}
          editColor={editColor}
          onEditNameChange={setEditName}
          onEditColorChange={setEditColor}
          onStartEdit={startEdit}
          onSaveEdit={handleUpdate}
          onCancelEdit={() => setEditingId(null)}
          onDelete={setDeleteTarget}
          updatePending={updateMut.isPending}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

function CategoryGroup({
  title,
  categories,
  editingId,
  editName,
  editColor,
  onEditNameChange,
  onEditColorChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  updatePending,
}: {
  title: string;
  categories: Category[];
  editingId: string | null;
  editName: string;
  editColor: string;
  onEditNameChange: (v: string) => void;
  onEditColorChange: (v: string) => void;
  onStartEdit: (cat: Category) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (cat: Category) => void;
  updatePending: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      {categories.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">No {title.toLowerCase()} categories yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="px-4 py-3 flex items-center justify-between gap-2"
            >
              {editingId === cat.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => onEditColorChange(e.target.value)}
                    className="w-7 h-7 rounded border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => onEditNameChange(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSaveEdit();
                      if (e.key === "Escape") onCancelEdit();
                    }}
                    autoFocus
                  />
                  <button
                    onClick={onSaveEdit}
                    disabled={updatePending}
                    className="text-xs text-indigo-600 font-medium hover:underline"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium text-gray-800">
                      {cat.name}
                    </span>
                    {cat.children.length > 0 && (
                      <span className="text-xs text-gray-400">
                        ({cat.children.length} sub)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStartEdit(cat)}
                      className="text-xs text-gray-500 hover:text-indigo-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(cat)}
                      className="text-xs text-gray-500 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
