import type { FamilyRelationship, Person } from "@/types/family";

/** Local fallback has no designated «current user» — focus comes from UI state. */
export const CURRENT_USER_ID = "";

/** Fictional demo people for local development only (never production Supabase). */
export const people: Person[] = [
  {
    id: "alexey-examplov",
    firstName: "Алексей",
    middleName: "Петрович",
    lastName: "Примернов",
    birthDate: "1945-03-12",
    deathDate: "2018-11-04",
    birthPlace: "г. Примерск",
    biography: "Вымышленный персонаж для локальной разработки.",
    relationshipLabel: "Прадед",
    parentIds: [],
    spouseId: "maria-examplova",
    childIds: ["sergey-examplov", "olga-examplova", "pavel-examplov"],
  },
  {
    id: "maria-examplova",
    firstName: "Мария",
    middleName: "Ивановна",
    lastName: "Примернова",
    birthDate: "1948-07-22",
    birthPlace: "г. Примерск",
    biography: "Вымышленный персонаж для локальной разработки.",
    relationshipLabel: "Прабабушка",
    parentIds: [],
    spouseId: "alexey-examplov",
    childIds: ["sergey-examplov", "olga-examplova", "pavel-examplov"],
  },
  {
    id: "sergey-examplov",
    firstName: "Сергей",
    middleName: "Алексеевич",
    lastName: "Примернов",
    birthDate: "1972-05-18",
    birthPlace: "г. Примерск",
    biography: "Вымышленный персонаж для локальной разработки.",
    relationshipLabel: "Отец",
    parentIds: ["alexey-examplov", "maria-examplova"],
    spouseId: "anna-examplova",
    childIds: [],
  },
  {
    id: "anna-examplova",
    firstName: "Анна",
    middleName: "Сергеевна",
    lastName: "Примернова",
    birthDate: "1974-09-03",
    birthPlace: "г. Примерск",
    biography: "Вымышленный персонаж для локальной разработки.",
    relationshipLabel: "Мать",
    parentIds: [],
    spouseId: "sergey-examplov",
    childIds: [],
  },
  {
    id: "olga-examplova",
    firstName: "Ольга",
    middleName: "Алексеевна",
    lastName: "Примернова",
    birthDate: "1975-12-01",
    birthPlace: "г. Примерск",
    biography: "Вымышленный персонаж для локальной разработки.",
    relationshipLabel: "Тётя",
    parentIds: ["alexey-examplov", "maria-examplova"],
    childIds: [],
  },
  {
    id: "pavel-examplov",
    firstName: "Павел",
    middleName: "Алексеевич",
    lastName: "Примернов",
    birthDate: "1978-02-14",
    birthPlace: "г. Примерск",
    biography: "Вымышленный персонаж для локальной разработки.",
    relationshipLabel: "Дядя",
    parentIds: ["alexey-examplov", "maria-examplova"],
    childIds: [],
  },
];

export const relationships: FamilyRelationship[] = [
  {
    id: "rel-alexey-maria",
    type: "spouse",
    sourceId: "alexey-examplov",
    targetId: "maria-examplova",
  },
  {
    id: "rel-sergey-anna",
    type: "spouse",
    sourceId: "sergey-examplov",
    targetId: "anna-examplova",
  },
  {
    id: "rel-alexey-sergey",
    type: "parent-child",
    sourceId: "alexey-examplov",
    targetId: "sergey-examplov",
  },
  {
    id: "rel-maria-sergey",
    type: "parent-child",
    sourceId: "maria-examplova",
    targetId: "sergey-examplov",
  },
  {
    id: "rel-alexey-olga",
    type: "parent-child",
    sourceId: "alexey-examplov",
    targetId: "olga-examplova",
  },
  {
    id: "rel-maria-olga",
    type: "parent-child",
    sourceId: "maria-examplova",
    targetId: "olga-examplova",
  },
  {
    id: "rel-alexey-pavel",
    type: "parent-child",
    sourceId: "alexey-examplov",
    targetId: "pavel-examplov",
  },
  {
    id: "rel-maria-pavel",
    type: "parent-child",
    sourceId: "maria-examplova",
    targetId: "pavel-examplov",
  },
];

export const peopleMap = new Map(people.map((person) => [person.id, person]));

export function getPersonById(id: string): Person | undefined {
  return peopleMap.get(id);
}

export function getFullName(person: Person): string {
  return [person.firstName, person.middleName, person.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export function formatLifeYears(person: Person): string | null {
  if (!person.birthDate) {
    return null;
  }

  const birthYear = new Date(person.birthDate).getFullYear();

  if (person.deathDate) {
    const deathYear = new Date(person.deathDate).getFullYear();
    return `${birthYear} — ${deathYear}`;
  }

  return `род. ${birthYear}`;
}

export function formatBirthDate(date?: string): string {
  if (!date) {
    return "Дата неизвестна";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}
