import { BaseRepository } from "./BaseRepository";

export class CategoryRepository extends BaseRepository {
  async findByUserId(userId: string) {
    return this.db.category.findMany({
      where: { userId },
      include: { children: true },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string, userId: string) {
    return this.db.category.findFirst({
      where: { id, userId },
      include: { children: true },
    });
  }

  async create(data: {
    userId: string;
    name: string;
    categoryType: "INCOME" | "EXPENSE";
    parentId?: string | null;
    color?: string;
    icon?: string;
  }) {
    return this.db.category.create({
      data: {
        userId: data.userId,
        name: data.name,
        categoryType: data.categoryType,
        parentId: data.parentId ?? null,
        color: data.color,
        icon: data.icon,
      },
      include: { children: true },
    });
  }

  async updateById(
    id: string,
    userId: string,
    data: { name?: string; color?: string; icon?: string }
  ) {
    return this.db.category.updateMany({ where: { id, userId }, data });
  }

  async deleteById(id: string, userId: string) {
    return this.db.category.deleteMany({ where: { id, userId } });
  }

  async hasTransactions(id: string) {
    const count = await this.db.transaction.count({ where: { categoryId: id } });
    return count > 0;
  }
}
