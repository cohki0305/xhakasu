import { OTHER_ID } from "./defaults";
import type { Genre, Questions } from "./types";

export function buildQuestions(genres: Genre[]): Questions {
  const criteria: Record<string, string> = {};
  for (const g of genres) criteria[g.id] = g.description;
  if (!(OTHER_ID in criteria)) criteria[OTHER_ID] = "上のどれにも当てはまらない";
  return {
    genre: { type: "choice", instructions: "この投稿の主な話題はどれか", criteria },
    offensive: { type: "noul", instructions: "特定の人や集団への罵倒・侮辱・脅しを含むか" },
    sexual: { type: "noul", instructions: "性的な内容、または性的なコンテンツへの誘導を含むか" },
  };
}
