import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  CefrLevel,
  Trivia,
  TriviaCategory,
  TriviaCategoryItem,
} from "../types";

export interface TriviaFilters {
  search: string;
  languageIds: string[];
  levels: CefrLevel[];
  categories: TriviaCategory[];
  forMeOnly: boolean;
}

function buildTriviaQuery(filters: TriviaFilters) {
  const params = new URLSearchParams();

  const search = filters.search.trim();
  if (search) {
    params.set("search", search);
  }
  if (filters.languageIds.length > 0) {
    params.set("language_ids", filters.languageIds.join(","));
  }
  if (filters.levels.length > 0) {
    params.set("levels", filters.levels.join(","));
  }
  if (filters.categories.length > 0) {
    params.set("categories", filters.categories.join(","));
  }
  if (filters.forMeOnly) {
    params.set("for_me_only", "true");
  }

  return params.toString();
}

export function useTrivias(filters: TriviaFilters) {
  const queryString = buildTriviaQuery(filters);

  const query = useQuery({
    queryKey: ["trivias", queryString],
    queryFn: () => {
      const path = queryString ? `/api/trivia?${queryString}` : "/api/trivia";
      return api.get<Trivia[]>(path);
    },
  });

  return {
    trivias: query.data ?? [],
    loading: query.isPending,
    error: query.error?.message ?? null,
  };
}

export function useTriviaCategories() {
  const query = useQuery({
    queryKey: ["trivia-categories"],
    queryFn: () => api.get<TriviaCategoryItem[]>("/api/trivia/categories"),
  });

  return {
    categories: query.data ?? [],
    loading: query.isPending,
    error: query.error?.message ?? null,
  };
}
