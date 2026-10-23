// Tematy śledzone: wpis z takim hasłem zawsze przechodzi filtr i jest wyróżniony na stronie.
// Hasła małymi literami; dopasowanie po fragmencie tekstu (tytuł, streszczenie).
export const TRACKED_TOPICS: { label: string; match: string[] }[] = [
  { label: "JPK_MAG", match: ["jpk_mag", "jpk mag", "jpk-mag", "ewidencji magazynowej", "gospodarki magazynowej"] },
  { label: "Klasyfikacja budżetowa 2027", match: ["klasyfikacji budżetowej", "klasyfikacja budżetowa", "klasyfikacji dochodów, wydatków"] },
  { label: "KSeF w JST", match: ["ksef"] },
  { label: "Sprawozdawczość Rb", match: ["sprawozdawczości budżetowej", "sprawozdań rb", "rb-27s", "rb-28s", "rb-n", "rb-z"] },
  { label: "PIT płatnika", match: ["pit-11", "pit-4r", "pit-8ar", "pit-8c", "pit-r"] },
];

export function trackedTopicsIn(text: string) {
  const t = text.toLowerCase();
  return TRACKED_TOPICS.filter((topic) => topic.match.some((m) => t.includes(m))).map((topic) => topic.label);
}
