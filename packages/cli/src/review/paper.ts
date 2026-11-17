// paper.ts - the shape of a parsed paper.
//
// This file knows nothing about LaTeX. The LaTeX reader (parser.ts) produces a Paper;
// a PDF reader could later produce the same object, and the tools and checks would
// not change. Everything here is plain data, so a Paper can be saved with JSON.stringify.

/** One parsed paper. */
export interface Paper {
  format: "latex" | "pdf";     // which reader produced it
  source: string;              // the folder or file it was read from
  mainFile?: string;           // LaTeX: the file with \begin{document}
  title: string;
  sections: Section[];         // in document order; the abstract first
  sentences: Sentence[];       // S1, S2, ... in document order
  tables: Table[];             // T1, T2, ... in document order
  warnings: string[];          // things the reader could not do, e.g. a missing \input file
}

/** A section or subsection. */
export interface Section {
  id: string;          // "abstract", "front", "3", "3.2", "A", "A.1", or "u1", "u2"... (unnumbered)
  name: string;        // the heading, e.g. "Experiments"
  level: 0 | 1 | 2;    // 0: abstract or text before the first section; 1: section; 2: subsection
  parent?: string;     // a subsection's section id
  appendix: boolean;
}

/** One sentence of running text. */
export interface Sentence {
  id: string;          // "S1", "S2", ...
  section: string;     // Section.id
  text: string;
}

/** One table (one tabular). */
export interface Table {
  id: string;          // "T1", "T2", ...
  caption: string;
  label?: string;      // LaTeX: e.g. "tab:main"
  section: string;     // Section.id where the table appears
  rows: number;        // number of rows, header rows included
  columns: number;
  headerRows: number;  // how many rows at the top are headers (rows 1..headerRows)
  cells: Cell[];       // row by row, left to right
}

/** One cell of a table. */
export interface Cell {
  id: string;          // "T1.r2.c3": table, row, column (1-based; a spanning cell takes its first column)
  row: number;
  col: number;
  span: number;        // columns covered (\multicolumn), normally 1
  text: string;        // cleaned text, e.g. "85.3 ± 0.2"
  value?: number;      // set when the cell is a number, e.g. 85.3
  spread?: number;     // the part after ±, e.g. 0.2
  delta?: number;      // a signed number in brackets after the value, e.g. "85.3 (+2.1)" gives 2.1
  interval?: [number, number];   // a range such as bounds, "[0.17, 0.25]" (then there is no value)
  percent: boolean;    // the cell has a % sign
  numbers: number[];   // every number in the text, in order
  rowLabel: string;    // the text cells left of the row's first number, joined with " / " (empty cells skipped)
  colLabel: string;    // text of the header cell(s) above, joined with " / "
  header: boolean;     // true for cells in header rows
}
