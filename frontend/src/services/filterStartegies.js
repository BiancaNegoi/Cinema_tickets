// Strategy interface: filter(list) => newList

export class SearchFilterStrategy {
  constructor(searchText) {
    this.searchText = (searchText || "").toLowerCase().trim();
  }

  filter(list) {
    if (!this.searchText) return list;
    return list.filter(e =>
      (e.title || "").toLowerCase().includes(this.searchText)
    );
  }
}

export class GenreFilterStrategy {
  constructor(selectedGenre) {
    this.selectedGenre = selectedGenre || "Toate";
  }

  filter(list) {
    if (this.selectedGenre === "Toate") return list;

    const g = this.selectedGenre.toLowerCase();
    return list.filter(e => (e.genre || "").toLowerCase() === g);
  }
}

/**
 * Composite Strategy: aplică mai multe strategii de filtrare una după alta
 * (tot Strategy Pattern, doar că “compui” strategii).
 */
export class CompositeFilterStrategy {
  constructor(strategies = []) {
    this.strategies = strategies;
  }

  filter(list) {
    return this.strategies.reduce((acc, s) => s.filter(acc), list);
  }
}
