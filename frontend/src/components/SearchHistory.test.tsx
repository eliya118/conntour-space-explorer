import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { deleteSearch } from "../api/client";
import { SearchSummary } from "../types";
import SearchHistory from "./SearchHistory";

jest.mock("../api/client", () => ({
  deleteSearch: jest.fn(),
  errorMessage: () => "error",
  fetchSearches: jest.fn(),
}));

jest.mock("../api/usePagedQuery", () => ({
  usePagedQuery: () => ({
    data: {
      pages: [
        {
          items: [
            {
              id: 7,
              query: "mars rover",
              created_at: "2018-06-25T00:00:00.000Z",
            },
          ],
          total: 1,
          limit: 24,
          offset: 0,
        },
      ],
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    error: null,
  }),
}));

jest.mock("./VirtualGrid", () => ({
  __esModule: true,
  default: ({
    items,
    renderItem,
  }: {
    items: SearchSummary[];
    renderItem: (item: SearchSummary) => React.ReactNode;
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.id}>{renderItem(item)}</div>
      ))}
    </div>
  ),
}));

const savedSearch: SearchSummary = {
  id: 7,
  query: "mars rover",
  created_at: "2018-06-25T00:00:00.000Z",
};

function renderHistory(onSelect = jest.fn(), onDeleted = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SearchHistory activeSearchId={null} onSelect={onSelect} onDeleted={onDeleted} onClose={jest.fn()} />
    </QueryClientProvider>,
  );
  return { onSelect, onDeleted };
}

test("a history row shows the query and time and can be reopened or deleted", async () => {
  (deleteSearch as jest.Mock).mockResolvedValue(undefined);
  const { onSelect, onDeleted } = renderHistory();

  expect(screen.getByText("mars rover")).toBeInTheDocument();
  expect(screen.getByText(new Date(savedSearch.created_at).toLocaleString())).toBeInTheDocument();
  expect(screen.queryByText(/results/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^mars rover/i }));
  expect(onSelect).toHaveBeenCalledWith(savedSearch);

  fireEvent.click(screen.getByRole("button", { name: "Delete search mars rover" }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(7));
});
