export class MovieListService {
  constructor({ filterStrategy, sortStrategy }) {
    this.filterStrategy = filterStrategy;
    this.sortStrategy = sortStrategy;
  }

  setFilterStrategy(filterStrategy) {
    this.filterStrategy = filterStrategy;
  }

  setSortStrategy(sortStrategy) {
    this.sortStrategy = sortStrategy;
  }

  apply(list) {
    const filtered = this.filterStrategy ? this.filterStrategy.filter(list) : list;
    const sorted = this.sortStrategy ? this.sortStrategy.sort(filtered) : filtered;
    return sorted;
  }
}
