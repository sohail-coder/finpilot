import { Readable } from "stream";
import csvParser from "csv-parser";
import { z } from "zod";

const csvRowSchema = z.object({
  date: z.string().min(1),
  amount: z.string().transform(Number).pipe(z.number()),
  type: z.string().toUpperCase().pipe(z.enum(["INCOME", "EXPENSE"])),
  category: z.string().min(1),
  description: z.string().optional().default(""),
  currency: z.string().length(3).optional().default("USD"),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

export interface CsvParseResult {
  validRows: CsvRow[];
  errors: { row: number; message: string }[];
}

export function parseCsvBuffer(buffer: Buffer): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    const validRows: CsvRow[] = [];
    const errors: { row: number; message: string }[] = [];
    let rowIndex = 0;

    const stream = Readable.from(buffer);
    stream
      .pipe(csvParser())
      .on("data", (raw: Record<string, string>) => {
        rowIndex++;
        const result = csvRowSchema.safeParse(raw);
        if (result.success) {
          validRows.push(result.data);
        } else {
          errors.push({
            row: rowIndex,
            message: result.error.issues.map((i) => i.message).join("; "),
          });
        }
      })
      .on("end", () => resolve({ validRows, errors }))
      .on("error", reject);
  });
}
