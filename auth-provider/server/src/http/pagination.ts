import { z } from "zod";

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type PaginationMeta = {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
};

export function getPaginationOffset(page: number, pageSize: number) {
    return (page - 1) * pageSize;
}

export function createPaginationMeta(
    page: number,
    pageSize: number,
    totalItems: number
): PaginationMeta {
    return {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize)
    };
}