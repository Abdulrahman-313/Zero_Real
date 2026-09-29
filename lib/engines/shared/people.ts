import { Faker, base, de, en, en_GB, en_US, type LocaleDefinition } from "@faker-js/faker";
import type { LocaleId } from "./locales";
import { createFakerRandomizer, type Rng } from "./rng";

const LOCALE_CHAINS: Record<LocaleId, LocaleDefinition[]> = {
  "en-US": [en_US, en, base],
  "en-GB": [en_GB, en, base],
  "de-DE": [de, en, base],
  "en-PK": [en, base],
};

const fakerCache = new Map<LocaleId, Faker>();

/** A locale-specific faker instance backed by our own seedable randomizer. Always seed before use. */
export function getFaker(locale: LocaleId): Faker {
  let instance = fakerCache.get(locale);
  if (!instance) {
    instance = new Faker({ locale: LOCALE_CHAINS[locale], randomizer: createFakerRandomizer() });
    fakerCache.set(locale, instance);
  }
  return instance;
}

// Curated Pakistani name and city pools (faker has no en_PK locale).
const PK_FIRST = [
  "Ahmed", "Ali", "Ayesha", "Bilal", "Fatima", "Hamza", "Hina", "Imran", "Iqra", "Kamran",
  "Mahnoor", "Maryam", "Noman", "Omar", "Rabia", "Saad", "Sana", "Shahid", "Sidra", "Taha",
  "Usman", "Zainab", "Zara", "Hassan", "Areeba", "Faisal", "Nida", "Waqar", "Mehwish", "Danish",
];
const PK_LAST = [
  "Raza", "Khan", "Malik", "Qureshi", "Siddiqui", "Sheikh", "Chaudhry", "Butt", "Mirza", "Abbasi",
  "Hashmi", "Javed", "Aslam", "Rashid", "Iqbal", "Anwar", "Farooq", "Haider", "Baig", "Zafar",
];
export const PK_CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Hyderabad"];

export interface Person {
  first: string;
  last: string;
}

export function makePerson(locale: LocaleId, faker: Faker, rng: Rng): Person {
  if (locale === "en-PK") return { first: rng.pick(PK_FIRST), last: rng.pick(PK_LAST) };
  return { first: faker.person.firstName(), last: faker.person.lastName() };
}

export function makeCity(locale: LocaleId, faker: Faker, rng: Rng): string {
  if (locale === "en-PK") return rng.pick(PK_CITIES);
  return faker.location.city();
}

/** Reserved example domains (RFC 2606) — never real mailboxes. */
export const SAFE_EMAIL_DOMAINS = ["example.com", "example.org", "example.net"] as const;

function emailPart(value: string): string {
  return value
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function makeEmail(person: Person, rng: Rng): string {
  const first = emailPart(person.first) || "user";
  const last = emailPart(person.last) || "test";
  const style = rng.int(0, 3);
  const local =
    style === 0
      ? `${first[0]}.${last}`
      : style === 1
        ? `${first}.${last}`
        : style === 2
          ? `${first}${last[0]}${rng.int(1, 99)}`
          : `${first}_${last}`;
  return `${local}@${rng.pick(SAFE_EMAIL_DOMAINS)}`;
}
