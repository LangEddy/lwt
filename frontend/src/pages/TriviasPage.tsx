import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguages } from "../hooks/useLanguages";
import { useTriviaCategories, useTrivias } from "../hooks/useTrivias";
import type {
  CefrLevel,
  Trivia,
  TriviaCategory,
  TriviaCategoryItem,
} from "../types";

const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const DEFAULT_CATEGORY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>';
const DEFAULT_CATEGORY_COLOR = "var(--color-text2)";
const DEFAULT_CATEGORY_BG = "var(--color-bg2)";

const CEFR_STYLE: Record<CefrLevel, { bg: string; text: string }> = {
  A1: { bg: "oklch(92% 0.06 145)", text: "oklch(35% 0.13 145)" },
  A2: { bg: "oklch(88% 0.08 145)", text: "oklch(32% 0.14 145)" },
  B1: { bg: "oklch(92% 0.06 75)", text: "oklch(38% 0.13 75)" },
  B2: { bg: "oklch(88% 0.08 75)", text: "oklch(35% 0.14 75)" },
  C1: { bg: "oklch(90% 0.06 25)", text: "oklch(36% 0.14 25)" },
  C2: { bg: "oklch(86% 0.08 25)", text: "oklch(33% 0.15 25)" },
};

export default function TriviasPage() {
  const navigate = useNavigate();
  const { languages } = useLanguages();
  const { categories, loading: categoriesLoading } = useTriviaCategories();

  const [search, setSearch] = useState("");
  const [selectedLanguageIds, setSelectedLanguageIds] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<CefrLevel[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<
    TriviaCategory[]
  >([]);
  const [forMeOnly, setForMeOnly] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const filters = useMemo(
    () => ({
      search,
      languageIds: selectedLanguageIds,
      levels: selectedLevels,
      categories: selectedCategories,
      forMeOnly,
    }),
    [
      search,
      selectedLanguageIds,
      selectedLevels,
      selectedCategories,
      forMeOnly,
    ],
  );

  const { trivias, loading } = useTrivias(filters);

  const categoryBySlug = useMemo(() => {
    const map = new Map<TriviaCategory, TriviaCategoryItem>();
    for (const category of categories) {
      map.set(category.slug, category);
    }
    return map;
  }, [categories]);

  const languageNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const lang of languages) {
      map.set(lang.id, lang.name);
    }
    return map;
  }, [languages]);

  const activeFilterCount =
    selectedLanguageIds.length +
    selectedLevels.length +
    selectedCategories.length +
    (forMeOnly ? 1 : 0);

  const clearFilters = () => {
    setSelectedLanguageIds([]);
    setSelectedLevels([]);
    setSelectedCategories([]);
    setForMeOnly(false);
  };

  const toggleLanguage = (languageId: string) => {
    setSelectedLanguageIds((prev) =>
      prev.includes(languageId)
        ? prev.filter((id) => id !== languageId)
        : [...prev, languageId],
    );
  };

  const toggleLevel = (level: CefrLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(level)
        ? prev.filter((candidate) => candidate !== level)
        : [...prev, level],
    );
  };

  const toggleCategory = (category: TriviaCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((candidate) => candidate !== category)
        : [...prev, category],
    );
  };

  const isLoading = loading || categoriesLoading;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-2.5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text3)]"
            />
            <input
              placeholder="Search trivia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] text-[var(--color-text3)] font-medium">
              {trivias.length} trivia{trivias.length !== 1 ? "s" : ""}
            </div>
            <button
              onClick={() => setFilterSheetOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border-[1.5px] text-[13px] font-semibold transition-colors ${
                activeFilterCount > 0
                  ? "bg-[var(--color-text)] text-[var(--color-surface)] border-[var(--color-text)]"
                  : "bg-[var(--color-surface)] text-[var(--color-text2)] border-[var(--color-border)] hover:bg-[var(--color-bg)]"
              }`}
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold bg-[var(--color-green)] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="max-w-[1100px] mx-auto flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategories([])}
            className="px-3 py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold shrink-0 transition-colors"
            style={{
              borderColor:
                selectedCategories.length === 0
                  ? "var(--color-text)"
                  : "var(--color-border)",
              background:
                selectedCategories.length === 0
                  ? "var(--color-text)"
                  : "var(--color-surface)",
              color:
                selectedCategories.length === 0
                  ? "var(--color-surface)"
                  : "var(--color-text2)",
            }}
          >
            All topics
          </button>
          {categories.map((category) => {
            const active = selectedCategories.includes(category.slug);
            const color = category.color || DEFAULT_CATEGORY_COLOR;
            const background = category.bg_color || DEFAULT_CATEGORY_BG;
            return (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.slug)}
                className="px-3 py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold shrink-0 transition-colors inline-flex items-center gap-1.5"
                style={{
                  borderColor: active ? color : "var(--color-border)",
                  background: active ? background : "var(--color-surface)",
                  color: active ? color : "var(--color-text2)",
                }}
              >
                <CategoryIcon
                  iconSvg={category.icon_svg}
                  color="currentColor"
                />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="max-w-[1100px] mx-auto flex flex-wrap items-center gap-1.5">
            {selectedLanguageIds.map((languageId) => (
              <FilterChip
                key={languageId}
                label={languageNameById.get(languageId) ?? "Language"}
                onRemove={() => toggleLanguage(languageId)}
              />
            ))}
            {selectedLevels.map((level) => (
              <FilterChip
                key={level}
                label={level}
                onRemove={() => toggleLevel(level)}
              />
            ))}
            {selectedCategories.map((category) => (
              <FilterChip
                key={category}
                label={categoryBySlug.get(category)?.name ?? category}
                onRemove={() => toggleCategory(category)}
              />
            ))}
            {forMeOnly && (
              <FilterChip
                label="For me only"
                onRemove={() => setForMeOnly(false)}
              />
            )}
            <button
              onClick={clearFilters}
              className="text-[12px] font-medium text-[var(--color-text2)] underline px-1"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div
          className="max-w-[1100px] mx-auto grid gap-2.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          }}
        >
          {isLoading && (
            <div className="col-[1/-1] text-center py-10 text-[var(--color-text3)]">
              Loading...
            </div>
          )}

          {!isLoading &&
            trivias.map((trivia) => (
              <TriviaCard
                key={trivia.id}
                trivia={trivia}
                category={categoryBySlug.get(trivia.category)}
                onOpen={() => navigate(`/trivia/${trivia.id}`)}
              />
            ))}

          {!isLoading && trivias.length === 0 && (
            <div className="col-[1/-1] text-center py-14 text-[var(--color-text3)]">
              <Search size={36} className="mx-auto mb-2.5" />
              <p className="text-[15px]">No trivia matches your filters.</p>
              <button
                onClick={() => {
                  setSearch("");
                  clearFilters();
                }}
                className="mt-2 text-[14px] text-[var(--color-text2)] underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {filterSheetOpen && (
        <FilterSheet
          languages={languages}
          selectedLanguageIds={selectedLanguageIds}
          selectedLevels={selectedLevels}
          categories={categories}
          selectedCategories={selectedCategories}
          forMeOnly={forMeOnly}
          onToggleLanguage={toggleLanguage}
          onToggleLevel={toggleLevel}
          onToggleCategory={toggleCategory}
          onSetForMeOnly={setForMeOnly}
          onClear={clearFilters}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </div>
  );
}

function TriviaCard({
  trivia,
  category,
  onOpen,
}: {
  trivia: Trivia;
  category?: TriviaCategoryItem;
  onOpen: () => void;
}) {
  const categoryName =
    category?.name ?? trivia.category_name ?? trivia.category;
  const categoryIconSvg =
    category?.icon_svg ?? trivia.category_icon_svg ?? DEFAULT_CATEGORY_ICON;
  const categoryColor =
    category?.color ?? trivia.category_color ?? DEFAULT_CATEGORY_COLOR;
  const categoryBg =
    category?.bg_color ?? trivia.category_bg_color ?? DEFAULT_CATEGORY_BG;
  const levelStyle = CEFR_STYLE[trivia.cefr_level];

  return (
    <button
      onClick={onOpen}
      className="group text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] p-3.5 hover:bg-[var(--color-bg)] transition-colors"
    >
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: categoryBg, color: categoryColor }}
        >
          <CategoryIcon
            iconSvg={categoryIconSvg}
            color="currentColor"
            size={20}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[11px] font-bold tracking-wider bg-[var(--color-bg2)] text-[var(--color-text2)] px-1.5 py-0.5 rounded-md uppercase">
              {trivia.language_code}
            </span>
            <span
              className="text-[11px] font-bold tracking-wider px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: levelStyle.bg, color: levelStyle.text }}
            >
              {trivia.cefr_level}
            </span>
            <span className="text-[11px] text-[var(--color-text3)]">
              {categoryName}
            </span>
          </div>
          <h3
            className="font-bold text-[15px] leading-snug"
            dir={trivia.direction}
            lang={trivia.language_code}
          >
            {trivia.title}
          </h3>
          {trivia.subtitle && (
            <p className="text-[13px] text-[var(--color-text2)] leading-snug mt-0.5">
              {trivia.subtitle}
            </p>
          )}
        </div>
      </div>
      <p
        className="text-[13px] text-[var(--color-text3)] leading-relaxed line-clamp-2"
        dir={trivia.direction}
        lang={trivia.language_code}
      >
        {trivia.content}
      </p>
    </button>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-[var(--color-bg2)] text-[12px] font-semibold text-[var(--color-text)]">
      {label}
      <button
        onClick={onRemove}
        className="p-1 rounded-full hover:bg-white/60 text-[var(--color-text2)]"
      >
        <X size={12} />
      </button>
    </span>
  );
}

interface FilterSheetProps {
  languages: Array<{ id: string; name: string; is_favorite: boolean }>;
  categories: TriviaCategoryItem[];
  selectedLanguageIds: string[];
  selectedLevels: CefrLevel[];
  selectedCategories: TriviaCategory[];
  forMeOnly: boolean;
  onToggleLanguage: (languageId: string) => void;
  onToggleLevel: (level: CefrLevel) => void;
  onToggleCategory: (category: TriviaCategory) => void;
  onSetForMeOnly: (next: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}

function FilterSheet({
  languages,
  categories,
  selectedLanguageIds,
  selectedLevels,
  selectedCategories,
  forMeOnly,
  onToggleLanguage,
  onToggleLevel,
  onToggleCategory,
  onSetForMeOnly,
  onClear,
  onClose,
}: FilterSheetProps) {
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/35 backdrop-blur-sm z-[200]"
      />
      <div className="fixed left-1/2 bottom-0 -translate-x-1/2 w-full max-w-[560px] bg-[var(--color-surface)] rounded-t-[20px] z-[201] p-5 pb-6 max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="w-10 h-1 rounded-full bg-[var(--color-border)] mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold tracking-tight">Filters</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-[8px] bg-[var(--color-bg2)] text-[var(--color-text2)]"
          >
            <X size={14} />
          </button>
        </div>

        <label
          className="flex items-center gap-2.5 p-3 rounded-[10px] border-[1.5px] cursor-pointer mb-4"
          style={{
            borderColor: forMeOnly
              ? "var(--color-text)"
              : "var(--color-border)",
            background: forMeOnly ? "var(--color-bg2)" : "var(--color-bg)",
          }}
        >
          <input
            type="checkbox"
            checked={forMeOnly}
            onChange={(e) => onSetForMeOnly(e.target.checked)}
            className="accent-[var(--color-text)]"
          />
          <div>
            <p className="text-[14px] font-semibold">For me only</p>
            <p className="text-[12px] text-[var(--color-text3)]">
              Restrict results to your favorite languages and preferred CEFR
              levels.
            </p>
          </div>
        </label>

        <FilterGroup title="Languages">
          {languages.map((language) => {
            const active = selectedLanguageIds.includes(language.id);
            return (
              <FilterPill
                key={language.id}
                active={active}
                onClick={() => onToggleLanguage(language.id)}
              >
                {language.name}
              </FilterPill>
            );
          })}
        </FilterGroup>

        <FilterGroup title="CEFR Level">
          {CEFR_LEVELS.map((level) => {
            const active = selectedLevels.includes(level);
            const style = CEFR_STYLE[level];
            return (
              <button
                key={level}
                onClick={() => onToggleLevel(level)}
                className="px-3 py-1.5 rounded-full border-[1.5px] text-[13px] font-bold transition-colors"
                style={{
                  borderColor: active ? style.text : "var(--color-border)",
                  backgroundColor: active ? style.bg : "var(--color-surface)",
                  color: active ? style.text : "var(--color-text2)",
                }}
              >
                {level}
              </button>
            );
          })}
        </FilterGroup>

        <FilterGroup title="Topics">
          {categories.map((category) => {
            const active = selectedCategories.includes(category.slug);
            const color = category.color || DEFAULT_CATEGORY_COLOR;
            const background = category.bg_color || DEFAULT_CATEGORY_BG;
            return (
              <button
                key={category.id}
                onClick={() => onToggleCategory(category.slug)}
                className="px-3 py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold transition-colors inline-flex items-center gap-1.5"
                style={{
                  borderColor: active ? color : "var(--color-border)",
                  backgroundColor: active ? background : "var(--color-surface)",
                  color: active ? color : "var(--color-text2)",
                }}
              >
                <CategoryIcon
                  iconSvg={category.icon_svg}
                  color="currentColor"
                />
                {category.name}
              </button>
            );
          })}
        </FilterGroup>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClear}
            className="flex-1 py-2.5 rounded-[10px] border-[1.5px] border-[var(--color-border)] text-[14px] font-semibold text-[var(--color-text2)]"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="flex-[2] py-2.5 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] text-[14px] font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-[11px] font-bold tracking-widest uppercase text-[var(--color-text3)] mb-2">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold transition-colors"
      style={{
        borderColor: active ? "var(--color-text)" : "var(--color-border)",
        backgroundColor: active ? "var(--color-text)" : "var(--color-surface)",
        color: active ? "var(--color-surface)" : "var(--color-text2)",
      }}
    >
      {children}
    </button>
  );
}

function CategoryIcon({
  iconSvg,
  color,
  size = 14,
}: {
  iconSvg?: string;
  color: string;
  size?: number;
}) {
  // Icons are authored in trivia_categories and treated as trusted SVG snippets.
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-current [&>svg]:fill-none"
      style={{ width: size, height: size, color }}
      dangerouslySetInnerHTML={{ __html: iconSvg || DEFAULT_CATEGORY_ICON }}
    />
  );
}
