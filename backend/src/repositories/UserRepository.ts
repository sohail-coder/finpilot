import { BaseRepository } from "./BaseRepository";

export class UserRepository extends BaseRepository {
  async findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.db.user.findUnique({ where: { id, deletedAt: null } });
  }

  async create(data: { email: string; name: string; passwordHash: string | null; baseCurrency: string; googleId?: string }) {
    return this.db.user.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; baseCurrency: string; googleId: string }>) {
    return this.db.user.update({ where: { id }, data });
  }

  async updateById(id: string, data: Partial<{ name: string; baseCurrency: string }>) {
    return this.db.user.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return this.db.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
