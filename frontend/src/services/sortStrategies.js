// Strategy interface (by convention): sort(list) => newList

export class SortByTitleAscStrategy {
  sort(list) {
    return [...list].sort((a, b) =>
      (a.title || "").localeCompare((b.title || ""), "ro", { sensitivity: "base" })
    );
  }
}

export class SortByTitleDescStrategy {
  sort(list) {
    return [...list].sort((a, b) =>
      (b.title || "").localeCompare((a.title || ""), "ro", { sensitivity: "base" })
    );
  }
}
