import type { PaginationMeta } from "../api/types";

type PaginationProps = {
    pagination: PaginationMeta;
    disabled?: boolean;
    onPageChange: (page: number) => void;
};

export function Pagination({
    pagination,
    disabled = false,
    onPageChange
}: PaginationProps) {
    const hasItems =
        pagination.totalItems > 0 &&
        pagination.totalPages > 0;

    const currentPage = hasItems
        ? Math.min(
            pagination.page,
            pagination.totalPages
        )
        : 0;

    return (
        <div className="pagination">
            <button
                type="button"
                disabled={
                    disabled ||
                    !hasItems ||
                    currentPage <= 1
                }
                onClick={() =>
                    onPageChange(
                        currentPage - 1
                    )
                }
            >
                Previous
            </button>

            <span>
                {hasItems
                    ? `Page ${currentPage} of ${pagination.totalPages}`
                    : "Page 0 of 0"}
                {" · "}
                {pagination.totalItems} item(s)
            </span>

            <button
                type="button"
                disabled={
                    disabled ||
                    !hasItems ||
                    currentPage >=
                        pagination.totalPages
                }
                onClick={() =>
                    onPageChange(
                        currentPage + 1
                    )
                }
            >
                Next
            </button>
        </div>
    );
}