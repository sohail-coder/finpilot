import { BaseRepository } from "./BaseRepository";
import type { Prisma } from "@prisma/client";

export class AIRecommendationRepository extends BaseRepository {
  async create(data: {
    userId: string;
    month: Date;
    inputSummary: Prisma.InputJsonValue;
    recommendations: Prisma.InputJsonValue;
    totalSavings: number;
    status: string;
  }) {
    return this.db.aIRecommendation.create({ data });
  }

  async findByUserId(userId: string) {
    return this.db.aIRecommendation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateStatus(id: string, userId: string, status: string) {
    return this.db.aIRecommendation.updateMany({
      where: { id, userId },
      data: { status },
    });
  }

  async deleteByIdAndUser(id: string, userId: string) {
    return this.db.aIRecommendation.deleteMany({
      where: { id, userId },
    });
  }
}
