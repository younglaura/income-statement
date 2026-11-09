import { readFileSync } from "node:fs";
import { isIsoDate } from "./dates";
import { parseMoney, ZERO, type Money } from "./money";

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_SUBTYPES = [
  "operating_revenue",
  "contra_revenue",
  "cogs",
  "operating_expense",
  "other_income",
  "balance_sheet",
] as const;
export type AccountSubtype = (typeof ACCOUNT_SUBTYPES)[number];

/** Which account types each subtype may hold. Catches e.g. an asset filed under cogs. */
const TYPES_FOR_SUBTYPE: Record<AccountSubtype, readonly AccountType[]> = {
  operating_revenue: ["revenue"],
  contra_revenue: ["revenue"],
  cogs: ["expense"],
  operating_expense: ["expense"],
  other_income: ["revenue", "expense"],
  balance_sheet: ["asset", "liability", "equity"],
};

export const ENTRY_STATUSES = ["posted", "draft", "void"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export interface Account {
  number: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  isActive: boolean;
}

export interface JournalLine {
  account: string;
  debit: Money;
  credit: Money;
}

export interface JournalEntry {
  id: string;
  date: string;
  status: EntryStatus;
  memo: string;
  lines: JournalLine[];
}

export interface Ledger {
  company: string;
  currency: string;
  /** Keyed by account number, in chart-of-accounts order. */
  accounts: Map<string, Account>;
  entries: JournalEntry[];
}

/** The JSON as stored. Fields are unknown until checked: the file is outside the type system. */
type RawObject = Record<string, unknown>;

export class LedgerError extends Error {
  override name = "LedgerError";
}

/**
 * Parses raw ledger JSON into domain types and validates it. Throws LedgerError naming
 * the offending account or entry id on the first problem found. Draft and void entries
 * are validated too: they stay in the ledger, so bad data in them is still bad data.
 */
export function loadLedger(raw: unknown): Ledger {
  if (!isObject(raw) || !Array.isArray(raw.accounts) || !Array.isArray(raw.journal_entries)) {
    throw new LedgerError("ledger must have accounts and journal_entries arrays");
  }
  const company = requireString(raw.company, "ledger company");
  const currency = requireString(raw.currency, "ledger currency");

  const accounts = new Map<string, Account>();
  raw.accounts.forEach((rawAccount, i) => {
    const account = toAccount(rawAccount, `account #${i + 1}`);
    if (accounts.has(account.number)) {
      throw new LedgerError(`duplicate account number ${account.number}`);
    }
    accounts.set(account.number, account);
  });

  const seenIds = new Set<string>();
  const entries = raw.journal_entries.map((rawEntry, i) => {
    const entry = toEntry(rawEntry, `entry #${i + 1}`, accounts);
    if (seenIds.has(entry.id)) throw new LedgerError(`duplicate entry id ${entry.id}`);
    seenIds.add(entry.id);
    return entry;
  });

  return { company, currency, accounts, entries };
}

function toAccount(raw: unknown, position: string): Account {
  if (!isObject(raw)) throw new LedgerError(`${position} must be an object`);
  const number = requireString(raw.number, `${position} number`);
  const where = `account ${number}`;
  const name = requireString(raw.name, `${where} name`);
  if (!isOneOf(ACCOUNT_TYPES, raw.type)) throw new LedgerError(`${where}: unknown type ${JSON.stringify(raw.type)}`);
  if (!isOneOf(ACCOUNT_SUBTYPES, raw.subtype)) {
    throw new LedgerError(`${where}: unknown subtype ${JSON.stringify(raw.subtype)}`);
  }
  if (!TYPES_FOR_SUBTYPE[raw.subtype].includes(raw.type)) {
    throw new LedgerError(`${where}: type ${raw.type} cannot have subtype ${raw.subtype}`);
  }
  if (typeof raw.is_active !== "boolean") {
    throw new LedgerError(`${where}: is_active must be true or false, got ${JSON.stringify(raw.is_active)}`);
  }
  return { number, name, type: raw.type, subtype: raw.subtype, isActive: raw.is_active };
}

function toEntry(raw: unknown, position: string, accounts: Map<string, Account>): JournalEntry {
  if (!isObject(raw)) throw new LedgerError(`${position} must be an object`);
  const id = requireString(raw.id, `${position} id`);
  const where = `entry ${id}`;
  if (!isOneOf(ENTRY_STATUSES, raw.status)) throw new LedgerError(`${where}: unknown status ${JSON.stringify(raw.status)}`);
  if (!isIsoDate(raw.date)) throw new LedgerError(`${where}: invalid date ${JSON.stringify(raw.date)}, expected YYYY-MM-DD`);
  const memo = requireString(raw.memo, `${where} memo`, { allowEmpty: true });
  if (!Array.isArray(raw.lines) || raw.lines.length < 2) throw new LedgerError(`${where}: needs at least two lines`);

  const lines = raw.lines.map((line, i) => toLine(line, `${where} line ${i + 1}`, accounts));

  const debits = lines.reduce((sum, l) => sum + l.debit, ZERO);
  const credits = lines.reduce((sum, l) => sum + l.credit, ZERO);
  if (debits !== credits) throw new LedgerError(`${where}: debits do not equal credits`);

  return { id, date: raw.date, status: raw.status, memo, lines };
}

function toLine(raw: unknown, where: string, accounts: Map<string, Account>): JournalLine {
  if (!isObject(raw)) throw new LedgerError(`${where} must be an object`);
  const account = requireString(raw.account, `${where} account`);
  if (!accounts.has(account)) throw new LedgerError(`${where}: unknown account ${JSON.stringify(account)}`);
  const debit = toMoney(raw.debit, `${where} debit`);
  const credit = toMoney(raw.credit, `${where} credit`);
  if ((debit === ZERO) === (credit === ZERO)) {
    throw new LedgerError(`${where}: exactly one of debit or credit must be non-zero`);
  }
  return { account, debit, credit };
}

function toMoney(value: unknown, what: string): Money {
  const text = requireString(value, what);
  try {
    return parseMoney(text);
  } catch (err) {
    throw new LedgerError(`${what}: ${(err as Error).message}`);
  }
}

function requireString(value: unknown, what: string, { allowEmpty = false } = {}): string {
  if (typeof value !== "string" || (!allowEmpty && value === "")) {
    throw new LedgerError(`${what} must be a ${allowEmpty ? "" : "non-empty "}string, got ${JSON.stringify(value)}`);
  }
  return value;
}

function isObject(value: unknown): value is RawObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return (allowed as readonly unknown[]).includes(value);
}

export function readLedgerFile(path: string | URL): Ledger {
  return loadLedger(JSON.parse(readFileSync(path, "utf8")));
}
