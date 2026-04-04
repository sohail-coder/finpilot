import { CategoryRepository } from "../repositories";
import { NotFoundError, ConflictError } from "../types/errors";

const categoryRepo = new CategoryRepository();

export class CategoryService {
  async list(userId: string) {
    return categoryRepo.findByUserId(userId);
  }

  async getById(id: string, userId: string) {
    const cat = await categoryRepo.findById(id, userId);
    if (!cat) throw new NotFoundError("Category", id);
    return cat;
  }

  async create(
    userId: string,
    data: {
      name: string;
      categoryType: "INCOME" | "EXPENSE";
      parentId?: string | null;
      color?: string;
      icon?: string;
    }
  ) {
    if (data.parentId) {
      const parent = await categoryRepo.findById(data.parentId, userId);
      if (!parent) throw new NotFoundError("Parent category", data.parentId);
      if (parent.categoryType !== data.categoryType) {
        throw new ConflictError(
          "Child category must have the same type as parent"
        );
      }
    }
    return categoryRepo.create({ userId, ...data });
  }

  async update(
    id: string,
    userId: string,
    data: { name?: string; color?: string; icon?: string }
  ) {
    const existing = await categoryRepo.findById(id, userId);
    if (!existing) throw new NotFoundError("Category", id);
    await categoryRepo.updateById(id, userId, data);
    return categoryRepo.findById(id, userId);
  }

  async delete(id: string, userId: string) {
    const existing = await categoryRepo.findById(id, userId);
    if (!existing) throw new NotFoundError("Category", id);

    const hasTxns = await categoryRepo.hasTransactions(id);
    if (hasTxns) {
      throw new ConflictError(
        "Cannot delete category with existing transactions"
      );
    }

    await categoryRepo.deleteById(id, userId);
  }
}
